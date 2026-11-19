// Stage 3e-1 «Здоровье-лайт» (plan §2.4 / §6.2, bus 86 + 109). Pure rules, unit-tested; the server stores and serves.
// - Family movement and sleep goals: each person may tick «двигался(ась)» / «выспался(ась)» for a day. Nobody sees
//   anyone else's ticks — not a parent, not the owner. The family sees ONE weekly total, and only once at least
//   three people tick (with fewer, the total would point at a person).
// - Children tick if they want (on by default, and they can switch it off); adults choose to (off by default).
// - The evening question «Что сегодня получилось?» is opt-in, one line, and only its author ever reads it.
// - No medical advice, no numbers for sleep (plan §2.4: the NHS sleep figures are still to be checked), no weight or
//   calorie anything here (that is 3e-2, adults only).
import { addDays } from "./recur.mjs";

export const HEALTH_KINDS = ["move", "sleep"];
export const MIN_FOR_TOTAL = 3;
export const EVENING_MAX = 200;
export const TICK_DAYS_BACK = 6;

/** A person's health settings; a missing row means the defaults. */
export function healthPrefFor(person, row) {
  const d = { ticks_on: person?.kind === "child", evening_q_on: false };
  return row ? { ticks_on: Boolean(row.ticks_on), evening_q_on: Boolean(row.evening_q_on) } : d;
}

/**
 * The family's week: one total per kind across everyone who ticks — never per person, never per day.
 * @returns {{ ready: false, of: number } | { ready: true, of: number, move: number, sleep: number }}
 */
export function familyTotals(people, prefRows, ticks, from, to) {
  const byId = new Map(prefRows.map((r) => [r.person_id, r]));
  const on = new Set(people.filter((p) => healthPrefFor(p, byId.get(p.id)).ticks_on).map((p) => p.id));
  if (on.size < MIN_FOR_TOTAL) return { ready: false, of: on.size };
  const n = (kind) => ticks.filter((t) => t.done && t.kind === kind && on.has(t.person_id) && t.on_date >= from && t.on_date <= to).length;
  return { ready: true, of: on.size, move: n("move"), sleep: n("sleep") };
}

/** A tick may be for today or the six days before; never the future. */
export function tickDateOk(date, today) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") && date <= today && date >= addDays(today, -TICK_DAYS_BACK);
}

/** One line, ≤ 200 characters; empty → null (delete). Any line breaks become spaces. */
export function cleanEvening(text) {
  if (typeof text !== "string") return undefined;
  const t = text.replace(/\s+/gu, " ").trim();
  if (!t) return null;
  return t.length <= EVENING_MAX ? t : undefined;
}
