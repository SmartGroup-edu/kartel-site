/**
 * Labels for Family OS routines and chores (Stage 2). Pure; tested in tests/family-routines.test.mjs.
 * The service accepts an RRULE subset (family-os/recur.mjs); the add form only builds those shapes.
 */
const DAY = {
  EN: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  RU: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
};
export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/** Russian plural: 1 раз, 2 раза, 5 раз. */
export function ruPlural(n, [one, few, many]) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
}

/** "FREQ=WEEKLY;BYDAY=MO,WE" → "Mon, Wed" / «Пн, Ср». Unknown shapes fall back to the raw rule. */
export function describeRule(rrule, lang) {
  const p = Object.fromEntries(String(rrule ?? "").split(";").map((kv) => kv.split("=")));
  const n = Number(p.INTERVAL ?? 1);
  const ru = lang === "RU";
  if (p.FREQ === "DAILY") return n === 1 ? (ru ? "Каждый день" : "Every day") : ru ? `Раз в ${n} ${ruPlural(n, ["день", "дня", "дней"])}` : `Every ${n} days`;
  if (p.FREQ === "WEEKLY" && p.BYDAY) {
    const days = p.BYDAY.split(",");
    const set = days.join(",");
    const list = set === "MO,TU,WE,TH,FR" ? (ru ? "По будням" : "Weekdays") : set === "SA,SU" ? (ru ? "По выходным" : "Weekends") : set === WEEKDAYS.join(",") ? (ru ? "Каждый день" : "Every day")
      : days.map((d) => DAY[lang][WEEKDAYS.indexOf(d)]).join(", ");
    return n === 1 ? list : ru ? `Раз в ${n} ${ruPlural(n, ["неделю", "недели", "недель"])}: ${list}` : `Every ${n} weeks: ${list}`;
  }
  if (p.FREQ === "MONTHLY" && p.BYMONTHDAY) {
    const d = Number(p.BYMONTHDAY);
    if (ru) return n === 1 ? `Каждый месяц, ${d}-го` : `Раз в ${n} ${ruPlural(n, ["месяц", "месяца", "месяцев"])}, ${d}-го`;
    return n === 1 ? `Monthly on day ${d}` : `Every ${n} months on day ${d}`;
  }
  return String(rrule ?? "");
}

/**
 * Gentle streak text (plan §3.3): only a run of 2 or more is mentioned, never a miss.
 * "3 times in a row" / «3 раза подряд».
 */
export function streakText(n, lang) {
  if (!Number.isInteger(n) || n < 2) return "";
  return lang === "RU" ? `${n} ${ruPlural(n, ["раз", "раза", "раз"])} подряд` : `${n} times in a row`;
}

/** The add form's schedule choice → RRULE. */
export function buildRule({ repeat, days, interval, monthDay }) {
  const n = Math.max(1, Math.min(52, Number(interval) || 1));
  const iv = n > 1 ? `;INTERVAL=${n}` : "";
  if (repeat === "daily") return `FREQ=DAILY${iv}`;
  if (repeat === "weekdays") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  if (repeat === "weekly") {
    const picked = WEEKDAYS.filter((d) => (days ?? []).includes(d));
    return picked.length ? `FREQ=WEEKLY${iv};BYDAY=${picked.join(",")}` : null;
  }
  if (repeat === "monthly") { const d = Number(monthDay); return d >= 1 && d <= 31 ? `FREQ=MONTHLY${iv};BYMONTHDAY=${d}` : null; }
  return null;
}
