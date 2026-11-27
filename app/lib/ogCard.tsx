// The share card (1200×630) for every page, EN and RU (cycle 7 #1). Rendered at build time by
// app/opengraph-image.tsx (EN, the long-standing URL) and app/[lang]/opengraph-image.tsx.
// Crest full height on the left; wordmark, headline, motto and domain on the right, sized to
// stay legible as a 400px feed thumbnail. No family names — the crest and the surname only.
// bus 176 P1 (R0 2026-11-27): the public site is the coat of arms only, so the card names the coat of arms — no
// family-office or business wording on anything a visitor sees, share cards included.
import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const OG_SIZE = { width: 1200, height: 630 };

const COPY = {
  en: { headline: ["The Kartel", "Coat of Arms"], motto: "Virtus et Potestas", translation: "Strength and Power", alt: "The Kartel coat of arms. Virtus et Potestas — Strength and Power." },
  ru: { headline: ["Фамильный герб", "Картель"], motto: "Virtus et Potestas", translation: "Сила и Власть", alt: "Фамильный герб Картель. Virtus et Potestas — Сила и Власть." },
} as const;

export type OgLang = keyof typeof COPY;
export const ogAlt = (lang: OgLang) => COPY[lang].alt;
/** og:image / twitter:image path for a page in `lang`: EN stays on the long-standing URL. */
export const ogImagePath = (lang: string) => (lang === "ru" ? "/ru/opengraph-image" : "/opengraph-image");

const ACCENT = "#7b1e2d";
const INK = "#2b2824";
const MUTED = "#6f685c";

export async function renderOgCard(lang: OgLang): Promise<ImageResponse> {
  const c = COPY[lang];
  const file = (p: string) => readFile(join(process.cwd(), p));
  const [crest, regular, semibold, italic] = await Promise.all([
    file("public/crest.jpeg"),
    file("app/og-fonts/SourceSerif4-Regular.ttf"),
    file("app/og-fonts/SourceSerif4-SemiBold.ttf"),
    file("app/og-fonts/SourceSerif4-Italic.ttf"),
  ]);
  const crestSrc = `data:image/jpeg;base64,${crest.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: "#ffffff", fontFamily: "Source Serif 4", padding: "45px 64px 45px 48px", alignItems: "center" }}>
        {/* Crest: 540px tall (900×1000 source). next/og renders plain <img> only (no next/image). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={crestSrc} alt="" width={486} height={540} style={{ objectFit: "contain", flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginLeft: 56, flex: 1, height: "100%" }}>
          <div style={{ display: "flex", fontSize: 40, letterSpacing: "0.12em", color: ACCENT }}>KARTEL</div>
          <div style={{ display: "flex", width: 96, height: 3, backgroundColor: ACCENT, marginTop: 22, marginBottom: 26 }} />
          {/* Explicit lines: an automatic wrap split the headline mid-phrase. */}
          <div style={{ display: "flex", flexDirection: "column", fontSize: lang === "ru" ? 62 : 68, fontWeight: 600, lineHeight: 1.08, color: INK }}>
            {c.headline.map((line) => (
              <div key={line} style={{ display: "flex" }}>{line}</div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
            <div style={{ display: "flex", fontSize: 38, fontStyle: "italic", color: ACCENT, lineHeight: 1.2 }}>{c.motto} —</div>
            <div style={{ display: "flex", fontSize: 38, fontStyle: "italic", color: ACCENT, lineHeight: 1.2 }}>{c.translation}</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED, letterSpacing: "0.04em", marginTop: 36 }}>kartel.org.uk</div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Source Serif 4", data: regular, weight: 400, style: "normal" },
        { name: "Source Serif 4", data: semibold, weight: 600, style: "normal" },
        { name: "Source Serif 4", data: italic, weight: 400, style: "italic" },
      ],
    },
  );
}
