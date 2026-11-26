// Public home (bus 172 P5): the companies and the counts strip, derived from the vendored registry only.
// Plain .mjs so the node tests share it (tests must not import .ts). No Node built-ins: the client home imports it.
// No invented numbers: every figure here is a count over registry.public.json, and the strip says which version.

import { plural } from "../lib/family-today.mjs";

/** First sentence of a registry summary — the plain "what it is", without the federation detail. */
const firstSentence = (s) => (s ?? "").split(/(?<=\.)\s/)[0];

/**
 * A project's state in plain words, from the registry's own fields:
 * type "project" + role ≠ Retired → active · role Retired → retired · type "future-module" or role Planned → planned.
 */
export function projectState(p) {
  if (p.role === "Retired") return "retired";
  if (p.type !== "project" || p.role === "Planned") return "planned";
  return "active";
}

const ORDER = { active: 0, retired: 1, planned: 2 };

/** The registry's projects as home cards: active first, then retired, then planned; registry order within each. */
export function homeCompanies(registry, summaries) {
  return registry.projects
    .map((p, i) => ({ p, i, state: projectState(p) }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.i - b.i)
    .map(({ p, state }) => ({
      key: p.key,
      name: p.name,
      url: p.url ?? null,
      state,
      lead: { EN: firstSentence(summaries.EN[p.key] ?? p.summary), RU: firstSentence(summaries.RU[p.key] ?? p.summary) },
    }));
}

/** The organisations behind them: the one legal entity (tier AUTHORITY) and its schools. */
export function homeOrganisations(registry) {
  const orgs = registry.organisationRegistry.organisations;
  return {
    entity: orgs.find((o) => o.tier === "AUTHORITY") ?? null,
    schools: orgs.filter((o) => o.tier === "SCHOOL"),
  };
}

/** The counts strip: only what the registry can count. A zero count is left out, never shown as 0. */
export function homeStats(registry, lang) {
  const ru = lang === "RU";
  const active = registry.projects.filter((p) => projectState(p) === "active").length;
  const schools = homeOrganisations(registry).schools.length;
  const campuses = registry.campusRegistry.campuses.length;
  return [
    { key: "projects", n: active, label: ru ? `${plural(active, ["действующий проект", "действующих проекта", "действующих проектов"])}` : active === 1 ? "active project" : "active projects" },
    { key: "schools", n: schools, label: ru ? plural(schools, ["школа", "школы", "школ"]) : schools === 1 ? "school" : "schools" },
    { key: "campuses", n: campuses, label: ru ? plural(campuses, ["кампус", "кампуса", "кампусов"]) : campuses === 1 ? "campus" : "campuses" },
  ].filter((s) => s.n > 0);
}

const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** «версия 14 от 26 ноября 2026» / "version 14, 26 November 2026" — the registry's own version and date. */
export function registryStamp(registry, lang) {
  const [y, m, d] = String(registry.updated).split("-").map(Number);
  return lang === "RU"
    ? `версия ${registry.version} от ${d} ${MONTHS_RU[m - 1]} ${y}`
    : `version ${registry.version}, ${d} ${MONTHS_EN[m - 1]} ${y}`;
}
