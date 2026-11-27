import { preload } from "react-dom";

/** bus 176 P1b: the crest faces — Playfair Display (headings 600/700, the motto italic 500) and Manrope (text) — built by
 *  scripts/build-crest-fonts.py. Declared per page language, so the fonts fetched before the hero crest (LCP) stay small:
 *  - the cyrillic files also carry the punctuation, digits and space of running text (CORE); on /ru they are declared
 *    after the latin ones, so they win the shared characters and a Russian page needs no Latin file for its spaces;
 *  - on /en the cyrillic faces cover Cyrillic letters only (an English page never fetches Cyrillic for a space);
 *  - on /ru, «KARTEL» and the Roman numerals come from a 3 KB mark file, not the 30 KB Latin Playfair; the motto
 *    «Virtus et Potestas» (the only italic on the crest pages) comes from a 2 KB mark file on every page.
 *  Later rules win overlapping characters (CSS Fonts 4 §4.5), so the marks are declared last. */
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const CYRILLIC = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116";
const CORE = "U+0020-0040, U+005B-0060, U+007B-007E, U+00A0, U+00A9, U+00AB, U+00B7, U+00BB, U+00D7, U+2010-2014, U+2018-201E, U+2022, U+2026, U+2039-203A, U+2190-2193, U+2212";
const MARK = "U+0041, U+0045, U+0049, U+004B-004C, U+0052, U+0054, U+0056, U+0058"; // A E I K L R T V X
const MOTTO = "U+0020, U+0050, U+0056, U+0061, U+0065, U+0069, U+006F, U+0072-0075"; // Virtus et Potestas

type Face = [family: string, style: "normal" | "italic", weight: string, file: string, range: string];

function faces(lang: "en" | "ru"): Face[] {
  const ru = lang === "ru";
  const cyr = ru ? `${CYRILLIC}, ${CORE}` : CYRILLIC;
  return [
    ["Manrope", "normal", "300 700", "manrope-latin-v2", LATIN],
    ["Manrope", "normal", "300 700", "manrope-cyrillic-v2", cyr],
    ["Playfair Display", "normal", "600 700", "playfair-latin-v2", LATIN],
    ["Playfair Display", "normal", "600 700", "playfair-cyrillic-v2", cyr],
    ["Playfair Display", "italic", "500", "playfair-italic-latin-v2", LATIN],
    ["Playfair Display", "italic", "500", "playfair-italic-cyrillic-v2", cyr],
    ...(ru ? [["Playfair Display", "normal", "600 700", "playfair-mark-v2", MARK] as Face] : []),
    ["Playfair Display", "italic", "500", "playfair-italic-mark-v2", MOTTO],
  ];
}

/** The @font-face rules for a page in `lang` (rendered as a <style> in the document head). */
export function crestFontFaces(lang: "en" | "ru"): string {
  return faces(lang)
    .map(([family, style, weight, file, range]) => `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url("/fonts/${file}.woff2") format("woff2");unicode-range:${range}}`)
    .join("\n");
}

/** Preload only the two faces the first screen sets in the page's script: the text face and the H1 face. The marks,
 *  the italic and the other script load on demand through unicode-range, with font-display: swap. */
export function preloadCrestFonts(lang: "en" | "ru") {
  const script = lang === "ru" ? "cyrillic" : "latin";
  for (const f of [`manrope-${script}-v2`, `playfair-${script}-v2`]) preload(`/fonts/${f}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
}
