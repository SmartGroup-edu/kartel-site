// Stage 3e-2 — personal weight and calorie logs (R0 decision 18.11.2026, plan §8.3; bus 86/109). Pure rules, unit-tested.
// - ADULTS ONLY: kind "adult" AND either a birth date saying 18 or older, or (no birth date) the owner's one-time
//   confirmation of adulthood. For anyone else the routes do not exist.
// - OWNER-ONLY: the person themself. Not a spouse, a guardian or the family's owner; never in any aggregate.
// - Neutral: «цель: N кг к дате», «калории в день: N». No BMI, no body images, no comparisons, no daily ± deltas — a
//   trend (weekly and monthly means) instead. A missed entry means nothing.
// - Safety: one calm GP line when the calorie target is under 1200 a day, or the weekly mean weight falls by more than
//   1 kg a week for three weeks running. No blocking, no reproach, no notice to anyone else.
import { addDays } from "./recur.mjs";

export const KCAL_FLOOR = 1200;
export const FAST_LOSS_KG_PER_WEEK = 1;
export const FAST_LOSS_WEEKS = 3;

/**
 * 18+ adults only. A child row, or an adult row whose birth date says under 18, gets nothing. QA-156 M2 (R0 25.11):
 * with no birth date, only after the owner has confirmed once that the person is an adult (`adult_confirmed_at`).
 */
export function bodyAllowed(person, today) {
  if (!person || person.kind !== "adult") return false;
  const b = person.birth_date instanceof Date ? person.birth_date.toISOString().slice(0, 10) : person.birth_date;
  if (!b) return Boolean(person.adult_confirmed_at);
  const [y, m, d] = String(b).slice(0, 10).split("-").map(Number), [ty, tm, td] = today.split("-").map(Number);
  const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return age >= 18;
}

/** Weight in kg, 20–400, one decimal. */
export function cleanWeight(v) {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 20 || v > 400) return undefined;
  return Math.round(v * 10) / 10;
}
/** Calories per day, 500–10000, whole numbers. */
export function cleanKcal(v) {
  if (v === null) return null;
  return Number.isInteger(v) && v >= 500 && v <= 10000 ? v : undefined;
}
/** The goal: any of weight_kg / by_date / kcal_day; by_date from tomorrow to two years ahead. */
export function cleanGoal(g, today) {
  if (!g || typeof g !== "object" || Array.isArray(g) || Object.keys(g).some((k) => !["weight_kg", "by_date", "kcal_day"].includes(k))) return undefined;
  const out = {};
  if (g.weight_kg !== undefined) { const w = cleanWeight(g.weight_kg); if (w === undefined) return undefined; if (w !== null) out.weight_kg = w; }
  if (g.kcal_day !== undefined) { const k = cleanKcal(g.kcal_day); if (k === undefined) return undefined; if (k !== null) out.kcal_day = k; }
  if (g.by_date !== undefined && g.by_date !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.by_date) || g.by_date <= today || g.by_date > addDays(today, 730)) return undefined;
    out.by_date = g.by_date;
  }
  return out;
}

const mondayOf = (d) => { const x = new Date(`${d}T12:00:00Z`); return addDays(d, -((x.getUTCDay() + 6) % 7)); };
const mean = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

/** Weekly and monthly means of the logged weights (missing days simply don't count). Oldest first. */
export function weightTrend(entries) {
  const w = entries.filter((e) => typeof e.weight_kg === "number");
  const group = (key) => { const m = new Map(); for (const e of w) { const k = key(e.on_date); m.set(k, [...(m.get(k) ?? []), e.weight_kg]); }
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, xs]) => ({ from: k, mean: mean(xs), n: xs.length })); };
  return { weekly: group(mondayOf), monthly: group((d) => `${d.slice(0, 7)}-01`) };
}

/** The GP line: a calorie target under 1200, or > 1 kg a week down for three consecutive weeks (weekly means). */
export function gpLine(goal, weekly) {
  if (goal?.kcal_day !== undefined && goal.kcal_day < KCAL_FLOOR) return true;
  let run = 0;
  for (let i = 1; i < weekly.length; i++) {
    const consecutive = addDays(weekly[i - 1].from, 7) === weekly[i].from;
    run = consecutive && weekly[i - 1].mean - weekly[i].mean > FAST_LOSS_KG_PER_WEEK ? run + 1 : 0;
    if (run >= FAST_LOSS_WEEKS) return true;
  }
  return false;
}
