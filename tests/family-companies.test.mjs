// Bus 172 P6: «Компании и проекты» in Family OS — cards from the vendored registry only, no invented figures,
// no sparklines without a time series, the last-change date from the registry's own notes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { companyCards, lastChange, stateCounts, longDate } from "../app/lib/family-companies.mjs";

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
  for (const w of ["Craft Resin", "Eco Lock", "+12%", "заказов", "участник", "релиз"]) assert.ok(!c.includes(w), w);
  const p = src("app/[lang]/family/os/companies/page.tsx");
  assert.match(p, /if \(!state\.me && !state\.admin\) notFound\(\);\n  childHome\(lang, state\.me\);/);
  assert.match(p, /companyCards\(registry\)/);
  assert.doesNotMatch(p, /getBoard|getCalendar|getCouncil|getSprint/, "no Family OS data of its own");
});

test("P6 acceptor QA: the subtitle says the family runs the projects, not that it owns them (as on the P5 home)", () => {
  const c = code("app/components/FamilyCompanies.tsx");
  assert.ok(c.includes("Публичный реестр KARTEL: проекты, которые ведёт семья"));
  assert.ok(c.includes("The public KARTEL registry: the projects the family runs"));
  assert.ok(!c.includes("Проекты семьи по") && !c.includes("The family's projects"));
});
