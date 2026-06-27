import type { MetadataRoute } from "next";
import registry from "./content/registry.public.json";

const BASE = "https://kartel.org.uk";

// Content-revision date, sourced from the registry projection's `updated` field
// so the sitemap tracks the last governance/content change instead of a manual
// constant that silently goes stale. Still deterministic across builds (it only
// moves when registry.public.json is regenerated), so it does not churn on every
// deploy and mislead crawlers.
const now = new Date(registry.updated);

export default function sitemap(): MetadataRoute.Sitemap {
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
      url: `${BASE}/en/registry`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: {
        languages: { en: `${BASE}/en/registry`, ru: `${BASE}/ru/registry`, "x-default": `${BASE}/en/registry` },
      },
    },
    {
      url: `${BASE}/ru/registry`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: {
        languages: { en: `${BASE}/en/registry`, ru: `${BASE}/ru/registry`, "x-default": `${BASE}/en/registry` },
      },
    },
    {
      url: `${BASE}/en/registry/organisations`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: {
          en: `${BASE}/en/registry/organisations`,
          ru: `${BASE}/ru/registry/organisations`,
          "x-default": `${BASE}/en/registry/organisations`,
        },
      },
    },
    {
      url: `${BASE}/ru/registry/organisations`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: {
          en: `${BASE}/en/registry/organisations`,
          ru: `${BASE}/ru/registry/organisations`,
          "x-default": `${BASE}/en/registry/organisations`,
        },
      },
    },
    {
      url: `${BASE}/en/registry/campuses`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: {
          en: `${BASE}/en/registry/campuses`,
          ru: `${BASE}/ru/registry/campuses`,
          "x-default": `${BASE}/en/registry/campuses`,
        },
      },
    },
    {
      url: `${BASE}/ru/registry/campuses`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: {
          en: `${BASE}/en/registry/campuses`,
          ru: `${BASE}/ru/registry/campuses`,
          "x-default": `${BASE}/en/registry/campuses`,
        },
      },
    },
    {
      url: `${BASE}/en/registry/federation`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: {
          en: `${BASE}/en/registry/federation`,
          ru: `${BASE}/ru/registry/federation`,
          "x-default": `${BASE}/en/registry/federation`,
        },
      },
    },
    {
      url: `${BASE}/ru/registry/federation`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: {
          en: `${BASE}/en/registry/federation`,
          ru: `${BASE}/ru/registry/federation`,
          "x-default": `${BASE}/en/registry/federation`,
        },
      },
    },
    {
      url: `${BASE}/en/family/crest`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: {
        languages: { en: `${BASE}/en/family/crest`, ru: `${BASE}/ru/family/crest`, "x-default": `${BASE}/en/family/crest` },
      },
    },
    {
      url: `${BASE}/ru/family/crest`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: {
        languages: { en: `${BASE}/en/family/crest`, ru: `${BASE}/ru/family/crest`, "x-default": `${BASE}/en/family/crest` },
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
