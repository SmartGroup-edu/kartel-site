// Recurring routines and chores (plan v3.8 §3.4, Stage 2). Pure, unit-tested in routines.test.mjs.
//
// A small RFC 5545 RRULE subset — what the family actually uses, nothing that can surprise:
//   FREQ=DAILY[;INTERVAL=n]                       every day / every n days
//   FREQ=WEEKLY[;INTERVAL=n];BYDAY=MO,WE,FR       chosen weekdays, every n weeks (weeks start Monday)
//   FREQ=MONTHLY[;INTERVAL=n];BYMONTHDAY=d        day d of the month (a month without day d is skipped)
// Dates are plain "YYYY-MM-DD" in the family's time zone; occurrences are computed, not stored.
// Stage 3 (planner) will materialise 14 days ahead; until then nothing here needs a table.

export const FAMILY_TZ = "Europe/London";
const DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400_000;
const fromDay = (n) => new Date(n * 86400_000).toISOString().slice(0, 10);
const weekday = (s) => (new Date(toDay(s) * 86400_000).getUTCDay() + 6) % 7; // 0 = Monday

/** Today's date in the family time zone (or another IANA zone). */
export function localDate(now = new Date(), tz = FAMILY_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date, n) { return fromDay(toDay(date) + n); }

/** Parse the supported subset; anything else → null (the API refuses it). */
export function parseRule(rrule) {
  if (typeof rrule !== "string" || rrule.length > 120) return null;
  const parts = Object.fromEntries(rrule.split(";").map((kv) => kv.split("=")));
  const keys = Object.keys(parts);
  const interval = parts.INTERVAL === undefined ? 1 : Number(parts.INTERVAL);
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) return null;
  if (parts.FREQ === "DAILY" && keys.every((k) => ["FREQ", "INTERVAL"].includes(k))) return { freq: "DAILY", interval };
  if (parts.FREQ === "WEEKLY" && keys.every((k) => ["FREQ", "INTERVAL", "BYDAY"].includes(k))) {
    const byday = (parts.BYDAY ?? "").split(",").filter(Boolean);
    if (byday.length === 0 || byday.some((d) => !DAYS.includes(d)) || new Set(byday).size !== byday.length) return null;
    return { freq: "WEEKLY", interval, byday: byday.map((d) => DAYS.indexOf(d)).sort() };
  }
  if (parts.FREQ === "MONTHLY" && keys.every((k) => ["FREQ", "INTERVAL", "BYMONTHDAY"].includes(k))) {
    const d = Number(parts.BYMONTHDAY);
    if (!Number.isInteger(d) || d < 1 || d > 31) return null;
    return { freq: "MONTHLY", interval, bymonthday: d };
  }
  return null;
}

/** Is `date` an occurrence of `rule` that started on `dtstart`? */
export function occursOn(rule, dtstart, date) {
  if (!rule || !DATE_RE.test(dtstart) || !DATE_RE.test(date) || date < dtstart) return false;
  if (rule.freq === "DAILY") return (toDay(date) - toDay(dtstart)) % rule.interval === 0;
  if (rule.freq === "WEEKLY") {
    if (!rule.byday.includes(weekday(date))) return false;
    const weeks = Math.floor((toDay(date) - weekday(date) - (toDay(dtstart) - weekday(dtstart))) / 7);
    return weeks % rule.interval === 0;
  }
  if (rule.freq === "MONTHLY") {
    if (Number(date.slice(8, 10)) !== rule.bymonthday) return false;
    const months = (Number(date.slice(0, 4)) - Number(dtstart.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(dtstart.slice(5, 7));
    return months % rule.interval === 0;
  }
  return false;
}

/** Occurrence dates in [from, to] (inclusive), at most `max`. */
export function occurrences(rule, dtstart, from, to, max = 60) {
  const out = [];
  for (let d = toDay(from > dtstart ? from : dtstart), end = toDay(to); d <= end && out.length < max; d++) {
    const s = fromDay(d);
    if (occursOn(rule, dtstart, s)) out.push(s);
  }
  return out;
}

/**
 * Gentle streak (plan §3.3 «мягкие серии»): how many scheduled occurrences in a row were done, counting
 * back from today. Today counts if it is done; if today is scheduled but not done yet, it is simply not
 * counted (the day is not over). A miss ends the streak — it is never shown as a failure.
 * @param {Set<string>} done dates marked done
 */
export function streak(rule, dtstart, done, today, lookbackDays = 400) {
  let n = 0;
  for (let i = 0; i <= lookbackDays; i++) {
    const d = addDays(today, -i);
    if (d < dtstart) break;
    if (!occursOn(rule, dtstart, d)) continue;
    if (done.has(d)) n++;
    else if (i === 0) continue;
    else break;
  }
  return n;
}
