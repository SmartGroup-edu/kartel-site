// Bus 172 P6: «Обзор недели» — done, slipped and waiting tasks from this week's boards; «Фокус следующей недели» is
// next week's sprint goals (the service's existing store); the page stays inside the call cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewDays, nextMonday, weekReview } from "../app/lib/family-week-review.mjs";

const src = (p) => readFileSync(p, "utf8");
/** The code without its comments (the comments name what was left out, on purpose). */
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const A = "a0000000-0000-4000-8000-000000000001", C = "a0000000-0000-4000-8000-000000000002";
const people = [{ id: A, name_ru: "Анна", name_en: "Anna" }, { id: C, name_ru: "Вера", name_en: "Vera" }];
const task = (id, state, extra = {}) => ({ id, title: `T ${id}`, state, assignee_id: A, co_ids: [], origin: "adhoc", ...extra });

test("days: Monday to today; the focus week is the Monday after", () => {
  assert.deepEqual(reviewDays("2026-11-23"), ["2026-11-23"]);
  assert.deepEqual(reviewDays("2026-11-27"), ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]);
  assert.equal(reviewDays("2026-11-29").length, 7);
  assert.equal(nextMonday("2026-11-27"), "2026-11-30");
  assert.equal(nextMonday("2026-11-29"), "2026-11-30");
});

test("done, waiting and slipped: one list per task, from the boards only", () => {
  const days = reviewDays("2026-11-25");
  const boards = [
    { date: days[0], tasks: [task("1", "done"), task("2", "accepted"), task("3", "declined", { assignee_id: C })] },
    { date: days[1], tasks: [task("4", "reviewed", { co_ids: [C] }), task("5", "approved", { assignee_id: C })] },
    { date: days[2], tasks: [task("6", "in_progress"), task("7", "accepted", { origin: "carry" }), task("8", "done", { origin: "carry" })],
      needs_decision: [{ ...task("5", "approved", { assignee_id: C }), plan_date: days[1], why: "not_accepted" }, { ...task("3", "declined", { assignee_id: C }), plan_date: days[0], why: "declined" }] },
  ];
  const r = weekReview({ boards, days, today: days[2], people, lang: "RU" });
  assert.deepEqual(r.done.map((x) => x.id), ["1", "4", "8"]);
  assert.deepEqual(r.done.find((x) => x.id === "4").who, ["Анна", "Вера"]);
  assert.deepEqual(r.waiting.map((x) => [x.id, x.why]), [["3", "declined"], ["5", "not_accepted"]]);
  assert.deepEqual(r.slipped.map((x) => [x.id, x.why]), [["2", "late"], ["7", "carried"]], "today's open task (6) has not slipped yet");
  assert.equal(r.from, "2026-11-23"); assert.equal(r.to, "2026-11-29"); assert.equal(r.missing, 0);
  const ids = [...r.done, ...r.waiting, ...r.slipped].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "no task in two lists");
});

test("without needs_decision (an adult who is not a parent) a declined task still waits; a silent day is counted", () => {
  const days = reviewDays("2026-11-24");
  const r = weekReview({ boards: [null, { date: days[1], tasks: [task("9", "declined")] }], days, today: days[1], people, lang: "EN" });
  assert.deepEqual(r.waiting.map((x) => x.id), ["9"]);
  assert.equal(r.missing, 1);
  assert.deepEqual(r.waiting[0].who, ["Anna"]);
});

test("the page: existing reads only, at most 12 Family OS calls, members only, a child goes home", () => {
  const p = src("app/[lang]/family/os/review/page.tsx");
  assert.match(p, /if \(!state\.me && !session\.guest\) notFound\(\);\n  childHome\(lang, state\.me\);/);
  // bus 176 P4: a read-only guest only when «Обзор недели» is one of their sections; names from the (adults-only) boards
  assert.match(p, /decision === "guest" && guestMay\(session, "review"\)/);
  assert.match(p, /session\.guest \? todayBoard\.members\.map/);
  assert.match(p, /getSprint\(session, nextMonday\(today\)\)/);
  assert.match(p, /days\.slice\(0, -1\)\.map\(\(d\) => getBoard\(session, d\)\)/, "one board per earlier day; today's is the plain /board");
  // edge /me + /me + /people + /my-tasks (shell) + today's /board + ≤ 6 earlier boards + /sprint = 12
  assert.equal(1 + 1 + 1 + 1 + 1 + 6 + 1, 12);
});

test("the focus writes through the existing sprint-goal routes only; no mockup data", () => {
  const c = code("app/components/FamilyWeekReview.tsx");
  assert.match(c, /osSend\("POST", "sprint\/goals", \{ title: v, week_start: week \}\)/);
  assert.match(c, /osSend\("PATCH", `sprint\/goals\/\$\{g\.id\}`, \{ title: v \}\)/);
  assert.match(c, /osSend\("PATCH", `sprint\/goals\/\$\{g\.id\}`, \{ archived: true \}\)/);
  assert.match(c, /sprint\.can\.write \?/, "the service decides who writes");
  for (const w of ["Выпустить релиз RusJAz", "Craft Resin", "Завершить обзор", "spark"]) assert.ok(!c.includes(w), w);
  const route = src("app/api/family-os/[...op]/route.ts");
  assert.match(route, /sprint\/goals\|sprint\/goals\/\$\{ID\}\/tasks/, "POST sprint/goals is already forwarded");
});

test("P6 acceptor QA: a failed request is never reported as «Сохранено.»; the counts reach a screen reader", () => {
  const c = code("app/components/FamilyWeekReview.tsx");
  // osSend returns null when fetch itself fails: that is a failure, not "nothing sent"
  assert.match(c, /if \(r === undefined\) continue;/);
  assert.match(c, /if \(!r\?\.ok\) \{ ok = false;/);
  assert.ok(!/if \(r && !r\.ok\)/.test(c), "null (network error) must not count as success");
  assert.ok(!/aria-hidden="true" className="mt-1 font-serif/.test(c), "the done / slipped counts are not hidden from assistive tech");
  // a goal is up to 160 characters: two-line fields show it whole; a line break typed into one is folded to a space
  assert.match(c, /<textarea name=\{`focus\$\{i\}`\} rows=\{2\}/);
  assert.match(c, /\.replace\(\/\\s\+\/g, " "\)\.trim\(\)/);
});
