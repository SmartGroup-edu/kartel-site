/**
 * «Правила»: the three states of a rule (bus 157b D1) and the two service flags behind them. Pure, so the
 * mapping is tested on its own (tests/family-ui.test.mjs).
 * @typedef {"off" | "dry" | "send"} RuleMode
 */

/** @param {{ enabled: boolean, dry_run: boolean }} r @returns {RuleMode} */
export function ruleMode(r) {
  return !r.enabled ? "off" : r.dry_run ? "dry" : "send";
}

/**
 * The PATCH body for a state. «Выкл» also parks dry_run at true: re-enabling by the flag alone then lands in
 * «Пробный», never straight in live sending.
 * @param {RuleMode} mode
 * @returns {{ enabled: boolean, dry_run: boolean }}
 */
export function ruleBody(mode) {
  if (mode === "send") return { enabled: true, dry_run: false };
  if (mode === "dry") return { enabled: true, dry_run: true };
  return { enabled: false, dry_run: true };
}
