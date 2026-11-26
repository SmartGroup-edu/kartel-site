// Bus 173 (redesign close-out): the heritage page sends a child home; the family area is «Семейный кабинет» everywhere
// (heritage stays «Наследие» inside it); the home names KARTEL the family office; the retired MoyPolk card points at
// Community Group, never at moypolk.uk; the registry is not widened (no Craft Resin / Eco Lock HD).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homeCompanies, cardIdentity } from "../app/content/publicHome.mjs";
import { companyCards } from "../app/lib/family-companies.mjs";

const src = (p) => readFileSync(p, "utf8");
const registry = JSON.parse(src("app/content/registry.public.json"));
const summaries = { EN: {}, RU: {} };

test("heritage /[lang]/family: a child is sent to «Мой день» on the server, before the page renders", () => {
  const s = src("app/[lang]/family/page.tsx");
  const body = s.slice(s.indexOf("export default async function"));
  const at = body.indexOf("childHome(lang, me);");
  assert.ok(at > 0, "the page calls childHome with the viewer from /me");
  assert.ok(at < body.indexOf("<FamilyClient"), "before the heritage renders");
  assert.match(body, /const \{ me, \.\.\.os \} = await getOsNav\(session\);/, "no extra Family OS call: /me is the one getOsNav already reads");
  assert.match(src("app/lib/family-os.ts"), /return \{ os: Boolean\(me\) \|\| admin, member: Boolean\(me\), me: me \? \{ id: me\.id, kind: me\.kind \} : null \};/);
});

test("naming: «Семейный кабинет» / “Family area” in the menu, titles and sign-in; no «Семейное наследие» or «Герб» menu item", () => {
  const nav = src("app/content/siteNav.ts");
  assert.match(nav, /\{ label: "Семейный кабинет", path: "family\/os" \}/);
  assert.match(nav, /\{ label: "Family area", path: "family\/os" \}/);
  assert.doesNotMatch(nav, /label: "(Герб|Coat of Arms|Семейное наследие|Family Heritage)"/);
  assert.match(src("app/[lang]/family/signin/page.tsx"), /"Семейный кабинет — вход" : "Family area — sign in"/);
  assert.match(src("app/[lang]/family/pending/page.tsx"), /title: "Семейный кабинет — ожидает одобрения"/);
  assert.match(src("app/[lang]/family/page.tsx"), /title: "Наследие · Семейный кабинет",/, "heritage keeps its name inside the cabinet");
  for (const p of ["os/page.tsx", "os/board/page.tsx", "os/calendar/page.tsx", "os/council/page.tsx", "os/people/page.tsx", "os/review/page.tsx", "os/companies/page.tsx", "os/kodeks/page.tsx", "os/access/page.tsx", "os/week/page.tsx", "[...missing]/page.tsx"]) {
    const t = src(`app/[lang]/family/${p}`);
    assert.match(t, / · Семейный кабинет"/, p);
    assert.doesNotMatch(t, / · Семья"| · Family"/, p);
  }
  // nothing user-facing says «Семейное наследие» / "Family Heritage" any more
  for (const f of ["app/components/HomeClient.tsx", "app/components/FamilyAdmin.tsx", "app/[lang]/family/pending/page.tsx", "app/[lang]/family/signin/page.tsx", "app/content/siteNav.ts"]) {
    assert.doesNotMatch(src(f), /Семейное наследие|Семейном наследии|Family Heritage/, f);
  }
});

test("home: the H1 «Семья KARTEL — дело на поколения.», a lead about the federation projects; the share card and JSON-LD name the family office", () => {
  const o = src("app/components/PublicOffice.tsx");
  assert.match(o, /title: "Семья KARTEL — дело на поколения\.",/);
  assert.match(o, /title: "The KARTEL family — work that lasts for generations\.",/);
  assert.doesNotMatch(o, /Семейный бизнес|family business/);
  const og = src("app/lib/ogCard.tsx");
  assert.match(og, /headline: \["Семейный офис", "в Лондоне"\]/);
  assert.match(og, /headline: \["Family office", "in London"\]/);
  assert.doesNotMatch(og, /headline: \[[^\]]*(Coat of Arms|герб)/);
  const page = src("app/[lang]/page.tsx");
  assert.match(page, /title: "KARTEL — семейный офис в Лондоне",/);
  assert.match(page, /"mainEntity": \{ "@id": "https:\/\/kartel\.org\.uk\/#organization" \}/);
  assert.doesNotMatch(page, /"@type": "Article"/);
});

test("MoyPolk: «MoyPolkUK — теперь часть Community Group», linked to the registry's Community Group url — never moypolk.uk", () => {
  const cg = registry.projects.find((p) => p.key === "community-group");
  for (const cards of [homeCompanies(registry, summaries), companyCards(registry)]) {
    const mp = cards.find((c) => c.key === "moypolk");
    assert.equal(mp.state, "retired");
    assert.deepEqual(mp.title, { EN: "MoyPolkUK — now part of Community Group", RU: "MoyPolkUK — теперь часть Community Group" });
    assert.equal(mp.url, cg.url);
    assert.ok(cards.every((c) => !String(c.url ?? "").includes("moypolk.uk")));
    // every other card keeps its registry name and url
    for (const c of cards.filter((x) => x.key !== "moypolk")) {
      const p = registry.projects.find((x) => x.key === c.key);
      assert.deepEqual(c.title, { EN: p.name, RU: p.name }); assert.equal(c.url, p.url ?? null);
    }
  }
  // an active project is never re-pointed, even if it were in the merged list
  assert.equal(cardIdentity(registry, { key: "moypolk", name: "MoyPolk", role: "Consumer", type: "project", url: "https://moypolk.uk" }).url, "https://moypolk.uk");
  assert.match(src("app/components/PublicOffice.tsx"), /\{c\.title\[lang\]\}<\/h3>/);
  assert.match(src("app/components/FamilyCompanies.tsx"), /\{c\.title\[lang\]\}<\/h2>/);
});

test("the registry is not widened: no Craft Resin or Eco Lock HD (R0: leave those projects alone)", () => {
  const all = JSON.stringify(registry) + src("app/content/publicHome.mjs") + src("app/content/federationCopy.ts");
  assert.doesNotMatch(all, /craft.?resin|eco.?lock/i);
});

test("family 404 for a child: their two tabs, «Мой день» as the way back, no «Наследие» (QA bus 173)", async () => {
  const { familySubNav } = await import("../app/lib/family-nav.mjs");
  const child = familySubNav({ lang: "RU", admin: false, os: true, child: true });
  assert.deepEqual(child.map((x) => [x.label, x.href]), [["Мой день", "/ru/family/os"], ["Календарь", "/ru/family/os/calendar"]]);
  assert.ok(!familySubNav({ lang: "EN", admin: false, os: true, child: true }).some((x) => x.id === "heritage"));
  assert.ok(familySubNav({ lang: "RU", admin: false, os: true }).some((x) => x.id === "heritage"), "adults keep heritage");
  const nf = src("app/[lang]/family/not-found.tsx");
  assert.match(nf, /child: me\?\.kind === "child"/);
  const view = src("app/components/NotFoundView.tsx");
  assert.match(view, /child=\{family\.child \?\? false\}/);
  assert.match(view, /\{!\(refCode && child\) && \(/, "the heritage button is not drawn for a child");
  assert.match(src("app/components/FamilyChrome.tsx"), /child=\{nav\.child \?\? false\}/);
});
