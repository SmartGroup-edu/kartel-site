import "server-only";

// «Компании и проекты» beyond the public registry (bus 176 P3, R0 2026-11-27): Craft Resin, Eco Lock HD and KARTEL.
// SERVER-ONLY and cabinet-only: never in the public registry, a public page, llms.txt or a client chunk
// (tests/family-companies.test.mjs scans the build). Importing this from a client component fails the build.
//
// Source: KARTEL-Vault 10-Projects/{craft-resin,eco-lock-hd,kartel-org-uk}, read-only — PROJECT_STATE.md
// (`status`, `updated`, `runtime_state`) and Context.md (`production-url`, the one-paragraph state). Only what is
// recorded there; a value the Vault does not record is left out (Craft Resin: no website is recorded). No figures.
// `recorded` is the PROJECT_STATE `updated` date: when the Vault last recorded the project's state.

export type PrivateCompany = {
  key: string;
  name: string;
  lead: { EN: string; RU: string };
  status: "active";
  url: string | null;
  recorded: string;
};

export const PRIVATE_COMPANIES: PrivateCompany[] = [
  {
    key: "kartel-org-uk",
    name: "KARTEL",
    lead: {
      EN: "The kartel.org.uk site, the family area and the ecosystem's governance.",
      RU: "Сайт kartel.org.uk, семейный кабинет и управление экосистемой.",
    },
    status: "active",
    url: "https://kartel.org.uk",
    recorded: "2026-11-26",
  },
  {
    key: "craft-resin",
    name: "Craft Resin",
    lead: {
      EN: "Resin art products: Shopify shops (UK, US, EU) and Amazon (US, UK).",
      RU: "Смола для творчества: магазины на Shopify (UK, US, EU) и Amazon (US, UK).",
    },
    status: "active",
    url: null,
    recorded: "2026-10-04",
  },
  {
    key: "eco-lock-hd",
    name: "Eco Lock HD",
    lead: {
      EN: "Keeps mulch and stone in place in landscaping: the ecolockhd.com shop.",
      RU: "Закрепление мульчи и камня в ландшафте: магазин ecolockhd.com.",
    },
    status: "active",
    url: "https://ecolockhd.com",
    recorded: "2026-10-04",
  },
];
