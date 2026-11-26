/**
 * «Сегодня» (bus 171, mockup v5): the page's model, built on the server from what Family OS already returns —
 * /my-tasks, the member's routines, /board, /calendar and /reminders. Nothing here is invented: a block without data is
 * an empty state, and a KPI without data is left out. Pure; tested in tests/family-today.test.mjs.
 *
 * Roles: a child (Family OS person kind "child") gets only their own blocks — no «Ждут решения», no «Семья сегодня»,
 * no decisions KPI. The page does not even fetch the family board for a child, and this model drops those blocks, so
 * the browser never receives them.
 */

const DONE = new Set(["done", "reviewed"]);
const CHECKABLE = new Set(["accepted", "in_progress"]);

/** Hour of the day (0–23) in the family's time zone. */
export function familyHour(now = new Date(), timeZone = "Europe/London") {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now));
}

/** «Доброе утро, Анна» — by the time of day. Without a name, no dangling comma; never an email. */
export function greetingAt(lang, name, hour) {
  const n = typeof name === "string" ? name.trim() : "";
  const safe = n && !n.includes("@") ? n : "";
  const part = hour >= 5 && hour < 12 ? 0 : hour >= 12 && hour < 17 ? 1 : hour >= 17 && hour < 23 ? 2 : 3;
  const word = lang === "EN" ? ["Good morning", "Good afternoon", "Good evening", "Good night"][part] : ["Доброе утро", "Добрый день", "Добрый вечер", "Доброй ночи"][part];
  return safe ? `${word}, ${safe}` : word;
}

/** Russian plural: 1 дело, 2 дела, 5 дел. */
export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** The Sunday that ends the week of `iso` (weeks run Monday–Sunday). */
export const weekEnd = (iso) => addDays(iso, (7 - new Date(`${iso}T12:00:00Z`).getUTCDay()) % 7);

const nameOf = (p, lang) => (p ? (lang === "EN" ? p.name_en : p.name_ru) : "");

/**
 * My items for today: board tasks (accepted / in progress / done / waiting for parents) and the routines due today.
 * A task is checked off through POST tasks/:id/done (allowed from accepted and in progress); a routine through its
 * check route, both ways. Done tasks cannot be unticked (the board has no undo), so they are shown ticked and inert.
 */
export function myItems({ myBoard, routines }) {
  const items = [];
  for (const x of myBoard?.mine ?? []) {
    items.push({
      key: `t:${x.id}`, type: "task", id: x.id, title: x.title, state: x.state,
      done: DONE.has(x.state), checkable: CHECKABLE.has(x.state) && !x.nudge, nudge: Boolean(x.nudge),
      time: x.due_time ?? null, slot: x.when_slot ?? null, inProgress: x.state === "in_progress",
    });
  }
  const paused = Boolean(routines?.paused_today);
  if (!paused) for (const r of routines?.routines ?? []) {
    if (!r.due_today) continue;
    items.push({
      key: `r:${r.id}`, type: "routine", id: r.id, title: r.title, kind: r.kind,
      done: Boolean(r.done_today), checkable: Boolean(routines?.can?.check), nudge: false, time: r.at_time ?? null, slot: null, inProgress: false,
    });
  }
  return items;
}

/** The most urgent open item: what is running, then the earliest time, then board tasks before routines. */
export function mostUrgent(items) {
  const open = items.filter((x) => !x.done);
  if (open.length === 0) return null;
  const rank = (x) => [x.inProgress ? 0 : 1, x.time ?? "99:99", x.type === "task" ? 0 : 1];
  return [...open].sort((a, b) => {
    const [p, q] = [rank(a), rank(b)];
    for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return p[i] < q[i] ? -1 : 1;
    return 0;
  })[0];
}

/** The banner's one sentence. `decisions` is null for a child (the clause is left out, not «0»). */
export function summaryLine(lang, items, decisions) {
  const done = items.filter((x) => x.done).length, left = items.length - done;
  const top = mostUrgent(items);
  const parts = [];
  if (lang === "EN") {
    if (items.length === 0) parts.push("Nothing is planned for you today.");
    else if (left === 0) parts.push("Everything for today is done.");
    else parts.push(`${left} ${left === 1 ? "thing" : "things"} left for today. Most urgent: “${top.title}”.`);
    if (decisions !== null) parts.push(decisions === 0 ? "No decisions are waiting." : `${decisions} ${decisions === 1 ? "decision is" : "decisions are"} waiting for you.`);
  } else {
    if (items.length === 0) parts.push("На сегодня у тебя ничего не запланировано.");
    else if (left === 0) parts.push("Все дела на сегодня сделаны.");
    else parts.push(`Осталось ${left} ${plural(left, ["дело", "дела", "дел"])} на сегодня. Самое срочное — «${top.title}».`);
    if (decisions !== null) parts.push(decisions === 0 ? "Решений в очереди нет." : `${decisions} ${plural(decisions, ["решение ждёт", "решения ждут", "решений ждут"])} тебя.`);
  }
  return parts.join(" ");
}

