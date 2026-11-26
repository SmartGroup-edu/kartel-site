// «Компании и проекты» in Family OS (bus 172 P6, mockup v5). Pure; tested in tests/family-companies.test.mjs.
// Cards from the vendored registry (registry.public.json) only: name, state, federation role, the per-layer status and
// the date the entry last changed. No sparklines: the registry is one snapshot (a version and a date), not a time
// series, and nothing else here holds a figure over time. Raw registry tokens stay raw here; the page localises them.

import { projectState } from "../content/publicHome.mjs";

const ORDER = { active: 0, retired: 1, planned: 2 };

/**
 * The last change the registry records for one entry: the highest «vNN (YYYY-MM-DD)» in its `note`
 * (the generator writes one per change, newest first). null when the entry carries no such note.
 * @param {{ note?: string }} p @returns {{ version: number, date: string } | null}
 */
export function lastChange(p) {
  let best = null;
  for (const m of String(p.note ?? "").matchAll(/\bv(\d+) \((\d{4}-\d{2}-\d{2})\)/g)) {
    const version = Number(m[1]);
    if (!best || version > best.version) best = { version, date: m[2] };
  }
  return best;
}

/**
 * One card per registry project: active first, then retired, then planned; registry order within each.
 * @param {{ projects: { key: string, name: string, type: string, url: string | null, role: string, layers?: Record<string, string | undefined>, summary?: string, note?: string }[] }} registry
 */
export function companyCards(registry) {
  return registry.projects
    .map((p, i) => ({ p, i, state: projectState(p) }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.i - b.i)
    .map(({ p, state }) => ({
      key: p.key,
      name: p.name,
      url: p.url ?? null,
      state,
      role: p.role,
      type: p.type,
      layers: Object.entries(p.layers ?? {}).map(([key, status]) => ({ key, status })),
      changed: lastChange(p),
    }));
}

/** The state counts for the line under the title: «2 работают · 1 упразднён · 1 в планах». Zero counts are left out. */
export function stateCounts(cards) {
  const n = { active: 0, retired: 0, planned: 0 };
  for (const c of cards) n[c.state]++;
  return Object.entries(n).filter(([, v]) => v > 0).map(([state, count]) => ({ state, count }));
}

const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** «26 ноября 2026» / "26 November 2026", from an ISO date. */
export function longDate(iso, lang) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return lang === "RU" ? `${d} ${MONTHS_RU[m - 1]} ${y}` : `${d} ${MONTHS_EN[m - 1]} ${y}`;
}
