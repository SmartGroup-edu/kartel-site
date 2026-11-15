// EN share card at the long-standing /opengraph-image URL (social caches already hold it).
// Layout and copy live in app/lib/ogCard.tsx; the RU card is app/[lang]/opengraph-image.tsx.
import { renderOgCard, ogAlt, OG_SIZE } from "./lib/ogCard";

export const runtime = "nodejs";
export const alt = ogAlt("en");
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OGImage() {
  return renderOgCard("en");
}
