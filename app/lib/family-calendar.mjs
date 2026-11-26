/**
 * «Календарь» week and month views (bus 172 P2, mockup v5). Pure; tested in tests/family-calendar.test.mjs.
 *
 * Data: the service's /calendar — councils, family events and the birthdays this viewer may see, from today for the
 * next N days (it has no past and no per-person events). Days outside that window are shown as "no data", never as
 * an empty day.
 */
export const addDays = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
/** 0 = Monday … 6 = Sunday. */
export const weekdayMon = (d) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
export const mondayOf = (d) => addDays(d, -weekdayMon(d));
export const weekOf = (d) => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(d), i));
/** The 6×7 grid of a month ("YYYY-MM"): from the Monday on or before the 1st, 42 days. */
export function monthGrid(ym) {
  const start = mondayOf(`${ym}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
export const monthOf = (d) => d.slice(0, 7);
export function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number), k = y * 12 + (m - 1) + n;
  return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
}

/** Items grouped by date, each day sorted: no-time items first (all day), then by time. */
export function byDay(items) {
  const m = new Map();
  for (const i of items ?? []) m.set(i.date, [...(m.get(i.date) ?? []), i]);
  for (const [, list] of m) list.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  return m;
}

/** Month cell: up to `max` chips, then «+N ещё». */
export function chips(list, max = 3) {
  const all = list ?? [];
  return { shown: all.slice(0, max), more: Math.max(0, all.length - max) };
}

/** The window the service answered for: [today, today + days − 1]. */
export const inWindow = (d, today, days) => d >= today && d <= addDays(today, days - 1);

/** Months the month view may show: the months that touch the window. */
export function monthsInWindow(today, days) {
  const first = monthOf(today), last = monthOf(addDays(today, days - 1)), out = [first];
  while (out[out.length - 1] !== last) out.push(addMonths(out[out.length - 1], 1));
  return out;
}
/** Weeks (their Mondays) the week view may show. */
export function weeksInWindow(today, days) {
  const out = [mondayOf(today)], last = mondayOf(addDays(today, days - 1));
  while (out[out.length - 1] < last) out.push(addDays(out[out.length - 1], 7));
  return out;
}

/** The hour grid: 08–22 by default, widened to fit any timed item of the week. */
export function hourRange(items, H0 = 8, H1 = 22) {
  let a = H0, b = H1;
  for (const i of items ?? []) if (i.time) { const h = Number(i.time.slice(0, 2)); a = Math.min(a, h); b = Math.max(b, Math.min(24, h + 1)); }
  return [a, b];
}
/** Minutes from the top of the grid for "HH:MM". */
export const minutesFrom = (hhmm, H0) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) - H0 * 60;
