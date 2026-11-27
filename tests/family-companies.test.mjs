// Bus 172 P6: «Компании и проекты» in Family OS — cards from the vendored registry only, no invented figures,
// no sparklines without a time series, the last-change date from the registry's own notes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readdirSync, statSync, existsSync } from "node:fs";
import { companyCards, lastChange, stateCounts, longDate, privateCompanyCards, mergeCards } from "../app/lib/family-companies.mjs";

const registry = JSON.parse(readFileSync("app/content/registry.public.json", "utf8"));
const src = (p) => readFileSync(p, "utf8");
/** The code without its comments (the comments name what was left out, on purpose). */
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("one card per registry project, nothing else; active, then retired, then planned", () => {
  const cards = companyCards(registry);
  assert.deepEqual(cards.map((c) => c.key).sort(), registry.projects.map((p) => p.key).sort());
  const order = { active: 0, retired: 1, planned: 2 };
  for (let i = 1; i < cards.length; i++) assert.ok(order[cards[i - 1].state] <= order[cards[i].state]);
  for (const c of cards) {
    const p = registry.projects.find((x) => x.key === c.key);
    assert.equal(c.name, p.name); assert.equal(c.role, p.role);
    // bus 173: the retired MoyPolk card names its successor and links there; every other card keeps its registry url
    if (c.key === "moypolk") assert.equal(c.url, registry.projects.find((x) => x.key === "community-group").url);
    else assert.equal(c.url, p.url ?? null);
    assert.deepEqual(c.layers, Object.entries(p.layers ?? {}).map(([key, status]) => ({ key, status })));
  }
});

test("the last change is the highest «vNN (date)» in the entry's note; none without a note", () => {
  assert.deepEqual(lastChange({ note: "v14 (2026-11-26): a. Was: x. v12 (2026-11-25): b." }), { version: 14, date: "2026-11-26" });
  assert.deepEqual(lastChange({ note: "v9 (2026-10-01): a. v13 (2026-11-25): b." }), { version: 13, date: "2026-11-25" });
  assert.equal(lastChange({}), null);
  assert.equal(lastChange({ note: "no version here" }), null);
  for (const c of companyCards(registry)) {
    const p = registry.projects.find((x) => x.key === c.key);
    if (c.changed) assert.ok(p.note.includes(`v${c.changed.version} (${c.changed.date})`));
    else assert.ok(!/\bv\d+ \(\d{4}-\d{2}-\d{2}\)/.test(p.note ?? ""));
  }
});

test("state counts leave zeros out; dates in words", () => {
  assert.deepEqual(stateCounts([{ state: "active" }, { state: "active" }, { state: "planned" }]), [{ state: "active", count: 2 }, { state: "planned", count: 1 }]);
  assert.equal(longDate("2026-11-26", "RU"), "26 ноября 2026");
  assert.equal(longDate("2026-03-01", "EN"), "1 March 2026");
});

test("the page: server-side registry, no sparkline, no mockup companies or figures, a child goes home, members and the owner only", () => {
  const c = code("app/components/FamilyCompanies.tsx");
  assert.doesNotMatch(c, /^"use client"/, "a server component: the registry stays on the server");
  assert.doesNotMatch(c, /spark|<svg|polyline/i, "no sparkline: the registry is not a time series");
  // bus 176 P3: the company names live in the server-only data file, never in the component
  for (const w of ["Craft Resin", "Eco Lock", "+12%", "заказов", "участник", "релиз"]) assert.ok(!c.includes(w), w);
  const p = src("app/[lang]/family/os/companies/page.tsx");
  assert.match(p, /if \(!state\.me && !state\.admin && !session\.guest\) notFound\(\);\n  childHome\(lang, state\.me\);/);
  // bus 176 P4: a read-only guest only when «Компании и проекты» is one of their sections
  assert.match(p, /decision === "guest" && guestMay\(session, "companies"\)/);
  assert.match(p, /mergeCards\(companyCards\(registry\), privateCompanyCards\(PRIVATE_COMPANIES\)\)/);
  assert.doesNotMatch(p, /getBoard|getCalendar|getCouncil|getSprint/, "no Family OS data of its own");
});

test("P6 acceptor QA: the subtitle says the family runs the projects, not that it owns them (as on the P5 home)", () => {
  const c = code("app/components/FamilyCompanies.tsx");
  assert.ok(c.includes("Проекты из публичного реестра KARTEL и компании, которые ведёт семья"));
  assert.ok(c.includes("Projects from the public KARTEL registry and the companies the family runs"));
  assert.ok(!c.includes("Проекты семьи по") && !c.includes("The family's projects"));
});

