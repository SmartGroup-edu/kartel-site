// Family OS engine (Stage 3a; plan v3.8 §3.3–3.6, bus 77). Pure planning, unit-tested in engine.test.mjs.
// runner.mjs adds the database, the rule_run ledger and the relay. Nothing here reads a clock or a DB.
//
// What the engine decides, per person, on each tick (every 5 minutes):
//   · morning digest at the person's digest time (default 07:00): today's own items; documents that
//     need action (rule documents_in_digest); gentle parent-only notes (rule missed_routine_parent_note);
//   · evening check-in at the person's evening time (opt-in): today's items not yet ticked;
//   · council reminder (rule council_reminder): Sunday 18:00, to every member.
// Guards on every send: rule on, person opted in, outside quiet hours (21:00–07:00), under the daily cap,
// idempotency key not used yet. «День без ритма» (pause): no items, no reminders, streaks skip the days.
import { parseRule, occursOn, occurrences, addDays } from "./recur.mjs";

export const FAMILY_TZ = "Europe/London";
export const MAX_PER_DAY = 3;          // emails per person per family day, all rules together
export const WINDOW_MIN = 10;          // a due time fires within this many minutes (cron every 5)
export const DOC_DIGEST_DAYS = 91;     // documents in the digest: expired or ≤ 3 months
export const MISSED_DAYS = 3;          // missed routine note after this many scheduled days in a row
export const DEFAULT_PREFS = { email_on: true, digest_time: "07:00", evening_on: false, evening_time: "20:00", quiet_start: "21:00", quiet_end: "07:00", lang: "ru" };
export const BUILTIN_RULES = [
  { id: "digest", enabled: true },
  { id: "evening_checkin", enabled: true },
  { id: "documents_in_digest", enabled: false },
  { id: "missed_routine_parent_note", enabled: false },
  { id: "council_reminder", enabled: false },
  { id: "board_new_tasks", enabled: false },
  { id: "plan_ready", enabled: false },
  { id: "needs_decision", enabled: false },
];

const DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Family-local date, time and weekday (0 = Monday) for an instant. DST-correct via Intl. */
export function localParts(now, tz = FAMILY_TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}`, weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday) };
}

/** Is a due time (HH:MM) inside [due, due + window) at local time `hhmm`? */
export function isDue(due, hhmm, window = WINDOW_MIN) {
  const d = mins(due), t = mins(hhmm);
  return t >= d && t < d + window;
}

/** Quiet hours wrap midnight: 21:00–07:00 → 21:00 … 06:59 is quiet, 07:00 is not. */
export function inQuiet(hhmm, start = "21:00", end = "07:00") {
  const t = mins(hhmm), s = mins(start), e = mins(end);
  return s > e ? t >= s || t < e : t >= s && t < e;
}

export const pausedOn = (pauses, personId, date) => pauses.some((p) => p.person_id === personId && !p.cancelled_at && p.from_date <= date && date <= p.to_date);

/** Round-robin assignee of a rotation on a date (by occurrence index since the start). null if not scheduled. */
export function rotationAssignee(rot, date) {
  const rule = parseRule(rot.rrule);
  if (!rule || !rot.members?.length || !occursOn(rule, rot.dtstart, date)) return null;
  const before = occurrences(rule, rot.dtstart, rot.dtstart, addDays(date, -1), 100_000).length;
  return rot.members[before % rot.members.length];
}

/**
 * A run of missed scheduled days ending yesterday (paused days are skipped, not counted).
 * @returns {{ count: number, since: string | null }}
 */
export function missedRun(routine, doneDates, isPaused, today, lookback = 30) {
  const rule = parseRule(routine.rrule);
  let count = 0, since = null;
  for (let i = 1; i <= lookback; i++) {
    const d = addDays(today, -i);
    if (d < routine.dtstart) break;
    if (!occursOn(rule, routine.dtstart, d) || isPaused(d)) continue;
    if (doneDates.has(d)) break;
    count++; since = d;
  }
  return { count, since };
}

const firstName = (p, lang) => String((lang === "en" ? p.name_en : p.name_ru) ?? "").trim().split(/\s+/)[0] ?? "";

/** A person's items for a date: own routines + rotation turns, minus pause. Sorted by time. */
export function itemsFor(person, date, { routines, rotations, pauses }) {
  if (pausedOn(pauses, person.id, date)) return [];
  const own = routines.filter((r) => r.person_id === person.id && occursOn(parseRule(r.rrule), r.dtstart, date))
    .map((r) => ({ kind: "routine", id: r.id, title: r.title, time: r.at_time ?? null }));
  const turns = rotations.filter((x) => !x.archived_at && rotationAssignee(x, date) === person.id)
    .map((x) => ({ kind: "rotation", id: x.id, title: x.title, time: x.at_time ?? null }));
  return [...own, ...turns].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.title.localeCompare(b.title));
}

/**
 * Plan every send due at `now`. Pure.
 * @param ctx { people, grants, routines, rotations, pauses, checks: {routine_id,on_date,done}[], rotationChecks,
 *              documents (readable rows: {id, person_id, type, expiry_date}), prefs: Map(personId → prefs),
 *              rules: Map(ruleId → {enabled, dry_run}), ledger: Set("rule|key|person"), sentToday: Map(personId → n) }
 * @returns {{ rule, key, person, payload, dry_run, skip?: string }[]}
 */
export function planSends(now, ctx) {
  const { date, hhmm, weekday } = localParts(now);
  const on = (id) => ctx.rules.get(id)?.enabled === true;
  const out = [];
  const doneOn = (id, d) => ctx.checks.some((c) => c.routine_id === id && c.on_date === d && c.done) || (ctx.rotationChecks ?? []).some((c) => c.rotation_id === id && c.on_date === d && c.done);
  const counts = new Map(ctx.sentToday);
  const push = (rule, key, person, payload) => {
    const prefs = { ...DEFAULT_PREFS, ...(ctx.prefs.get(person.id) ?? {}) };
    const k = `${rule}|${key}|${person.id}`;
    if (ctx.ledger.has(k)) return;
    let skip = null;
    if (!person.email) skip = "no_email";
    else if (!prefs.email_on) skip = "opted_out";
    else if (inQuiet(hhmm, prefs.quiet_start, prefs.quiet_end)) skip = "quiet_hours";
    else if ((counts.get(person.id) ?? 0) >= MAX_PER_DAY) skip = "daily_cap";
    const dry = ctx.rules.get(rule)?.dry_run !== false;
    if (!skip && !dry) counts.set(person.id, (counts.get(person.id) ?? 0) + 1);
    out.push({ rule, key, person, payload: { ...payload, lang: prefs.lang, firstName: firstName(person, prefs.lang), date }, dry_run: dry, skip });
  };

  for (const person of ctx.people) {
    const prefs = { ...DEFAULT_PREFS, ...(ctx.prefs.get(person.id) ?? {}) };
    const items = itemsFor(person, date, ctx);

    // Morning digest
    if (on("digest") && isDue(prefs.digest_time, hhmm)) {
      const docs = !on("documents_in_digest") ? [] : ctx.documents
        .filter((d) => (person.kind === "adult" ? d.person_id === person.id : false) || guardianWith(ctx.grants, person.id, d.person_id, "documents"))
        .filter((d) => d.expiry_date && Math.round((Date.parse(`${d.expiry_date}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400_000) <= DOC_DIGEST_DAYS)
        .map((d) => ({ type: d.type, expiry: d.expiry_date, who: firstName(ctx.people.find((p) => p.id === d.person_id) ?? {}, prefs.lang) }));
      const notes = !on("missed_routine_parent_note") ? [] : parentNotes(person, date, ctx, prefs.lang);
      const tasksNew = on("board_new_tasks") ? (ctx.board?.newByPerson?.get(person.id) ?? 0) : 0;
      if (items.length || docs.length || notes.length || tasksNew)
        push("digest", date, person, { kind: "digest", items: items.map(({ title, time }) => ({ title, time })), docs, notes, ...(tasksNew ? { tasks_new: tasksNew } : {}) });
    }
    // Evening check-in (opt-in): only what is still open today
    if (on("evening_checkin") && prefs.evening_on && isDue(prefs.evening_time, hhmm)) {
      const open = items.filter((i) => !doneOn(i.id, date));
      if (open.length) push("evening_checkin", date, person, { kind: "evening", items: open.map(({ title, time }) => ({ title, time })) });
    }
    // Board (bus 82), parents only: 20:30 «План на завтра готов — утвердить»; 19:00 «Нужно решение: N»
    const parent = ctx.board?.isParent?.(person);
    if (parent && on("plan_ready") && isDue("20:30", hhmm) && ctx.board.tomorrow > 0 && !ctx.board.tomorrowApproved)
      push("plan_ready", date, person, { kind: "plan", items: [], count: ctx.board.tomorrow });
    if (parent && on("needs_decision") && isDue("19:00", hhmm) && ctx.board.declined > 0)
      push("needs_decision", date, person, { kind: "decision", items: [], count: ctx.board.declined });
    // Council reminder: Sunday 18:00
    if (on("council_reminder") && weekday === DAYS.indexOf("SU") && isDue("18:00", hhmm))
      push("council_reminder", date, person, { kind: "council", items: [] });
  }
  return out;
}

const guardianWith = (grants, guardianId, childId, scope) =>
  grants.some((g) => !g.revoked_at && g.guardian_id === guardianId && g.child_id === childId && g.scopes.includes(scope));

/**
 * Parent-only, gentle: a child's routine reached exactly MISSED_DAYS scheduled days without a tick
 * (so the line appears once per run). Only to guardians with relation "parent" and the routines scope.
 * The child never receives it; nothing is stored about the child beyond the send ledger (Floor №8).
 */
export function parentNotes(parent, date, ctx, lang) {
  const children = ctx.people.filter((c) => c.kind === "child" && ctx.grants.some((g) => !g.revoked_at && g.relation === "parent" && g.guardian_id === parent.id && g.child_id === c.id && g.scopes.includes("routines")));
  const notes = [];
  for (const c of children) for (const r of ctx.routines.filter((x) => x.person_id === c.id)) {
    const done = new Set(ctx.checks.filter((x) => x.routine_id === r.id && x.done).map((x) => x.on_date));
    const run = missedRun(r, done, (d) => pausedOn(ctx.pauses, c.id, d), date);
    if (run.count === MISSED_DAYS) notes.push({ child: firstName(c, lang), title: r.title });
  }
  return notes;
}
