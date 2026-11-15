// Per-locale share card: /en/opengraph-image and /ru/opengraph-image (cycle 7 #1). The RU pages'
// og:image and twitter:image point here, so a shared /ru link shows «Фамильный герб Картель».
import { renderOgCard, ogAlt, OG_SIZE, type OgLang } from "../lib/ogCard";

export const runtime = "nodejs";
export const alt = ogAlt("en");
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "ru" }];
}

export default async function OGImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return renderOgCard((lang === "ru" ? "ru" : "en") as OgLang);
}
