// bus 172 P5: the public home's family-office view and the v5 sign-in.
// The home reads its companies and every number from the vendored registry; the sign-in keeps every state.
// Prerendered checks read .next/server/app (run after `npm run build`, as prerendered.test.mjs does).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homeCompanies, homeOrganisations, homeStats, projectState, registryStamp } from "../app/content/publicHome.mjs";

const src = (f) => readFileSync(f, "utf8");
const registry = JSON.parse(src("app/content/registry.public.json"));
const read = (f) => src(`.next/server/app/${f}`);
const plain = (h) => h.replace(/ |&nbsp;/g, " ");
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const SUMMARIES = { EN: {}, RU: {} };

describe("public home — data from the registry only", () => {
  test("every registry project is a card, active → retired → planned; nothing else", () => {
    const cards = homeCompanies(registry, SUMMARIES);
    assert.deepEqual(cards.map((c) => c.key).sort(), registry.projects.map((p) => p.key).sort());
    const rank = { active: 0, retired: 1, planned: 2 };
    for (let i = 1; i < cards.length; i++) assert.ok(rank[cards[i - 1].state] <= rank[cards[i].state]);
    assert.equal(projectState({ type: "project", role: "Retired" }), "retired");
    assert.equal(projectState({ type: "future-module", role: "Planned" }), "planned");
    assert.equal(projectState({ type: "project", role: "Consumer" }), "active");
  });

  test("the counts are counts over the registry, and a zero is left out", () => {
    const stats = Object.fromEntries(homeStats(registry, "EN").map((s) => [s.key, s.n]));
    assert.equal(stats.projects, registry.projects.filter((p) => p.type === "project" && p.role !== "Retired").length);
    assert.equal(stats.schools, registry.organisationRegistry.organisations.filter((o) => o.tier === "SCHOOL").length);
    assert.equal(stats.campuses, registry.campusRegistry.campuses.length);
    const none = { ...registry, campusRegistry: { campuses: [] } };
    assert.equal(homeStats(none, "RU").some((s) => s.key === "campuses"), false);
    assert.deepEqual(homeStats({ ...registry, projects: [registry.projects[0], registry.projects[1]], campusRegistry: { campuses: [1, 2, 3, 4, 5] } }, "RU").map((s) => s.label), ["действующий проект", "школы", "кампусов"]);
    assert.match(registryStamp(registry, "RU"), new RegExp(`^версия ${registry.version} от \\d{1,2} [а-я]+ \\d{4}$`));
  });

  test("the legal entity and schools are the registry's organisations", () => {
    const { entity, schools } = homeOrganisations(registry);
    assert.equal(entity.tier, "AUTHORITY");
    assert.ok(schools.length > 0 && schools.every((s) => s.tier === "SCHOOL"));
  });

  test("no mockup values in the source: companies, figures, the app screenshot's tasks", () => {
    const s = src("app/components/PublicOffice.tsx") + src("app/content/publicHome.mjs");
    for (const m of [/Craft Resin|Eco Lock/, /2009|условно/, /страны продаж/, /Ответить бухгалтеру|Семейный ужин|Недельный обзор/, /\+12%|48 заказов/]) assert.doesNotMatch(s, m);
    assert.doesNotMatch(s, /Связаться|Контакты|mailto:/, "the public home carries no contact");
  });
});

describe("public home — prerendered (EN + RU)", () => {
  for (const lang of ["en", "ru"]) {
    const html = plain(read(`${lang}.html`));
    test(`${lang}: one H1, the office hero first, the crest after it`, () => {
      assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
      const office = html.indexOf('id="office"'), companies = html.indexOf('id="companies"'), crest = html.indexOf('<article id="home"');
      assert.ok(office > 0 && office < companies && companies < crest, "office → companies → crest");
    });
    test(`${lang}: every company card and every count, from the registry`, () => {
      for (const p of registry.projects) assert.match(html, new RegExp(`data-company="${p.key}"`), p.key);
      const strip = html.slice(html.indexOf('data-home-stats=""'), html.indexOf('id="companies"'));
      for (const s of homeStats(registry, lang.toUpperCase())) assert.ok(strip.includes(`>${s.n}</dd>`) && strip.includes(s.label), s.key);
      assert.ok(strip.includes(registryStamp(registry, lang.toUpperCase())));
      assert.match(strip, new RegExp(`href="/${lang}/registry"`));
    });
    test(`${lang}: the family-area card names places, not data; sign-in goes through the gate`, () => {
      assert.match(html, new RegExp(`href="/${lang}/family/os"`));
      assert.doesNotMatch(html, /Ответить бухгалтеру|Craft Resin|2009/);
    });
  }
  test("PublicOffice renders on the server: its copy is in no client chunk (the home ships no registry read)", () => {
    const hits = walk(".next/static").filter((f) => f.endsWith(".js") && /built for generations|построенный на поколения/.test(src(f)));
    assert.deepEqual(hits, []);
    assert.doesNotMatch(src("app/components/PublicOffice.tsx"), /^"use client"/);
    assert.doesNotMatch(src("app/components/HomeClient.tsx"), /^import .*(PublicOffice|registry\.public\.json)/m);
  });
});

describe("sign-in — v5 two panels, every state kept", () => {
  const n = src("app/components/FamilyGateNotice.tsx");
  test("the passkey is the main button when the browser can use one; the email (link + code) is the fallback", () => {
    assert.match(n, /const pkFirst = passkeys && pkOk;/);
    assert.match(n, /\{pkFirst && \(\s*<div data-passkey-signin="" className="mt-8">\s*<button type="button" onClick=\{\(\) => pkSignIn\(false\)\} className=\{`w-full \$\{BTN_FIRST\}`\}>/);
    assert.match(n, /className=\{pkFirst \? BTN_SECOND : BTN_FIRST\}/, "without a passkey the email button is the main action");
    assert.ok(n.indexOf("data-passkey-signin") < n.indexOf('action="/api/family-auth/request"'), "passkey above the email form");
    assert.match(n, /\{codes \? c\.orCode : c\.orLink\}/);
    assert.match(n, /orCode: "или по письму с кодом"/);
  });
  test("two panels from 900 px; the aside is words only and hidden below 900 px", () => {
    assert.match(n, /<AuthShell lang=\{lang\} aside=\{<SignInAside c=\{c\} \/>\}>/);
    const a = n.slice(n.indexOf("function SignInAside"), n.indexOf("function CodeForm"));
    assert.match(a, /className="hidden flex-col [^"]*min-\[900px\]:flex/);
    assert.doesNotMatch(a, /<h[1-6]/, "the form keeps the page's one heading");
    const shell = src("app/components/AuthShell.tsx");
    assert.match(shell, /data-fos="" className="flex min-h-screen flex-col/);
    assert.match(shell, /min-\[900px\]:grid-cols-\[1\.1fr_1fr\]/);
  });
  test("every state still renders: sent (+ code), elsewhere, ended, the four link failures", () => {
    for (const k of ['state === "sent" ?', 'state === "elsewhere" ?', 'state === "ended" &&', 'state === "invalid" || state === "expired" || state === "superseded" || state === "used"', "{codes && <CodeForm c={c} returnTo={returnTo} />}"]) assert.ok(n.includes(k), k);
  });
});
