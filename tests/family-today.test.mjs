// Bus 171 (Family OS redesign, phase 1): «Сегодня» from real data only; a child never receives adult blocks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { todayModel, summaryLine, greetingAt, plural, weekEnd, myItems, mostUrgent, waitingDecisions, familyHour } from "../app/lib/family-today.mjs";

// Synthetic family (no real names).
const ADULT = { id: "a1", kind: "adult", name_en: "Parent A", name_ru: "Родитель А" };
const CHILD = { id: "c1", kind: "child", name_en: "Child C", name_ru: "Ребёнок В" };
const people = [ADULT, CHILD];
const myBoard = { today: "2026-11-26", new: [{ id: "n1", title: "Новая", state: "approved" }], mine: [
  { id: "t1", title: "Вынести мусор", state: "accepted", due_time: "19:00" },
  { id: "t2", title: "Уроки", state: "in_progress" },
  { id: "t3", title: "Посуда", state: "done" },
  { id: "t4", title: "Не могу", state: "declined" },
] };
const routines = { today: "2026-11-26", can: { check: true }, paused_today: false, routines: [
  { id: "r1", kind: "routine", title: "Зарядка", due_today: true, done_today: false, at_time: "07:30" },
  { id: "r2", kind: "rotation", title: "Кот", due_today: true, done_today: true, at_time: null },
  { id: "r3", kind: "routine", title: "Не сегодня", due_today: false, done_today: false, at_time: null },
] };
const board = { can: { approve: true }, members: [{ id: "a1", name_en: "Parent A", name_ru: "Родитель А", kind: "adult", total: 3, done: 1, current: { title: "Уроки" }, routines: { done: 1, total: 2 } }, { id: "c1", name_en: "Child C", name_ru: "Ребёнок В", kind: "child", total: 2, done: 2, current: null }],
  needs_decision: [{ id: "d1", title: "Пылесос", assignee_id: "c1", state: "declined", why: "declined" }], plan: { date: "2026-11-27", ready: true, approved: false, proposed: 4 } };
const calendar = { today: "2026-11-26", items: [
  { date: "2026-11-26", time: "18:00", kind: "event", id: "e1", title: "Ужин" },
  { date: "2026-11-26", time: null, kind: "birthday", person_id: "c1", name_ru: "Ребёнок В", name_en: "Child C", age: 9 },
  { date: "2026-11-29", time: "19:00", kind: "council" },
  { date: "2026-12-01", time: null, kind: "event", id: "e2", title: "Next week" },
] };
const base = { lang: "RU", people, myBoard, routines, calendar, reminders: [], hour: 9, today: "2026-11-26", admin: false };

test("adult: every block from data — tasks + due routines, schedule today, decisions, family, KPIs", () => {
  const m = todayModel({ ...base, me: ADULT, board });
  assert.equal(m.child, false);
  assert.deepEqual(m.items.map((x) => x.key), ["t:t1", "t:t2", "t:t3", "t:t4", "r:r1", "r:r2"], "due routines only");
  assert.deepEqual(m.items.map((x) => x.checkable), [true, true, false, false, true, true], "accepted/in progress tick; done/declined do not");
  assert.deepEqual(m.schedule.map((e) => [e.kind, e.time, e.title]), [["birthday", null, "Ребёнок В"], ["event", "18:00", "Ужин"]]);
  assert.deepEqual(m.decisions.map((d) => d.why), ["declined", "plan"]);
  assert.deepEqual(m.family.map((f) => [f.id, f.open, f.done, f.current, f.me]), [["a1", 2, 1, "Уроки", true], ["c1", 0, 2, null, false]]);
  assert.deepEqual(m.kpis.map((k) => [k.id, k.value]), [["open", 3], ["decisions", 2], ["events", 3]], "events: today … Sunday");
  assert.equal(m.greeting, "Доброе утро, Родитель А");
});

test("child: no adult blocks in the model — no decisions, no family, no decisions KPI, no decisions clause", () => {
  const m = todayModel({ ...base, me: CHILD, board });
  assert.equal(m.child, true);
  assert.equal(m.decisions, null); assert.equal(m.family, null); assert.equal(m.summary.decisions, null);
  assert.ok(!m.kpis.some((k) => k.id === "decisions"));
  const json = JSON.stringify(m);
  assert.doesNotMatch(json, /Пылесос|needs_decision|Parent A|Родитель А/, "nothing of the family board leaks into a child's model");
  assert.doesNotMatch(summaryLine("RU", m.items, m.summary.decisions), /решени/);
});

