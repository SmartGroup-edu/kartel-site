/**
 * Keep an em dash from starting a line (design-pass polish 2026-11-15). A space before "—" becomes
 * a no-break space; a dash glued to the previous word gets a word joiner (U+2060) in front, which
 * removes the break opportunity UAX #14 allows before an em dash. Rendering only — content stays.
 */
export function noDashLineStart(text: string): string {
  return text.replace(/[ \t]+—/g, " —").replace(/([^\s ⁠])—/g, "$1⁠—");
}
