/**
 * Partial dates from the family editor: "YYYY", "YYYY-MM" or "YYYY-MM-DD". Shown as written —
 * a year stays a year — in the page language. Pure, so it is unit-tested.
 */
/**
 * @param {string} value
 * @param {"EN" | "RU"} lang
 * @returns {string}
 */
export function formatPartialDate(value, lang) {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value ?? "");
  if (!m) return "";
  const [, y, mo, d] = m;
  if (!mo) return y;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, d ? Number(d) : 1));
  const locale = lang === "EN" ? "en-GB" : "ru-RU";
  /** @type {Intl.DateTimeFormatOptions} */
  const opts = d ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" };
  // RU month-year uses the nominative ("февраль 1955"); drop the trailing "г." Intl adds.
  return new Intl.DateTimeFormat(locale, opts).format(date).replace(/\s*г\.$/, "");
}

/**
 * @param {string} from
 * @param {string} to
 * @param {"EN" | "RU"} lang
 * @returns {string}
 */
export function formatDateRange(from, to, lang) {
  const a = formatPartialDate(from, lang), b = formatPartialDate(to, lang);
  return a && b ? `${a} — ${b}` : a || b;
}
