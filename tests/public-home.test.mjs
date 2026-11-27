// bus 176 P1 (R0 2026-11-27): the public home is the coat of arms page and nothing else; the sign-in is the approved
// crest sign-in with every state; KARTEL Core and the registry are behind the family sign-in.
// The registry helpers below (bus 172 P5) now feed the cabinet's «Компании и проекты» only.
// Prerendered checks read .next/server/app (run after `npm run build`, as prerendered.test.mjs does).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homeCompanies, homeOrganisations, homeStats, projectState, registryStamp } from "../app/content/publicHome.mjs";

const src = (f) => readFileSync(f, "utf8");
const registry = JSON.parse(src("app/content/registry.public.json"));
const read = (f) => src(`.next/server/app/${f}`);
const plain = (h) => h.replace(/ |&nbsp;/g, " ");
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
});

const visible = (h) => plain(h).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const BUSINESS = /семейн\S* офис|family office|федерац|federation|реестр|registry|KARTEL Core|Ядро KARTEL|CEA|RusJAz|community\.group|Community Group|MoyPolk|компани|compan|бизнес|business|Craft Resin|Eco Lock|проект|project/i;

describe("public home — the coat of arms only (EN + RU, prerendered)", () => {
  for (const lang of ["en", "ru"]) {
    const html = plain(read(`${lang}.html`));
    test(`${lang}: one H1, the crest title; the mockup's title and theme colour`, () => {
      assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
      assert.match(html, lang === "ru" ? /<h1[^>]*>Фамильный герб Картель<\/h1>/ : /<h1[^>]*>The Kartel Coat of Arms<\/h1>/);
      assert.match(html, lang === "ru" ? /<title>Фамильный герб Картель — Virtus et Potestas<\/title>/ : /<title>The Kartel Coat of Arms — Virtus et Potestas<\/title>/);
      assert.match(html, /<meta name="theme-color" content="#0a0908"\/>/);
    });
    test(`${lang}: no business, project, registry or family-office word anywhere in the page (visible or in its payload)`, () => {
      const m = visible(html).match(BUSINESS);
      assert.equal(m, null, m && m[0]);
      const all = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "").match(BUSINESS);
      assert.equal(all, null, all && all[0]);
    });
    test(`${lang}: sections in order — hero, explorer, colours, motto, FAQ, family card`, () => {
      const at = ["id=\"hero\"", "id=\"explore\"", "id=\"colours\"", "id=\"motto\"", "id=\"faq\"", "id=\"fam-h\""].map((k) => html.indexOf(k));
      assert.ok(at.every((x, i) => x > 0 && (i === 0 || x > at[i - 1])), String(at));
    });
    test(`${lang}: «Войти» in the header, the hero and the family card — one tap to the sign-in page`, () => {
      for (const k of ["header", "hero", "family"]) assert.match(html, new RegExp(`href="/${lang}/family/signin"[^>]*data-signin="${k}"|data-signin="${k}"[^>]*href="/${lang}/family/signin"`), k);
    });
    test(`${lang}: the explorer — 8 tabs, one selected, roving tabindex, Roman numerals; points are pointer-only`, () => {
      const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
      assert.equal(tabs.length, 8);
      assert.equal(tabs.filter((t) => /aria-selected="true"/.test(t)).length, 1);
      assert.equal(tabs.filter((t) => /tabindex="0"/i.test(t)).length, 1);
      assert.match(html, /<b>I<\/b> · (<!-- -->)?VIII/);
      const hots = [...html.matchAll(/<button[^>]*data-hot="[a-z]+"[^>]*>/g)].map((m) => m[0]);
      assert.equal(hots.length, 8);
      assert.ok(hots.every((h) => /tabindex="-1"/i.test(h)));
    });
    test(`${lang}: JSON-LD is the mockup's ImageObject + FAQPage, and the FAQ matches the visible one`, () => {
      const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      assert.deepEqual(ld.map((x) => x["@type"]), ["ImageObject", "FAQPage"]);
      assert.equal(ld[0].contentUrl, "https://kartel.org.uk/crest.jpeg");
      assert.equal(ld[1].mainEntity.length, 5);
      assert.equal((html.match(/<details/g) ?? []).length, 5);
      assert.doesNotMatch(JSON.stringify(ld), BUSINESS);
    });
    test(`${lang}: the crest is optimised (next/image, high priority on the hero) and the fonts are self-hosted and preloaded`, () => {
      const hi = [...html.matchAll(/<img[^>]*fetchPriority="high"[^>]*>/gi)].map((m) => m[0]);
      assert.equal(hi.length, 1, "one high-priority image: the hero crest");
      assert.match(hi[0], /loading="eager"|^(?![\s\S]*loading="lazy")/);
      assert.match(hi[0], /\/_next\/image\?url=%2Fcrest\.jpeg/);
      assert.match(src("next.config.ts"), /formats: \["image\/avif", "image\/webp"\]/);
      assert.doesNotMatch(html, /<link rel="preload" href="\/_next\/static\/media\/[^"]+\.woff2"/, "no cabinet font preloads compete with the crest");
      // the two faces of the first screen in the page's script only — nothing else competes with the LCP crest
      const pre = [...html.matchAll(/<link rel="preload" href="([^"]+\.woff2)" as="font" crossorigin="" type="font\/woff2"\/>/g)].map((m) => m[1]);
      const script = lang === "ru" ? "cyrillic" : "latin";
      assert.deepEqual(pre, [`/fonts/manrope-${script}-v2.woff2`, `/fonts/playfair-${script}-v2.woff2`]);
      assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
    });
    test(`${lang}: bus 176 P1b — one crest download before the LCP: the hero only; the explorer crest waits, the logo is a tiny file`, () => {
      const crests = [...html.matchAll(/<img[^>]*src="\/_next\/image\?url=%2Fcrest\.jpeg[^>]*>/gi)].map((m) => m[0]);
      assert.equal(crests.length, 1, "the server HTML carries one next/image crest: the hero (the explorer's comes after load)");
      assert.match(crests[0], /fetchPriority="high"/);
      assert.match(html, /<img[^>]*src="\/crest-mark\.webp"/, "the wordmark uses the dedicated small crest");
      assert.doesNotMatch(html, /data-intro=|class="[^"]*intro/, "no intro overlay element");
      // the fonts declared for this language: the faces a first screen needs stay ≤ 80 KB
      assert.match(html, /<style>@font-face\{font-family:"Manrope"/);
      const first = lang === "ru"
        ? ["manrope-cyrillic-v2", "playfair-cyrillic-v2", "playfair-mark-v2", "playfair-italic-mark-v2"]
        : ["manrope-latin-v2", "playfair-latin-v2", "playfair-italic-mark-v2"];
      const bytes = first.reduce((n, f) => n + readFileSync(`public/fonts/${f}.woff2`).length, 0);
      assert.ok(bytes <= 80 * 1024, `${bytes} bytes of first-screen fonts`);
    });
    test(`${lang}: no mockup controls (note bar, switchers, test code)`, () => {
      assert.doesNotMatch(html, /Макет|Mockup|123456|Компьютер|Телефон|data-font=|ornbar/);
    });
  }
  test("the intro runs once per session and never under reduced motion; it is played by the hero crest and hides nothing (P1b)", () => {
    const h = src("app/components/crest/CrestHome.tsx"), css = src("app/components/crest/crest.module.css");
    assert.match(h, /sessionStorage\.getItem\('kartel-intro'\)&&!matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
    assert.match(css, /:global\(html\[data-intro\]\) \.crestbox \.crestimg \{ animation: introIn /);
    // the LCP crest and the H1 are painted in the first frame: no opacity in the intro or the hero rise
    const kf = (n) => css.match(new RegExp(`@keyframes ${n} \\{[^\\n]*`))[0];
    assert.doesNotMatch(kf("introIn"), /opacity/);
    assert.doesNotMatch(kf("lift"), /opacity/);
    assert.match(css, /\.rise \{ animation: lift /);
    assert.doesNotMatch(css, /\.intro \{|introOut/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.site \*, \.site \*::before, \.site \*::after \{ animation: none;/);
  });
  test("P1b: hero effects, the explorer crest and the intro timer wait for load + idle; the explorer crest is lazy and low", () => {
    const h = src("app/components/crest/CrestHome.tsx"), c = src("app/components/crest/CrestChrome.tsx");
    assert.match(h, /const cancel = afterLoad\(\(\) => \{[\s\S]*setFine\([\s\S]*setLate\(true\)[\s\S]*removeAttribute\("data-intro"\)/);
    assert.match(h, /\{late \? <CrestImg alt=\{t\.altEx\}/);
    assert.match(c, /loading=\{lcp \|\| eager \? "eager" : "lazy"\} fetchPriority=\{lcp \? "high" : eager \? undefined : "low"\}/);
    assert.ok(readFileSync("public/crest-mark.webp").length < 4 * 1024, "the logo asset is under 4 KB");
  });
  test("tilt, gloss and sheen only with a fine pointer and no reduced motion; the motto light breathes on touch", () => {
    const h = src("app/components/crest/CrestHome.tsx");
    assert.match(h, /setFine\(mm\("\(pointer: fine\)"\) && !reduce\)/);
    assert.match(h, /if \(!fine\) return;/);
    assert.match(src("app/components/crest/crest.module.css"), /\.touch \.lit \{[^}]*animation: ornBreath/);
  });
  test("fonts: Playfair Display 600/700 + italic 500 and variable Manrope, Latin + Cyrillic woff2 (+ the two marks), swap, per language", () => {
    const crestFontFaces = (lang) => read(`${lang}.html`).match(/<style>(@font-face[\s\S]*?)<\/style>/)[1];
    const files = ["playfair-latin", "playfair-cyrillic", "playfair-italic-latin", "playfair-italic-cyrillic", "manrope-latin", "manrope-cyrillic", "playfair-italic-mark"];
    for (const lang of ["en", "ru"]) {
      const g = crestFontFaces(lang);
      for (const f of [...files, ...(lang === "ru" ? ["playfair-mark"] : [])]) {
        assert.match(g, new RegExp(`url\\("/fonts/${f}-v2\\.woff2"\\)`), f);
        assert.ok(readFileSync(`public/fonts/${f}-v2.woff2`).subarray(0, 4).toString() === "wOF2", f);
      }
      assert.equal((g.match(/font-display:swap/g) ?? []).length, lang === "ru" ? 8 : 7);
      // the marks are declared last (later rules win overlapping characters)
      assert.match(g, /playfair-italic-mark-v2\.woff2"\) format\("woff2"\);unicode-range:[^}]*\}$/);
      // /ru: the cyrillic file carries the space; /en: it does not
      const cyr = g.match(/manrope-cyrillic-v2\.woff2"\) format\("woff2"\);unicode-range:([^}]*)\}/)[1];
      assert.equal(cyr.includes("U+0020"), lang === "ru");
    }
    assert.doesNotMatch(src("app/globals.css"), /@font-face/);
    const css = src("app/components/crest/crest.module.css");
    assert.match(css, /font-weight: 350;/); assert.match(css, /\.lead \{[^}]*font-weight: 300;/);
  });
});

describe("KARTEL Core and the registry are family-only (bus 176 P1)", () => {
  const proxy = src("proxy.ts");
  test("the edge sends them through the family gate: no session → 307 to sign-in with returnTo", () => {
    assert.match(proxy, /if \(\/\^\\\/\(en\|ru\)\\\/\(core\|registry\)\(\\\/\|\$\)\/\.test\(pathname\)\) \{/);
    assert.match(proxy, /return noindex\(await familyEdgeGate\(request, pathname, "business"\)\);/);
    assert.match(proxy, /if \(!token\) return NextResponse\.redirect\(signin\);/);
    assert.match(proxy, /if \(area === "business"\) \{\s*if \(os\.state === "ok" && os\.child\) return NextResponse\.redirect/);
  });
  test("never indexed, and the sitemap lists only /en and /ru", () => {
    const cfg = src("next.config.ts");
    for (const p of ["core", "registry", "registry/:path*"]) assert.ok(cfg.includes(`source: "/:lang(en|ru)/${p}", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]`), p);
    const xml = read("sitemap.xml.body");
    assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]), ["https://kartel.org.uk/en", "https://kartel.org.uk/ru"]);
    assert.match(src("public/robots.txt"), /User-agent: \*\nAllow: \//);
  });
  test("QA: llms.txt, llms-full.txt and robots.txt do not republish the closed registry or link to it", () => {
    for (const f of ["public/llms.txt", "public/llms-full.txt", "public/robots.txt"]) {
      const t = src(f);
      assert.doesNotMatch(t, /KARTEL Core|Integration Gate|CPIF|federation|registry|RusJAz|MoyPolk|Community Group|community\.group/i, f);
      assert.doesNotMatch(t, /kartel\.org\.uk\/(en|ru)\/(core|registry)/, f);
    }
  });
  test("QA: the public pages' JS chunks carry no registry menu (the public 404s render the crest page directly)", () => {
    const chunks = new Set();
    for (const f of ["en.html", "ru.html", "ru/family/signin.html", "_not-found.html"]) {
      let h = ""; try { h = read(f); } catch { continue; }
      for (const m of h.matchAll(/\/_next\/static\/chunks\/([^"]+\.js)/g)) chunks.add(m[1]);
    }
    assert.ok(chunks.size > 0, "found the public chunks");
    for (const c of chunks) assert.doesNotMatch(src(`.next/static/chunks/${c}`), /Разделы реестра|Registry sections|Карта федерации|Federation map/, c);
  });
  test("they sit in the cabinet's «Бизнес» group as «Реестр и KARTEL Core»", () => {
    assert.match(src("app/lib/family-os-shell.mjs"), /business\.push\(item\("companies"\), \{ id: "registry", href: `\/\$\{lang === "EN" \? "en" : "ru"\}\$\{REGISTRY_PATH\}`, label: t\.registry \}\);/);
  });
});

describe("sign-in — the approved crest sign-in, every state kept (bus 176 P1)", () => {
  const n = src("app/components/FamilyGateNotice.tsx");
  test("passkey first when the browser can use one; the email (link + code) is the fallback; autofill on the field", () => {
    assert.match(n, /const pkFirst = passkeys && pkOk;/);
    assert.match(n, /\{pkFirst \? pkBlock\(pk === "fail"\) : <div style=\{\{ marginTop: 22 \}\} \/>\}\s*\{emailForm\(!pkFirst\)\}/);
    assert.match(n, /autoComplete=\{passkeys \? "email webauthn" : "email"\}/);
    assert.match(n, /browserSupportsWebAuthnAutofill\(\)\.then\(\(yes\) => \{ if \(yes && live\) pkSignIn\(true\); \}\)/);
    assert.match(n, /action="\/api\/family-auth\/request"/, "the request route sets the link's nonce cookie");
  });
  test("all 13 mockup states map onto real ones", () => {
    for (const k of ['pk === "busy"', 'state === "sent"', 'state === "elsewhere"', 'state === "ended" && <Alert kind="info"', 'pk === "fail" && <Alert kind="err"', 'passkeys && !pkOk && <Alert kind="info"', 'state === "expired" ? c.expired(ttlMinutes) : state === "superseded" ? c.superseded : state === "used" ? c.used : c.invalid', 'err?.kind === "locked"', "c.codeErr.wrong(err.left ?? 0)", "goWelcome(setWelcome"]) assert.ok(n.includes(k), k);
    assert.match(n, /WebAuthnAbortService\.cancelCeremony\(\)/, "«Отменить» cancels the device prompt");
  });
  test("six code cells: one-time-code autofill on the first, paste spreads the digits, the sixth sends", () => {
    assert.match(n, /autoComplete=\{i === 0 \? "one-time-code" : "off"\}/);
    assert.match(n, /getData\("text"\)\.replace\(\/\\D\/g, ""\)\.slice\(0, 6\)/);
    assert.match(n, /if \(next\.every\(Boolean\)\) void submit\(next\.join\(""\)\);/);
  });
  test("the aside is the crest, the motto and three promises — no business, no heading", () => {
    const a = src("app/components/crest/CrestAside.tsx").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(a + n.slice(n.indexOf("feat:"), n.indexOf("eyebrow:")), BUSINESS);
    assert.doesNotMatch(a, /<h[1-6]/);
    assert.doesNotMatch(n, /asideTitle|Family and business|Семья и бизнес|Семейный офис/);
  });
  test("after sign-in: the page the person came for, else «Сегодня»", () => {
    assert.match(src("app/[lang]/family/signin/page.tsx"), /safeReturnTo\(returnTo, `\/\$\{lang\}\/family\/os`\)/);
  });
  test("the RU sign-in speaks to the visitor as «вы» throughout", () => {
    const ru = n.split(/^  ru: \{/m)[1].split(/^  \},$/m)[0];
    assert.match(ru, /pkBusyTitle: "Подтвердите на устройстве"/);
    assert.doesNotMatch(ru, /"Подтверди |— войди |Введи /);
  });
});