/** What waits for a parent's decision on the board: declined or not accepted tasks, and tomorrow's plan before approval. */
export function waitingDecisions(board, people, lang) {
  if (!board?.can?.approve) return [];
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const out = (board.needs_decision ?? []).map((x) => ({ key: `d:${x.id}`, type: "task", title: x.title, who: nameOf(byId.get(x.assignee_id), lang), why: x.why ?? (x.state === "declined" ? "declined" : "not_accepted") }));
  const p = board.plan;
  if (p && p.ready && !p.approved && p.proposed > 0) out.push({ key: `plan:${p.date}`, type: "plan", title: null, who: "", why: "plan", date: p.date, count: p.proposed });
  return out;
}

/**
 * The whole page model.
 * @param {{ lang: "EN" | "RU", me: { id: string, kind: "adult" | "child", name_en: string, name_ru: string } | null, admin: boolean,
 *   people: { id: string, name_en: string, name_ru: string, kind: string }[], myBoard: any, routines: any, board: any, calendar: any,
 *   reminders: { tier: string | null }[], hour: number, today: string }} o
 */
export function todayModel({ lang, me, admin, people, myBoard, routines, board, calendar, reminders, hour, today }) {
  const child = me?.kind === "child";
  const adult = Boolean(me) && !child;
  const items = myItems({ myBoard, routines });
  const day = calendar?.today ?? myBoard?.today ?? routines?.today ?? today;
  const cal = calendar?.items ?? null;
  const end = weekEnd(day);
  const schedule = cal ? cal.filter((i) => i.date === day).map((i) => ({
    key: `${i.kind}:${i.id ?? i.person_id ?? i.date}`, kind: i.kind, time: i.time ?? null,
    title: i.kind === "birthday" ? (lang === "EN" ? i.name_en : i.name_ru) ?? "" : i.title ?? "", age: i.age ?? null,
  })).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")) : null;
  const weekEvents = cal ? cal.filter((i) => i.date >= day && i.date <= end).length : null;
  const decisions = adult ? waitingDecisions(board, people, lang) : null;
  // Without the board (it did not answer) there is no number to show — not a zero.
  const decisionsCount = adult && board ? (board.can?.approve ? decisions.length : 0) : null;
  const family = adult && board?.members ? board.members.map((m) => ({
    id: m.id, name: nameOf(m, lang), open: Math.max(0, m.total - m.done), done: m.done, total: m.total,
    current: m.current?.title ?? null, routines: m.routines ?? null, me: m.id === me?.id,
  })) : null;
  const urgentDocs = (reminders ?? []).filter((r) => r.tier === "expired" || r.tier === "lt3").length;
  const openTasks = (myBoard?.new?.length ?? 0) + (myBoard?.mine ?? []).filter((x) => CHECKABLE.has(x.state)).length;

  // KPI cards: open tasks, waiting decisions (adults), events this week; a fourth only with real data behind it.
  const kpis = [];
  if (myBoard) kpis.push({ id: "open", value: openTasks, new: myBoard.new?.length ?? 0 });
  if (decisionsCount !== null) kpis.push({ id: "decisions", value: decisionsCount });
  if (weekEvents !== null) kpis.push({ id: "events", value: weekEvents });
  if (urgentDocs > 0) kpis.push({ id: "documents", value: urgentDocs });

  const meName = me ? nameOf(me, lang) : null;
  return {
    child, adult, owner: Boolean(admin), today: day,
    greeting: greetingAt(lang, meName, hour), name: meName && !meName.includes("@") ? meName.trim().split(/\s+/)[0] : null,
    items, newTasks: myBoard?.new?.length ?? 0, paused: Boolean(routines?.paused_today),
    summary: { decisions: decisionsCount },
    kpis, schedule, decisions, family,
  };
}
