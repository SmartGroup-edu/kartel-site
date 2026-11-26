// «Обзор недели» (bus 172 P6, mockup v5). Pure; tested in tests/family-week-review.test.mjs.
// Built from the week's task boards only (the same GET /board?date= reads as the printable week, Monday to today):
//   Сделано       — done or reviewed on any day of the week so far
//   Ждёт решения  — the board's needs_decision for parents (declined, or a child's task not accepted by 12:00), and
//                   every declined task on the boards (an adult who is not a parent does not get needs_decision)
//   Сорвалось     — still open (approved · accepted · in progress) on a day that has passed, and tasks the family
//                   carried over from an earlier day (origin "carry") that are not done yet
// One task lands in one list only: done before waiting before slipped. Routines, notes, documents and health are not
// tasks and never come in. Days whose board did not answer are counted, so the page can say the lists are partial.

import { mondayOf, addDays } from "./family-calendar.mjs";

const OPEN = new Set(["approved", "accepted", "in_progress"]);

/** Monday..today of `today`'s week: the days whose boards the review reads (1 on a Monday, 7 on a Sunday). */
export const reviewDays = (today) => {
  const mon = mondayOf(today), out = [];
  for (let d = mon; d <= today; d = addDays(d, 1)) out.push(d);
  return out;
};

/** The Monday after `today`'s week: «Фокус следующей недели» is that week's sprint goals (at most three). */
export const nextMonday = (today) => addDays(mondayOf(today), 7);

/**
 * @param {{ boards: ({ date?: string, tasks?: any[], needs_decision?: any[] } | null)[], days: string[], today: string,
 *   people: { id: string, name_ru: string, name_en: string }[], lang: "RU" | "EN" }} o
 *   `boards[i]` is the board of `days[i]`; the last one is today's.
 */
export function weekReview({ boards, days, today, people, lang }) {
  const name = (id) => { const p = people.find((x) => x.id === id); return p ? (lang === "EN" ? p.name_en : p.name_ru) : null; };
  const who = (t) => [t.assignee_id, ...(t.co_ids ?? [])].map(name).filter(Boolean);
  const row = (t, date, why) => ({ id: t.id, title: t.title, date: t.plan_date ?? date, who: who(t), why });
  const done = new Map(), waiting = new Map(), slipped = new Map();
  const seen = [];
  boards.forEach((b, i) => { for (const t of b?.tasks ?? []) seen.push([t, b?.date ?? days[i]]); });
  for (const [t, d] of seen) if (t.state === "done" || t.state === "reviewed") done.set(t.id, row(t, d, t.origin === "carry" ? "carried" : null));
  const todayBoard = boards[days.indexOf(today)] ?? null;
  for (const t of todayBoard?.needs_decision ?? []) if (!done.has(t.id)) waiting.set(t.id, row(t, t.plan_date, t.why === "not_accepted" ? "not_accepted" : "declined"));
  for (const [t, d] of seen) if (t.state === "declined" && !done.has(t.id) && !waiting.has(t.id)) waiting.set(t.id, row(t, d, "declined"));
  for (const [t, d] of seen) {
    if (done.has(t.id) || waiting.has(t.id) || slipped.has(t.id) || !OPEN.has(t.state)) continue;
    if (d < today) slipped.set(t.id, row(t, d, "late"));
    else if (t.origin === "carry") slipped.set(t.id, row(t, d, "carried"));
  }
  const byDate = (a, b) => a.date.localeCompare(b.date);
  return {
    from: days[0], to: addDays(days[0], 6), today,
    done: [...done.values()].sort(byDate), waiting: [...waiting.values()].sort(byDate), slipped: [...slipped.values()].sort(byDate),
    missing: boards.filter((b) => !b).length,
  };
}