// Bus 176 P3: Craft Resin, Eco Lock HD and KARTEL in the cabinet only, from the Vault, server-only.
const PRIVATE = "app/content/companies-private.ts";
/** The private list, read from the source (the .ts file imports "server-only", which node:test cannot load). */
function privateList() {
  const s = src(PRIVATE);
  const body = s.slice(s.indexOf("PRIVATE_COMPANIES: PrivateCompany[] = ") + 38, s.lastIndexOf("];") + 1);
  return Function(`return ${body}`)();
}
const list = privateList();
/** Strings that must never reach a public file: the names, their hosts and keys, every lead. */
const SECRET = [...new Set([
  "Craft Resin", "Eco Lock", "craft-resin", "eco-lock-hd", "ecolockhd",
  ...list.flatMap((c) => [c.lead.EN, c.lead.RU]),
])];

test("P3 data: server-only; exactly Craft Resin, Eco Lock HD and KARTEL; only recorded fields, no figures", () => {
  assert.match(src(PRIVATE), /^import "server-only";/);
  assert.deepEqual(list.map((c) => c.name).sort(), ["Craft Resin", "Eco Lock HD", "KARTEL"]);
  for (const c of list) {
    assert.deepEqual(Object.keys(c).sort(), ["key", "lead", "name", "recorded", "status", "url"], c.key);
    assert.equal(c.status, "active", c.key);
    assert.match(c.recorded, /^\d{4}-\d{2}-\d{2}$/, c.key);
    assert.ok(c.url === null || /^https:\/\/[a-z0-9.-]+$/.test(c.url), c.key);
    for (const l of [c.lead.EN, c.lead.RU]) assert.doesNotMatch(l, /\d|[£$€%]/, `${c.key}: no figures in the lead`);
  }
  // Craft Resin: the Vault records no website, so none is shown (not «Сайта пока нет», which would be a claim)
  assert.equal(list.find((c) => c.name === "Craft Resin").url, null);
  // none of them is in the public registry
  for (const c of list) assert.ok(!registry.projects.some((p) => p.name === c.name || p.key === c.key), c.key);
});

test("P3 data: only the cabinet page imports the private file", () => {
  const files = (function walk(d) { return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); })("app");
  const importers = files.filter((f) => /\.(tsx?|mjs)$/.test(f) && /(from|import)\s*\(?\s*["'][^"']*companies-private["']/.test(src(f)) && f !== PRIVATE);
  assert.deepEqual(importers, [join("app/[lang]/family/os/companies/page.tsx")]);
  assert.doesNotMatch(src("app/[lang]/family/os/companies/page.tsx"), /^"use client"/);
});

test("P3 cards: name, lead, state, website and the recorded date; merged active first, registry first within a state", () => {
  const priv = privateCompanyCards(list);
  for (const c of priv) {
    assert.equal(c.source, "vault");
    assert.ok(!("role" in c) && !("layers" in c), "no registry terms on a Vault card");
  }
  const merged = mergeCards(companyCards(registry), priv);
  assert.equal(merged.length, registry.projects.length + list.length);
  const order = { active: 0, retired: 1, planned: 2 };
  for (let i = 1; i < merged.length; i++) assert.ok(order[merged[i - 1].state] <= order[merged[i].state]);
  const active = merged.filter((c) => c.state === "active").map((c) => c.source);
  assert.deepEqual(active, [...active].sort((a, b) => (a === "registry" ? 0 : 1) - (b === "registry" ? 0 : 1)));
  assert.ok(merged.filter((c) => c.source === "registry").every((c) => "layers" in c));
});

test("P3 public build: no public HTML, RSC payload, client chunk or public file names these companies", { skip: !existsSync(".next/static") && "needs npm run build" }, () => {
  const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
  const unescape = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const prerendered = walk(".next/server/app").filter((f) => /\.(html|rsc|body|meta|txt|xml|json)$/.test(f));
  const files = [...walk(".next/static"), ...walk("public"), ...prerendered];
  assert.ok(files.some((f) => f.endsWith("en.html")) && files.some((f) => f.startsWith(".next/static/chunks")), "the scan saw the build");
  const hits = files.flatMap((f) => { const t = unescape(readFileSync(f, "utf8")); return SECRET.filter((w) => t.includes(w)).map((w) => `${f}: ${w}`); });
  assert.deepEqual(hits, []);
});

test("P3 acceptor QA: every monogram colour meets AA with its white letters (P3 is the first to use the fifth)", () => {
  const sq = code("app/components/FamilyCompanies.tsx").match(/const SQ = (\[[^\]]+\])/)[1];
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const h of JSON.parse(sq)) assert.ok(1.05 / (lum(h) + 0.05) >= 4.5, h);
});
