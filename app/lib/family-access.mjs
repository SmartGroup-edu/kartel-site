/**
 * Admin access screen rules (bus 74 #4). Pure; tested in tests/family-routines.test.mjs.
 * Giving health or documents is high impact → a two-step confirm. Removing is one step (and undoable).
 */
export const SENSITIVE_SCOPES = ["health", "documents"];

/** Sensitive scopes present in `next` but not in `prev` (order as in SENSITIVE_SCOPES). */
export function addedSensitive(prev, next) {
  return SENSITIVE_SCOPES.filter((s) => (next ?? []).includes(s) && !(prev ?? []).includes(s));
}

const RU = { health: "здоровью", documents: "документам" };
const EN = { health: "health", documents: "documents" };

/** «QA Родственник: дать доступ к здоровью и документам ребёнка?» / "QA Relative: give access to the child's health and documents?" */
export function confirmGrantText(scopes, guardianName, lang) {
  if (!scopes.length) return "";
  if (lang === "EN") return `${guardianName}: give access to the child's ${scopes.map((s) => EN[s]).join(" and ")}?`;
  return `${guardianName}: дать доступ к ${scopes.map((s) => RU[s]).join(" и ")} ребёнка?`;
}
