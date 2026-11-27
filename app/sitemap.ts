import type { MetadataRoute } from "next";

const BASE = "https://kartel.org.uk";

// bus 176 P1 (R0 2026-11-27): the public site is the coat of arms page, in English and Russian. Everything else —
// KARTEL Core, the registry, the family area — is behind the family sign-in and answers 307, and a redirecting URL in
// a sitemap hurts indexing, so only the two home pages are listed. The sign-in page is noindex and is not listed.
// Fixed content-revision date (the approved crest page), so the sitemap does not churn on every deploy.
const updated = new Date("2026-11-27");
const languages = { en: `${BASE}/en`, ru: `${BASE}/ru`, "x-default": `${BASE}/en` };

export default function sitemap(): MetadataRoute.Sitemap {
  return (["en", "ru"] as const).map((lang) => ({
    url: `${BASE}/${lang}`,
    lastModified: updated,
    changeFrequency: "monthly",
    priority: 1.0,
    alternates: { languages },
  }));
}
