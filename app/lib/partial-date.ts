/**
 * Partial dates from the family editor: "YYYY", "YYYY-MM" or "YYYY-MM-DD". Shown as written —
 * a year stays a year — in the page language. Pure, so it is unit-tested.
 */
export function formatPartialDate(value: string, lang: "EN" | "RU"): string {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value ?? "");
  if (!m) return "";
  const [, y, mo, d] = m;
  if (!mo) return y;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, d ? Number(d) : 1));
  const locale = lang === "EN" ? "en-GB" : "ru-RU";
  const opts: Intl.DateTimeFormatOptions = d ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" };
  // RU month-year uses the nominative ("февраль 1955"); drop the trailing "г." Intl adds.
  return new Intl.DateTimeFormat(locale, opts).format(date).replace(/\s*г\.$/, "");
}

export function formatDateRange(from: string, to: string, lang: "EN" | "RU"): string {
  const a = formatPartialDate(from, lang), b = formatPartialDate(to, lang);
  return a && b ? `${a} — ${b}` : a || b;
}
