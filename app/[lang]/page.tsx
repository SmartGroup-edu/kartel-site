import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { preloadCrestFonts } from "../lib/crestFonts";
import { crestImgProps, HERO_SIZES } from "../components/crest/CrestChrome";
import { ogAlt, ogImagePath } from "../lib/ogCard";
import CrestHome from "../components/crest/CrestHome";
import { CREST_META, crestFaqPlain, crestHomeContent, type CrestLang } from "../content/crestHome";

// HOME = the coat of arms page and nothing else (bus 176 P1, R0 2026-11-27; mockup
// bus/assets/2026-11-27-home-crest-v6-APPROVED.html). No business, family-office, project or people information here:
// KARTEL Core, the registry and the family area are behind the family sign-in (proxy.ts). Public and indexable; the
// search-facing JSON-LD is the mockup's ImageObject + FAQPage. Never imports app/content/family-private.ts.
// /{lang}/family/crest → 308 here (next.config.ts redirects).

const LOCALES = ["en", "ru"] as const;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export const viewport: Viewport = { themeColor: "#0a0908", colorScheme: "dark" };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!LOCALES.includes(lang as CrestLang)) notFound();
  const m = CREST_META[lang as CrestLang];
  // The share card is the generated crest card (app/lib/ogCard.tsx), RU on its own URL.
  const image = { url: ogImagePath(lang), width: 1200, height: 630, alt: ogAlt(lang === "ru" ? "ru" : "en"), type: "image/png" };
  return {
    title: { absolute: m.title },
    description: m.description,
    keywords: m.keywords,
    openGraph: {
      type: "website",
      locale: lang === "ru" ? "ru_RU" : "en_GB",
      alternateLocale: lang === "ru" ? ["en_GB"] : ["ru_RU"],
      siteName: "KARTEL",
      title: m.title,
      description: m.ogDescription,
      url: `https://kartel.org.uk/${lang}`,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: m.title, description: m.ogDescription, images: [{ url: image.url, alt: image.alt }] },
    alternates: {
      canonical: `https://kartel.org.uk/${lang}`,
      languages: { en: "https://kartel.org.uk/en", ru: "https://kartel.org.uk/ru", "x-default": "https://kartel.org.uk/en" },
    },
  };
}

/** The mockup's structured data: the crest as an ImageObject, and the visible FAQ as a FAQPage. */
function structuredData(lang: CrestLang) {
  const m = CREST_META[lang];
  return [
    { "@context": "https://schema.org", "@type": "ImageObject", "name": m.imageName, "contentUrl": "https://kartel.org.uk/crest.jpeg", "caption": m.imageCaption, "description": m.imageDescription },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": crestFaqPlain[lang].map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
    },
  ];
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as CrestLang)) notFound();
  preloadCrestFonts(lang as CrestLang);
  // The hero crest (the LCP element), fetched from the <head> at high priority — the same srcset entry the <img> picks.
  const hero = crestImgProps({ sizes: HERO_SIZES, lcp: true });
  preload(hero.src, { as: "image", imageSrcSet: hero.srcSet, imageSizes: hero.sizes, fetchPriority: "high" });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(lang as CrestLang)) }} />
      <CrestHome lang={lang as CrestLang} content={crestHomeContent(lang as CrestLang)} />
    </>
  );
}
