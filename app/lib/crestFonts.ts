import { preload } from "react-dom";

/** bus 176: preload only the two faces the first screen sets in the page's script — Manrope (text) and Playfair Display
 *  (the H1) — so they do not compete with the crest image for the LCP. The rest (the italic motto, the other script for
 *  the Latin wordmark) load on demand through unicode-range, with font-display: swap. */
export function preloadCrestFonts(lang: "en" | "ru") {
  const script = lang === "ru" ? "cyrillic" : "latin";
  for (const f of [`manrope-${script}`, `playfair-${script}`]) preload(`/fonts/${f}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
}
