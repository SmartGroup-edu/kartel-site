// Family OS Stage 3b (bus 79): council agenda, goal weeks, calendar items and the ICS feed. Pure,
// unit-tested in stage3b.test.mjs. Nothing here reads a clock, a database or decrypts anything.
import { parseRule, occursOn, addDays } from "./recur.mjs";
import { rotationAssignee, pausedOn } from "./engine.mjs";

const weekday = (d) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday … 6 = Sunday
export const COUNCIL_TIME = "19:00";

/** The council date for a given day: that day if it is a Sunday, else the next Sunday. */
export const councilDate = (today) => addDays(today, (6 - weekday(today) + 7) % 7);
/** Monday of the week a date falls in (goal check-ins are weekly). */
export const weekStart = (d) => addDays(d, -weekday(d));

/**
 * The week before a council, in aggregate only (plan §3.6, bus 77: «done/not done in aggregate, no
 * per-child shaming»). Counts scheduled vs done across the whole family; no names, no per-person rows.
 * Days after `today` are not counted (the week may not be over yet). Paused days are not scheduled.
 */
export function buildAgenda(meetingDate, today, { routines, rotations = [], checks, rotationChecks = [], pauses = [], prevTasks = [] }) {
  const from = addDays(meetingDate, -6), to = meetingDate < today ? meetingDate : today;
  const doneR = new Set(checks.filter((c) => c.done).map((c) => `${c.routine_id}|${c.on_date}`));
  const doneX = new Set(rotationChecks.filter((c) => c.done).map((c) => `${c.rotation_id}|${c.on_date}`));
  let scheduled = 0, done = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const r of routines) {
      if (!occursOn(parseRule(r.rrule), r.dtstart, d) || pausedOn(pauses, r.person_id, d)) continue;
      scheduled++; if (doneR.has(`${r.id}|${d}`)) done++;
    }
    for (const x of rotations) {
      const who = rotationAssignee(x, d);
      if (!who || pausedOn(pauses, who, d)) continue;
      scheduled++; if (doneX.has(`${x.id}|${d}`)) done++;
    }
  }
  const tasksDone = prevTasks.filter((t) => t.done_at).length;
  return { from, to, items: { scheduled, done }, tasks: { done: tasksDone, open: prevTasks.length - tasksDone } };
}

/**
 * Calendar items in [from, to] for one viewer: council Sundays, family events, and birthdays of people
 * whose birth date this viewer may see (the caller filters `birthdayPeople` with canSeeBirthday).
 */
export function calendarItems(from, to, { events, birthdayPeople, nameOf }) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (weekday(d) === 6) out.push({ date: d, time: COUNCIL_TIME, kind: "council" });
    for (const p of birthdayPeople) if (p.birth_date && p.birth_date.slice(5) === d.slice(5) && p.birth_date <= d) out.push({ date: d, time: null, kind: "birthday", person_id: p.id, name: nameOf(p) });
  }
  for (const e of events) if (e.on_date >= from && e.on_date <= to) out.push({ date: e.on_date, time: e.at_time ?? null, kind: "event", id: e.id, title: e.title });
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"));
}

// ---- ICS (RFC 5545) ------------------------------------------------------------------------------
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (d) => d.replaceAll("-", "");
const hm = (t) => `${t.replace(":", "")}00`;
/** Fold lines at 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
export function fold(line) {
  const out = []; let cur = "", n = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; n = 0; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/**
 * One person's feed: their routines (as RRULEs), their rotation turns (next 30 days, single events),
 * the weekly council, family events and the birthdays they may see. Times are Europe/London wall time.
 */
export function buildIcs({ today, stamp, calName, routines, rotations, personId, events, birthdayPeople, nameOf, labels }) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KARTEL//Family OS//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calName)}`, "X-WR-TIMEZONE:Europe/London"];
  const ev = (uid, start, time, summary, extra = []) => {
    L.push("BEGIN:VEVENT", `UID:${uid}@family.kartel.org.uk`, `DTSTAMP:${stamp}`);
    if (time) { L.push(`DTSTART;TZID=Europe/London:${ymd(start)}T${hm(time)}`, "DURATION:PT30M"); }
    else { L.push(`DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(addDays(start, 1))}`); }
    L.push(`SUMMARY:${esc(summary)}`, ...extra, "END:VEVENT");
  };
  for (const r of routines) ev(`routine-${r.id}`, r.dtstart, r.at_time, r.title, [`RRULE:${r.rrule}`]);
  for (const x of rotations) for (let i = 0; i <= 30; i++) { const d = addDays(today, i); if (rotationAssignee(x, d) === personId) ev(`rotation-${x.id}-${ymd(d)}`, d, x.at_time, x.title); }
  ev("council", councilDate(today), COUNCIL_TIME, labels.council, ["RRULE:FREQ=WEEKLY;BYDAY=SU"]);
  for (const e of events) ev(`event-${e.id}`, e.on_date, e.at_time, e.title);
  for (const p of birthdayPeople) if (p.birth_date) ev(`birthday-${p.id}`, p.birth_date, null, `${labels.birthday}: ${nameOf(p)}`, ["RRULE:FREQ=YEARLY"]);
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