test("server: the page does not fetch the family board for a child, and the component renders adult blocks only for adults", () => {
  const page = readFileSync("app/[lang]/family/os/page.tsx", "utf8");
  assert.match(page, /me && !child \? getBoard\(session\) : Promise\.resolve\(null\)/);
  assert.match(page, /const child = me\?\.kind === "child";/);
  const c = readFileSync("app/components/FamilyToday.tsx", "utf8");
  const adultBlock = c.slice(c.indexOf("{model.adult && ("), c.indexOf('<div data-today-more=""'));
  assert.match(adultBlock, /data-decisions=""/); assert.match(adultBlock, /data-family-today=""/);
  assert.equal((c.match(/data-decisions=""/g) ?? []).length, 1, "decisions render only inside the adult branch");
});

test("no mockup data: the component and the model carry no sample names or numbers", () => {
  for (const f of ["app/components/FamilyToday.tsx", "app/lib/family-today.mjs", "app/components/FamilyOsShell.tsx", "app/lib/family-os-shell.mjs"]) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /Игорь|Доминика|Бухгалтер|Craft Resin|RusJAz|Community Group|Лондон 7°|3 \/ 4|Созвон|Бюджет на праздники/, f);
  }
});

test("empty states: no data → empty lists and no invented KPI", () => {
  const m = todayModel({ ...base, me: ADULT, myBoard: { new: [], mine: [] }, routines: null, board: { can: { approve: false }, members: [] }, calendar: { today: "2026-11-26", items: [] } });
  assert.deepEqual(m.items, []); assert.deepEqual(m.schedule, []); assert.deepEqual(m.decisions, []); assert.deepEqual(m.family, []);
  assert.deepEqual(m.kpis.map((k) => [k.id, k.value]), [["open", 0], ["decisions", 0], ["events", 0]]);
  const down = todayModel({ ...base, me: ADULT, myBoard: null, routines: null, board: null, calendar: null });
  assert.deepEqual(down.kpis, [], "a source that did not answer gives no card, not a zero");
  assert.equal(down.schedule, null);
  const c = readFileSync("app/components/FamilyToday.tsx", "utf8");
  for (const k of ["emptyMine", "emptySchedule", "noCalendar", "emptyDecisions", "emptyFamily"]) assert.match(c, new RegExp(`\\{t\\.${k}\\}|t\\.${k}`), k);
});

test("fourth KPI only with real data: documents expiring within 3 months", () => {
  assert.ok(!todayModel({ ...base, me: ADULT, board }).kpis.some((k) => k.id === "documents"));
  const m = todayModel({ ...base, me: ADULT, board, reminders: [{ tier: "lt3" }, { tier: "lt12" }, { tier: "expired" }] });
  assert.deepEqual(m.kpis.find((k) => k.id === "documents"), { id: "documents", value: 2 });
});

test("summary: done/total, the most urgent item, decisions waiting", () => {
  const items = myItems({ myBoard, routines });
  assert.equal(mostUrgent(items).id, "t2", "what is running first");
  assert.equal(summaryLine("RU", items, 2), "Осталось 4 дела на сегодня. Самое срочное — «Уроки». 2 решения ждут тебя.");
  assert.equal(summaryLine("RU", items.map((x) => ({ ...x, done: true })), 0), "Все дела на сегодня сделаны. Решений в очереди нет.");
  assert.equal(summaryLine("RU", [], null), "На сегодня у тебя ничего не запланировано.");
  assert.equal(summaryLine("EN", items, 1), "4 things left for today. Most urgent: “Уроки”. 1 decision is waiting for you.");
});

test("greeting by time of day and name; never an email; plural forms", () => {
  assert.equal(greetingAt("RU", "Анна", 8), "Доброе утро, Анна");
  assert.equal(greetingAt("RU", "Анна", 13), "Добрый день, Анна");
  assert.equal(greetingAt("RU", "Анна", 19), "Добрый вечер, Анна");
  assert.equal(greetingAt("RU", "Анна", 2), "Доброй ночи, Анна");
  assert.equal(greetingAt("EN", "x@example.test", 8), "Good morning");
  assert.equal(greetingAt("RU", null, 13), "Добрый день");
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25].map((n) => plural(n, ["дело", "дела", "дел"])), ["дело", "дела", "дел", "дел", "дело", "дела", "дел"]);
  assert.equal(typeof familyHour(new Date("2026-11-26T09:30:00Z")), "number");
  assert.equal(familyHour(new Date("2026-07-01T09:30:00Z")), 10, "BST");
});

test("week end and decisions helper", () => {
  assert.equal(weekEnd("2026-11-26"), "2026-11-29"); assert.equal(weekEnd("2026-11-29"), "2026-11-29"); assert.equal(weekEnd("2026-11-30"), "2026-12-06");
  assert.deepEqual(waitingDecisions({ can: { approve: false }, needs_decision: [{ id: "x" }] }, people, "RU"), [], "only someone who can decide sees the queue");
});

test("paused day: routines are not listed; the note shows", () => {
  const m = todayModel({ ...base, me: ADULT, board, routines: { ...routines, paused_today: true } });
  assert.ok(m.paused); assert.ok(m.items.every((x) => x.type === "task"));
});
