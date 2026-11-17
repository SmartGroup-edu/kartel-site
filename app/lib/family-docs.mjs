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
