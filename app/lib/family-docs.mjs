/** Pure helpers for Family OS documents (Stage 2a). Tested in tests/family-docs.test.mjs. */

/** Whole years between a YYYY-MM-DD birth date and `on`. */
export function ageOn(birth, on) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth ?? "");
  if (!m) return null;
  const y = on.getUTCFullYear(), mo = on.getUTCMonth() + 1, d = on.getUTCDate();
  let a = y - Number(m[1]);
  if (mo < Number(m[2]) || (mo === Number(m[2]) && d < Number(m[3]))) a--;
  return a >= 0 ? a : null;
}

/** "expired" | "soon" (≤ 183 days) | "ok" | null (no date) */
export function expiryState(expiry, on) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry ?? "")) return null;
  const days = (Date.parse(`${expiry}T00:00:00Z`) - Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate())) / 86400_000;
  return days < 0 ? "expired" : days <= 183 ? "soon" : "ok";
}

/** "•••• 567" — never more than the last three characters. */
export function maskNumber(hint) {
  return `•••• ${String(hint ?? "").slice(-3)}`.trim();
}

/**
 * Document type labels — one place for the person page, Today and the add form (bus 68 #2).
 * RU labels are Russian; a Latin official name may appear only in parentheses. EN labels have no
 * Cyrillic. Tested in tests/family-docs.test.mjs.
 */
/** One date style for Family OS (bus 69 L2): "31 января 2027" / "31 January 2027" — no «г.». */
export function fmtDocDate(d, lang) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? "")) return "";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).replace(/\s*г\.$/, "");
}

/**
 * Family OS dates outside documents (bus 80 #7): no year when it is the current year («до 29 ноября»),
 * the year otherwise. Documents keep fmtDocDate (always with the year).
 */
export function fmtFamilyDate(d, lang, today = new Date().toISOString().slice(0, 10)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? "")) return "";
  if (d.slice(0, 4) !== String(today).slice(0, 4)) return fmtDocDate(d, lang);
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}

/** «16–18 ноября» · «30 ноября – 6 декабря» · «28 декабря 2026 – 3 января 2027» (bus 80 #6). */
export function fmtWeekRange(from, to, lang) {
  const loc = lang === "EN" ? "en-GB" : "ru-RU";
  const f = (d, o) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc, { ...o, timeZone: "UTC" }).replace(/\s*г\.$/, "");
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${f(from, { day: "numeric", month: "long", year: "numeric" })} – ${f(to, { day: "numeric", month: "long", year: "numeric" })}`;
  if (from.slice(0, 7) !== to.slice(0, 7)) return `${f(from, { day: "numeric", month: "long" })} – ${f(to, { day: "numeric", month: "long" })}`;
  if (from === to) return f(from, { day: "numeric", month: "long" });
  return lang === "EN" ? `${Number(from.slice(8))}–${f(to, { day: "numeric", month: "long" })}` : `${Number(from.slice(8))}–${f(to, { day: "numeric", month: "long" })}`;
}

export const DOC_LABELS = {
  EN: {
    passport: "Passport", national_id: "National ID / personal code", ni_number: "National Insurance number",
    residence: "EU Settlement status", other: "Other document",
  },
  RU: {
    passport: "Паспорт", national_id: "Удостоверение личности / личный код", ni_number: "Номер социального страхования (National Insurance)",
    residence: "Статус проживания (EU Settlement)", other: "Другой документ",
  },
};

export const REVEAL_MS = 30_000;

/**
 * Hide-again timer for a revealed number (bus 68 #1): hides after `ms`, at once when the tab is
 * hidden, and on demand. Timers are injectable for tests.
 */
export function createRevealTimer({ ms = REVEAL_MS, onHide, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let h = null, shown = false;
  const hide = () => { if (h) { clearTimer(h); h = null; } if (shown) { shown = false; onHide(); } };
  return {
    reveal() { if (h) clearTimer(h); shown = true; h = setTimer(hide, ms); },
    visibility(hidden) { if (hidden) hide(); },
    hide,
    get shown() { return shown; },
  };
}
