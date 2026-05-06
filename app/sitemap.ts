import type { MetadataRoute } from "next";

const BASE = "https://kartel.org.uk";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${BASE}/en`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1.0,
      alternates: {
        languages: {
          en: `${BASE}/en`,
          ru: `${BASE}/ru`,
          "x-default": `${BASE}/en`,
        },
      },
    },
    {
      url: `${BASE}/ru`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1.0,
      alternates: {
        languages: {
          en: `${BASE}/en`,
          ru: `${BASE}/ru`,
          "x-default": `${BASE}/en`,
        },
      },
    },
    {
      url: `${BASE}/en/family`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: {
        languages: {
          en: `${BASE}/en/family`,
          ru: `${BASE}/ru/family`,
          "x-default": `${BASE}/en/family`,
        },
      },
    },
    {
      url: `${BASE}/ru/family`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: {
        languages: {
          en: `${BASE}/en/family`,
          ru: `${BASE}/ru/family`,
          "x-default": `${BASE}/en/family`,
        },
      },
    },
    {
      url: `${BASE}/llms.txt`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE}/llms-full.txt`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
