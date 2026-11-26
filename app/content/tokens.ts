// Display-only localisation for the canonical enum tokens that live English-only
// in the public JSON projections (registry.public.json / federation.public.json):
// layer/participation statuses, federation roles, organisation tiers, and the
// privacy bands.
//
// IMPORTANT: these are DISPLAY labels only. The raw English token stays the
// source of truth and must remain what drives any logic (e.g. the StatusPill /
// RolePill colour regexes, the Band zero-check). Translate at the point of
// rendering by passing the raw value to the logic and the localised label to the
// text — never translate the value the logic reads.
//
//   <StatusPill value={raw} label={statusLabel(lang, raw)} />
//
// One dictionary, one casing (cycle 5 #4–5): every map below is lowercase, and every label
// function returns sentence case in both languages — "Producer / steward", «Школа», «Кампус».
// EN passes the raw token through (lowercased, then sentence-cased), so the JSON's mixed
// casing ("SCHOOL", "Producer / Steward", "Planned") never reaches the page as-is.

import type { Lang } from "../components/useLang";

const RU_STATUS: Record<string, string> = {
  live: "активно",
  active: "активно",
  draft: "черновик",
  pending: "ожидается",
  planned: "план",
  connected: "подключено",
  off: "отключено",
  retiring: "выводится",
  retired: "упразднено",
  consumed: "потребляется",
  anchored: "закреплено",
  producer: "производитель",
  steward: "стюард",
  "producer / steward": "производитель / стюард",
  "geo-anchored": "гео-привязка",
};

const RU_ROLE: Record<string, string> = {
  authority: "авторитет",
  consumer: "потребитель",
  producer: "производитель",
  steward: "стюард",
  "producer / steward": "производитель / стюард",
  planned: "планируется",
  retired: "упразднён",
};

const RU_TIER: Record<string, string> = {
  authority: "авторитет",
  foundation: "фонд",
  school: "школа",
  venue: "площадка",
  campus: "кампус",
};

// Canonical-layer kind column (service · registry · contract).
const RU_KIND: Record<string, string> = {
  service: "служба",
  registry: "реестр",
  contract: "контракт",
};

// Project type label (shown when a project has no external URL).
const RU_TYPE: Record<string, string> = {
  project: "проект",
  "future-module": "будущий модуль",
};

const RU_LAYER_KEY: Record<string, string> = {
  identity: "идентичность",
  geography: "география",
  organisation: "организация",
  campus: "кампус",
  events: "события",
  audit: "аудит",
};

// Privacy bands: only the textual "Active" band is localised; numeric bands
// (0 · 5–9 · 10–19 · 20+) are universal and pass through unchanged.
const RU_BAND: Record<string, string> = {
  active: "активно",
};

// EN display forms where the raw token is not readable as-is.
const EN_DISPLAY: Record<string, string> = {
  "future-module": "future module",
};

const sentence = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

function lookup(map: Record<string, string>, lang: Lang, value?: string): string | undefined {
  if (value == null) return value;
  const key = value.toLowerCase();
  return sentence(lang === "EN" ? (EN_DISPLAY[key] ?? key) : (map[key] ?? key));
}

/**
 * Localise the "KARTEL Core" brand token inside a data string (e.g. the layer
 * Owner / Steward columns) on RU. EN and other tokens pass through unchanged.
 * "KARTEL Core" the canonical brand is rendered "Ядро KARTEL" on the RU site.
 */
export const coreName = (lang: Lang, value?: string) =>
  lang === "RU" && value ? value.replace("KARTEL Core", "Ядро KARTEL") : value;

export const statusLabel = (lang: Lang, value?: string) => lookup(RU_STATUS, lang, value);
export const roleLabel = (lang: Lang, value?: string) => lookup(RU_ROLE, lang, value);
export const kindLabel = (lang: Lang, value?: string) => lookup(RU_KIND, lang, value);
export const typeLabel = (lang: Lang, value?: string) => lookup(RU_TYPE, lang, value);
export const tierLabel = (lang: Lang, value?: string) => lookup(RU_TIER, lang, value);
export const layerKeyLabel = (lang: Lang, value: string) => lookup(RU_LAYER_KEY, lang, value) ?? value;
export const bandLabel = (lang: Lang, value?: string) => lookup(RU_BAND, lang, value);
