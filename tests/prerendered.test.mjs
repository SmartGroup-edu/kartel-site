// Snapshot tests for the prerendered HTML, sitemap, and service worker.
// These read the .next/server/app outputs after `npm run build` and assert
// invariants we care about — i18n correctness + the public/family split:
//   /              → KARTEL the family office, with the Kartel coat of arms below (bus 172 P5, bus 173)
//   /core, /registry → KARTEL Core (one click away in the main menu)
//   /family        → «Наследие» in the family area («Семейный кабинет») — GATED (see below)
//   /family/crest  → 308 to /{lang} (next.config.ts redirects)
//
// The public home carries NO personal data: family names live only in the gated /family area
// (app/content/family-private.ts, server-only). The "no family names" tests below scan the home
// HTML and every client static file.
//
// Run with: npm test  (after npm run build)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const APP = ".next/server/app";

function read(file) {
  return readFileSync(`${APP}/${file}`, "utf8");
}

// Given names, second names and maiden names of the family (EN + RU). The surname is the
// crest's name and is allowed. This list lives in a test file, which is never served.
const FAMILY_NAMES = /Piotr|Pi[eo]tr Nikola|Andrey Petrovich|Poloneya|Aleksandr Andreyevich|Lyubov|Nikolai Aleksandrovich|Valentina|Igor Gor|Diana Zenonovna|Diana Kartel|Dominika|Arina|Igor Kaid|Feliks|Subach|Kirey|Mikhal|Chizhevsk|Пётр Картель|Петр Николаевич|Пётр Николаевич|Андрей Петрович|Полонея|Александр Андреевич|Любовь Петровна|Николай Александрович|Валентина|Игорь Гор|Диана|Доминика|Арина|Игорь Каид|Феликс|Субоч|Кирей|Михаль|Чижевск/;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const unescape = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

describe("/en — Coat of Arms home", () => {
  const html = read("en.html");

  test("html element has lang=en", () => {
    assert.match(html, /<html[^>]*\blang="en"/);
  });

  test("canonical points at /en", () => {
    assert.match(html, /<link rel="canonical" href="https:\/\/kartel\.org\.uk\/en"\/>/);
  });

  test("hreflang en + ru + x-default present", () => {
    assert.match(html, /hrefLang="en"[^>]*href="https:\/\/kartel\.org\.uk\/en"/);
    assert.match(html, /hrefLang="ru"[^>]*href="https:\/\/kartel\.org\.uk\/ru"/);
    assert.match(html, /hrefLang="x-default"/);
  });

  test("coat-of-arms content rendered", () => {
    assert.match(html, /griffin/i);
    assert.match(html, /Virtus et Potestas/);
  });

  test("primary nav has no Projects item (it lives in the registry subnav)", () => {
    assert.doesNotMatch(html, />Projects</);
  });

  test("no family names in the public home HTML", () => {
    assert.doesNotMatch(unescape(html), FAMILY_NAMES);
  });

  test("no personal contact email on the home", () => {
    assert.doesNotMatch(html, /gor@kartel\.org\.uk/);
  });

  test("favicon and apple-touch-icon link tags reference generated routes", () => {
    assert.match(html, /<link rel="icon" href="\/icon"/);
    assert.match(html, /<link rel="apple-touch-icon" href="\/apple-icon"/);
  });
});

describe("/ru — Coat of Arms home", () => {
  const html = read("ru.html");

  test("html element has lang=ru", () => {
    assert.match(html, /<html[^>]*\blang="ru"/);
  });

  test("canonical points at /ru", () => {
    assert.match(html, /<link rel="canonical" href="https:\/\/kartel\.org\.uk\/ru"\/>/);
  });

  test("Russian coat-of-arms body rendered (Cyrillic)", () => {
    assert.match(unescape(html), /грифон/i);
  });

  test("no family names in the public home HTML", () => {
    assert.doesNotMatch(unescape(html), FAMILY_NAMES);
  });

});

describe("family area type scale (cycle 2 #4)", () => {
  const src = (f) => readFileSync(f, "utf8");
  test("H2 28/35, reading text 17/19, captions and level labels 14px, nothing under 14px", () => {
    const tree = src("app/components/FamilyTree.tsx"), tl = src("app/components/FamilyTimeline.tsx"), fc = src("app/components/FamilyClient.tsx");
    for (const f of [tree, tl]) assert.match(f, /<h2 className=\{`[^`]*\$\{H2\}`\}>/);
    assert.match(tl, /mt-2 text-\[17px\][^"]*lg:text-\[19px\]/);
    assert.match(fc, /mt-6 max-w-\[68ch\] text-\[17px\][^"]*lg:text-\[19px\]/);
    for (const f of [tree, tl, fc]) assert.doesNotMatch(f, /text-\[1[0-3]px\]|\btext-xs\b/);
    // one level-label style shared by the desktop and mobile trees
    assert.equal((tree.match(/text-\[14px\] font-medium uppercase tracking-\[0\.15em\]/g) ?? []).length, 2);
  });
});

describe("cycle 3 (2026-11-15)", () => {
  const src = (f) => readFileSync(f, "utf8");
  test("#1 family H1 on the home scale (36/44/54, leading 1.1)", () => {
    assert.match(src("app/components/FamilyClient.tsx"), /<h1 className=\{H1\}>/);
    assert.match(src("app/lib/typeScale.ts"), /export const H1 = "font-serif text-\[36px\] leading-\[1\.1\][^"]*md:text-\[44px\] lg:text-\[54px\]"/);
  });
  test("#2 desktop tree: layout-derived connectors, label 24px clear of the children's bar", () => {
    const tree = src("app/components/FamilyTree.tsx");
    assert.doesNotMatch(tree, /<svg|viewBox|style=\{\{ (left|top|height):/);
    assert.match(tree, /level\.length > 2 \? "mb-6" : "mb-3"/);
    assert.match(tree, /grid-cols-\[1fr_2\.5rem_1fr\]/);
    assert.match(tree, /isHovered=\{hoveredId === node\.id\}/);
    assert.doesNotMatch(tree, /hoveredId === "/);
  });
});

describe("cycle 4 — one type system for Core and the registry (2026-11-15)", () => {
  const src = (f) => readFileSync(f, "utf8");
  const scale = src("app/lib/typeScale.ts");
  const PAGES = ["CoreAbout", "RegistryDashboard", "LayersDashboard", "ProjectsDirectory", "FederationMap", "CampusRegistry", "OrganisationsRegistry"].map((n) => `app/components/${n}.tsx`);
  const SITE = [...PAGES, ...["FamilyClient", "FamilyTree", "FamilyTimeline"].map((n) => `app/components/${n}.tsx`)];
  test("#1 one source: H1 36/44/54 accent, H2 28/35 accent, H3 22/24 foreground", () => {
    assert.match(scale, /export const H1 = "font-serif text-\[36px\] leading-\[1\.1\] tracking-\[-0\.01em\] text-\[var\(--accent\)\] md:text-\[44px\] lg:text-\[54px\]"/);
    assert.match(scale, /export const H2 = "font-serif text-\[28px\] leading-\[1\.15\] text-\[var\(--accent\)\] lg:text-\[35px\]"/);
    assert.match(scale, /export const H3 = "font-serif text-\[22px\] leading-\[1\.2\] text-\[var\(--foreground\)\] lg:text-\[24px\]"/);
  });
  test("#1 every h1/h2/h3 on public pages reads its class from the scale", () => {
    for (const f of SITE) {
      for (const m of src(f).matchAll(/<h([123]) className=([^>]*)>/g)) {
        assert.match(m[2], new RegExp(`(^\\{H${m[1]}\\}$|\\$\\{H${m[1]}\\})`), `${f}: <h${m[1]} className=${m[2]}>`);
      }
    }
  });
  test("#2 Core prose on the reading scale with a 68ch measure", () => {
    assert.match(scale, /export const PROSE = "text-\[17px\] leading-\[1\.65\][^"]*lg:text-\[19px\]/);
    assert.equal((src("app/components/CoreAbout.tsx").match(/max-w-\[68ch\] \$\{PROSE\}/g) ?? []).length, 2);
  });
  test("#3 14px floor: no text-xs / 12–13px / uppercase-tracked labels on Core and registry", () => {
    for (const f of PAGES) assert.doesNotMatch(src(f), /\btext-xs\b|text-\[1[0-3]px\]|uppercase tracking-wide/, f);
  });
  test("#3 one pill: 14px, sentence case, at least 24px tall, used by every registry page", () => {
    const pill = src("app/components/Pill.tsx");
    assert.match(pill, /min-h-6 [^"`]*text-\[14px\]/);
    assert.doesNotMatch(pill, /uppercase/);
    assert.match(pill, /toLocaleUpperCase\(\) \+ s\.slice\(1\)/);
    for (const f of ["RegistryDashboard", "LayersDashboard", "ProjectsDirectory", "FederationMap", "OrganisationsRegistry"]) {
      const c = src(`app/components/${f}.tsx`);
      assert.match(c, /<Pill tone=/, f);
      assert.doesNotMatch(c, /rounded-full border px-2\.5/, f);
    }
  });
  test("#4 snapshot label wording EN/RU (registry v14 and federation)", () => {
    assert.ok(read("en/registry.html").includes("Snapshot v14 · data as of 26 November 2026"));
    assert.ok(read("ru/registry.html").includes("Снимок v14 · данные на 26 ноября 2026"));
    assert.ok(read("en/registry/federation.html").includes("Snapshot · data as of 25 November 2026"));
    assert.ok(read("ru/registry/federation.html").includes("Снимок · данные на 25 ноября 2026"));
    assert.doesNotMatch(read("en/registry.html"), /Updated: 2026/);
  });
  test("#5 project cards: two-column definition list, not uppercase tags", () => {
    const d = src("app/components/RegistryDashboard.tsx");
    assert.match(d, /<dl className="mt-4 grid grid-cols-\[auto_minmax\(0,1fr\)\] items-center gap-x-4 gap-y-2">/);
    assert.match(d, /<dt className="text-\[14px\] text-\[var\(--muted\)\]">/);
  });
});

describe("registry v11 rendered (bus 155: v9 one CEA CIC, v10 country → region, v11 Keycloak retired)", () => {
  const text = (f) => read(f).replace(/<[^>]+>/g, " ");
  const PAGES = ["core", "registry", "registry/layers", "registry/projects", "registry/organisations", "registry/campuses", "registry/federation"];
  test("no page presents Keycloak as required or as the identity steward", () => {
    for (const l of ["en", "ru"]) for (const p of PAGES) {
      const t = text(`${l}/${p}.html`);
      assert.doesNotMatch(t, /Keycloak realm|shared Keycloak|Keycloak\/OIDC identity|mirrored Keycloak/, `${l}/${p}`);
    }
  });
  test("the gate says sign-in through Keycloak is not required (EN + RU)", () => {
    assert.ok(text("en/registry.html").includes("Sign-in through Keycloak is not required."));
    assert.ok(text("ru/registry.html").includes("Вход через Keycloak не требуется."));
  });
  test("layers: geography is countries → regions, with the v10 and v11 change notes", () => {
    const t = text("en/registry/layers.html");
    assert.ok(t.includes("CountryCode (ISO 3166-1 alpha-2, e.g. GB, LV)"));
    assert.ok(t.includes("ISO 3166-2 elsewhere"));
    assert.ok(t.includes("v10 (2026-11-15"));
    assert.ok(t.includes("v11 (2026-11-24): Keycloak retired as an ecosystem requirement"));
    assert.ok(t.includes("KARTEL Core (identity provider under replacement)"));
  });
  test("organisations: one CEA CIC, RUSJAZ-FDN only as lineage, ZNANIYE and BALTICA under CEA", () => {
    const en = read("en/registry/organisations.html"), ru = read("ru/registry/organisations.html");
    assert.doesNotMatch(en, />RUSJAZ-FDN</);
    assert.ok(text("en/registry/organisations.html").includes("RUSJAZ-FDN retired"));
    assert.ok(en.includes(">RU-ONLINE-EUREKA<"));
    assert.ok(ru.includes("Русский Онлайн с ЭВРИКОЙ"));
    assert.doesNotMatch(en + ru, /RusJAz Foundation/);
  });
  test("core: geography is countries and regions (EN + RU)", () => {
    assert.ok(text("en/core.html").includes("countries (ISO 3166-1) and, within them, regions"));
    assert.ok(text("ru/core.html").includes("страны (ISO 3166-1) и регионы внутри них"));
  });
});

describe("cycle 5 — 404 locale, titles, one name per page, one casing (2026-11-15)", () => {
  const src = (f) => readFileSync(f, "utf8");
  test("#1 proxy forwards the locale; the global 404 reads it and renders one language", () => {
    assert.match(src("proxy.ts"), /forwarded\.set\("x-kartel-locale", firstSegment\);\s*return NextResponse\.next\(\{ request: \{ headers: forwarded \} \}\);/);
    const g = src("app/global-not-found.tsx");
    assert.match(g, /\.get\("x-kartel-locale"\) === "ru" \? "ru" : "en"/);
    assert.match(g, /<html lang=\{lang\}/);
    assert.match(g, /<NotFoundView lang=\{lang\} \/>/);
    assert.doesNotMatch(g, /lang="ru"|На главную|Return home/);
    // bus 176 P1: the public 404 is the crest page — «На главную» and «Войти», no registry link
    const v = src("app/components/NotFoundView.tsx");
    assert.match(v, /if \(!refCode\) return <CrestNotFound lang=\{lang\} \/>;/);
    assert.match(src("app/content/notFound.ts"), /home: "Home page",[\s\S]*signin: "Sign in",[\s\S]*home: "На главную",[\s\S]*signin: "Войти",/);
  });
  test("#2 tab-title brand is KARTEL in both locales", () => {
    assert.doesNotMatch(src("app/[lang]/layout.tsx"), /КАРТЕЛЬ/);
    for (const f of ["ru/core.html", "ru/registry.html", "ru/registry/layers.html"]) assert.match(read(f), /<title>[^<]* \| KARTEL<\/title>/, f);
  });
  test("#3 every registry subpage: subnav label == H1 == title (EN + RU)", () => {
    const all = src("app/content/siteNav.ts");
    const nav = all.slice(all.indexOf("const REGISTRY_SECTIONS"), all.indexOf("} as const;", all.indexOf("const REGISTRY_SECTIONS")));
    let checked = 0;
    for (const [lang, block] of [["en", nav.slice(nav.indexOf("EN: ["), nav.indexOf("RU: ["))], ["ru", nav.slice(nav.indexOf("RU: ["))]]) {
      for (const m of block.matchAll(/\{ label: "([^"]+)", path: "registry\/([a-z]+)" \}/g)) {
        const [, label, slug] = m;
        const html = read(`${lang}/registry/${slug}.html`);
        const h1 = html.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1];
        const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
        assert.equal(h1, label, `${lang}/${slug} H1`);
        assert.equal(title, `${label} | KARTEL`, `${lang}/${slug} title`);
        checked++;
      }
    }
    assert.equal(checked, 10); // 5 subpages × 2 languages
  });
  test("#4–5 one dictionary, sentence case: lowercase maps, no per-page label maps", () => {
    const t = src("app/content/tokens.ts");
    for (const m of t.matchAll(/^\s+(?:"[^"]+"|[a-z_-]+): "([^"]+)",$/gm)) assert.equal(m[1], m[1].toLowerCase(), m[1]);
    assert.match(t, /return sentence\(lang === "EN" \? \(EN_DISPLAY\[key\] \?\? key\) : \(map\[key\] \?\? key\)\);/);
    assert.doesNotMatch(src("app/content/organisations.ts"), /tierLabels/);
    assert.doesNotMatch(src("app/content/layers.ts"), /statusLabels/);
    const ru = read("ru/registry/organisations.html"), en = read("en/registry/organisations.html");
    assert.ok(ru.includes(">Школа<") && !ru.includes(">SCHOOL<"));
    assert.ok(en.includes(">School<") && !en.includes(">SCHOOL<"));
    // v12 (bus 161): no project is "Producer / Steward" any more; the mixed-case JSON token "Retired" is the case check.
    assert.ok(read("ru/registry/projects.html").includes(">Упразднён<"));
    assert.ok(read("en/registry/projects.html").includes(">Retired<"));
    assert.ok(!read("en/registry/projects.html").includes(">RETIRED<"));
  });
});

describe("registry v12 rendered (bus 161: federation snapshot regenerated, MoyPolk retired)", () => {
  const text = (f) => read(f).replace(/<[^>]+>/g, " ");
  test("projects: MoyPolk retired into Community Group; community.group serves geography (EN + RU)", () => {
    const en = text("en/registry/projects.html"), ru = text("ru/registry/projects.html");
    assert.ok(en.includes("Brand retired into Community Group on 3 November 2026"));
    assert.ok(ru.includes("Бренд упразднён 3 ноября 2026 года и вошёл в Community Group"));
    assert.ok(en.includes("Serves the canonical geography taxonomy (regions and countries)"));
    assert.doesNotMatch(en + ru, /Produces and serves the canonical geography|first geography consumer|Производит и обслуживает каноническую/);
  });
  test("federation map: no RUSJAZ-FDN, all five campuses, community.group steward", () => {
    for (const l of ["en", "ru"]) {
      const h = read(`${l}/registry/federation.html`);
      assert.doesNotMatch(h, /RUSJAZ-FDN|RusJAz Foundation/, l);
      for (const c of ["ZNANIYE-CHELSEA", "ZNANIYE-EALING", "ZNANIYE-STRATFORD", "ZNANIYE-FINCHLEY", "BALTICA-LEEDS", "RU-ONLINE-EUREKA"]) assert.ok(h.includes(`>${c}<`), `${l} ${c}`);
    }
    assert.ok(read("ru/registry/federation.html").includes(">Упразднён<"));
  });
});

describe("registry v13 rendered (bus 163: community.group identity off, drift fixes)", () => {
  const text = (f) => read(f).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  test("community.group identity is off on projects and the federation map (EN + RU)", () => {
    assert.ok(read("en/registry/projects.html").includes(">Off<"));
    assert.ok(read("ru/registry/projects.html").includes(">Отключено<"));
    assert.ok(text("en/registry/federation.html").includes("Community Group Steward 0 Identity: Off"));
    assert.ok(text("ru/registry/federation.html").includes("Community Group Стюард 0 Идентичность: Отключено"));
    assert.ok(text("en/registry/projects.html").includes("Federated sign-in has been switched off since 6 November 2026."));
    assert.ok(text("ru/registry/projects.html").includes("Федеративный вход отключён с 6 ноября 2026 года."));
    assert.doesNotMatch(text("en/registry/projects.html") + text("ru/registry/projects.html"), /consumes identity\. Home|потребляет идентичность\. Здесь/);
  });
  test("integrity: stray nodes back to 1, subjects band Active, band localised on RU", () => {
    assert.ok(text("en/registry/federation.html").includes("Stray nodes 1 Federated subjects on non-canonical nodes Active"));
    assert.ok(text("ru/registry/federation.html").includes("Висячие узлы 1 Федеративные субъекты на неканонических узлах Активно"));
  });
});

describe("registry v14 rendered (bus 164: MoyPolk stewards nothing, post-v9 organisation model)", () => {
  const text = (f) => read(f).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  test("MoyPolk is steward of no layer; audit steward is pending R0 (EN + RU)", () => {
    for (const l of ["en", "ru"]) assert.doesNotMatch(text(`${l}/registry.html`) + text(`${l}/registry/layers.html`), /Audit Envelope contract MoyPolk|Конверт аудита контракт MoyPolk/, l);
    assert.ok(text("en/registry.html").includes("Unknown (pending R0)"));
    assert.ok(text("ru/registry.html").includes("не определён (ждёт решения R0)"));
    assert.ok(read("ru/registry/projects.html").includes(">Упразднено<"));
  });
  test("organisations: the vendored registry carries the post-v9 model, no Foundation tier", () => {
    const reg = JSON.parse(readFileSync("app/content/registry.public.json", "utf8"));
    assert.match(reg.organisationRegistry.authority, /one CEA CIC → School/);
    assert.doesNotMatch(reg.organisationRegistry.authority, /\(per the ratified Org Architecture CEA → Foundation → School\)/);
    assert.match(reg.layerRegistry.find((l) => l.key === "organisation").purpose, /^One canonical organisation hierarchy: CEA CIC → School → Venue/);
  });
  test("/core and the site description no longer list MoyPolk as a live platform (EN + RU)", () => {
    assert.ok(text("en/core.html").includes("MoyPolk (Immortal Regiment UK memorial) was retired as a brand on 3 November 2026"));
    assert.ok(text("ru/core.html").includes("Бренд MoyPolk (мемориал «Бессмертный полк UK») упразднён 3 ноября 2026 года"));
    assert.doesNotMatch(read("en/core.html") + read("ru/core.html"), /shared by MoyPolk, RusJAz|для MoyPolk, RusJAz/);
  });
});

describe("cycle 6 — sign-in pages and the mobile menu (2026-11-15)", () => {
  const src = (f) => readFileSync(f, "utf8");
  test("#3 mobile menu: container focus, no ring, 17px rows ≥48px, current bar, closes on route change", () => {
    const h = src("app/components/SiteHeader.tsx");
    assert.match(h, /useFocusTrap<HTMLDivElement>\(menuOpen, \{ initialFocus: "container" \}\)/);
    assert.match(h, /tabIndex=\{-1\}[\s\S]{0,600}style=\{\{ outline: "none" \}\}/);
    assert.match(h, /flex-col px-4 py-2 text-\[17px\]/);
    assert.match(h, /flex min-h-12 items-center border-l-2 pl-3/);
    assert.match(h, /"border-\[var\(--accent\)\] font-medium text-\[var\(--accent\)\]" : "border-transparent"/);
    assert.match(h, /if \(menuPath !== pathname\) \{\s*setMenuPath\(pathname\);\s*setMenuOpen\(false\);/);
    assert.match(h, /"invisible max-h-0 opacity-0 border-t-0"/);
    assert.match(src("app/components/useFocusTrap.ts"), /initialFocus === "container"\) \{\s*container\.focus\(\{ preventScroll: true \}\);/);
  });
});

describe("cycle 7 — share card, print, sign-in email (2026-11-15)", () => {
  const src = (f) => readFileSync(f, "utf8");
  const png = (f) => readFileSync(`${APP}/${f}`);
  test("#1 share cards: EN at /opengraph-image, RU at /ru/opengraph-image, both 1200×630 PNG", () => {
    for (const f of ["opengraph-image.body", "en/opengraph-image.body", "ru/opengraph-image.body"]) {
      const b = png(f);
      assert.equal(b.subarray(1, 4).toString(), "PNG", f);
      assert.equal(b.readUInt32BE(16), 1200, f);
      assert.equal(b.readUInt32BE(20), 630, f);
    }
    assert.notDeepEqual(png("en/opengraph-image.body"), png("ru/opengraph-image.body"));
  });
  test("#1 RU pages point og:image and twitter:image at the RU card; EN keeps its URL", () => {
    for (const f of ["ru.html", "ru/core.html", "ru/registry.html", "ru/registry/federation.html"]) {
      const h = read(f);
      assert.match(h, /<meta property="og:image" content="https:\/\/kartel\.org\.uk\/ru\/opengraph-image"\/>/, f);
      assert.match(h, /<meta name="twitter:image" content="https:\/\/kartel\.org\.uk\/ru\/opengraph-image"\/>/, f);
      assert.equal((h.match(/property="og:image"/g) ?? []).length, 1, `${f}: one og:image`);
    }
    assert.match(read("en/core.html"), /<meta property="og:image" content="https:\/\/kartel\.org\.uk\/opengraph-image"\/>/);
  });
  test("#1 card layout: serif fonts embedded (latin+cyrillic TTF), sizes for a 400px thumbnail, no names", () => {
    const c = src("app/lib/ogCard.tsx");
    for (const f of ["Regular", "SemiBold", "Italic"]) assert.match(c, new RegExp(`app/og-fonts/SourceSerif4-${f}\\.ttf`));
    assert.match(c, /width=\{486\} height=\{540\}/);
    assert.match(c, /fontSize: lang === "ru" \? 62 : 68/);
    assert.match(c, /fontSize: 38, fontStyle: "italic"/);
    assert.match(c, /fontSize: 28, color: MUTED/);
    assert.doesNotMatch(c, FAMILY_NAMES);
  });
  test("#2 one print stylesheet: chrome and controls hidden, fades shown, A4, rows kept whole", () => {
    const css = src("app/globals.css");
    assert.equal((css.match(/@media print/g) ?? []).length, 1);
    const p = css.slice(css.indexOf("@media print"));
    assert.match(p, /size: A4;/);
    assert.match(p, /\[data-site-header\],\s*button:not\(:has\(img\)\),\s*\[role="menu"\],\s*\[data-section-nav\]\s*\{\s*display: none !important;/);
    assert.match(p, /\[data-fade\],\s*img\s*\{\s*opacity: 1 !important;/);
    assert.match(p, /a\[href\^="http"\]:not\(\[href\^="https:\/\/kartel\.org\.uk"\]\)::after \{\s*content: " \(" attr\(href\) "\)";/);
    assert.match(p, /tr,/);
    assert.doesNotMatch(p, /^\s*header,\s*$/m); // the old rule hid every <header>, page heroes included
    assert.match(src("app/components/FadeInSection.tsx"), /data-fade=""/);
    assert.match(src("app/components/SiteHeader.tsx"), /<header data-site-header=""/);
  });
  test("#3 the app sends its link lifetime and language to the relay", () => {
    assert.match(src("app/lib/family-mail.ts"), /JSON\.stringify\(\{ to, link, ttlMinutes: familyEnv\.linkTtlMinutes\(\), lang, \.\.\.\(code \? \{ code \} : \{\}\) \}\)/);
    assert.match(src("app/api/family-auth/request/route.ts"), /sendSignInLink\(addr, url, returnTo\.startsWith\("\/ru"\) \? "ru" : "en", code\)/);
  });
});

describe("cycle 8 — accessible language, hreflang, heading outline (2026-11-15)", () => {
  const PAGES = ["", "/core", "/registry", "/registry/layers", "/registry/projects", "/registry/federation", "/registry/campuses", "/registry/organisations"];
  const file = (lang, p) => (p ? `${lang}${p}.html` : `${lang}.html`);
  // Server HTML without scripts (RSC payload) and without the noscript fallback.
  const body = (h) => h.slice(h.indexOf("<body")).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
  const decode = (v) => v.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  // Names allowed to be Latin on a Russian page: the brand, the motto, project names, codes.
  // bus 176: alt="" is a decorative crest (the wordmark, the intro) — empty, not English
  const LATIN_OK = /^(|KARTEL|Virtus et Potestas|MoyPolk|RusJAz|RusJAzz|Community Group|community\.group|[a-z0-9.:/_-]+|[A-Za-z]+[A-Z][A-Za-z0-9]*)$/;
  test("#1 RU pages: every aria-label / title / alt is Russian (server HTML)", () => {
    const bad = [];
    for (const p of PAGES) {
      for (const m of body(read(file("ru", p))).matchAll(/\s(aria-label|title|alt)="([^"]*)"/g)) {
        const v = decode(m[2]);
        if (!/[А-Яа-яЁё]/.test(v) && !LATIN_OK.test(v)) bad.push(`ru${p}: ${m[1]}="${v}"`);
      }
    }
    assert.deepEqual(bad, []);
  });
  test("#1 the check fires: the EN theme-toggle label would be caught", () => {
    assert.ok(!/[А-Яа-яЁё]/.test("Switch to dark mode") && !LATIN_OK.test("Switch to dark mode"));
  });
  test("#2 every visible 'Virtus et Potestas' carries lang=\"la\" (EN + RU)", () => {
    const bad = [];
    for (const lang of ["en", "ru"]) for (const p of PAGES) {
      const b = body(read(file(lang, p)));
      for (const m of b.matchAll(/>([^<]*)Virtus et Potestas/g)) {
        const tag = b.slice(b.lastIndexOf("<", m.index), m.index + 1);
        if (m[1].length || !/\slang="la"/.test(tag)) bad.push(`${lang}${p}: ${tag.slice(0, 60)}`);
      }
    }
    assert.deepEqual(bad, []);
  });
  test("#3 hreflang: en, ru and x-default (→ EN) on every public page", () => {
    for (const lang of ["en", "ru"]) for (const p of PAGES) {
      const h = read(file(lang, p));
      const alt = Object.fromEntries([...h.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
      assert.equal(alt.en, `https://kartel.org.uk/en${p}`, `${lang}${p} en`);
      assert.equal(alt.ru, `https://kartel.org.uk/ru${p}`, `${lang}${p} ru`);
      assert.equal(alt["x-default"], `https://kartel.org.uk/en${p}`, `${lang}${p} x-default`);
    }
  });
  test("#3 sitemap: every page URL carries en, ru and x-default alternates", () => {
    const xml = readFileSync(`${APP}/sitemap.xml.body`, "utf8");
    const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]).filter((u) => !/llms/.test(u));
    assert.equal(urls.length, 2, "bus 176 P1: only /en and /ru are public");
    for (const u of urls) for (const l of ["en", "ru", "x-default"]) assert.match(u, new RegExp(`hreflang="${l}"`), u.slice(0, 80));
  });
  test("#4 heading outline: exactly one H1, no skipped levels (EN + RU)", () => {
    for (const lang of ["en", "ru"]) for (const p of PAGES) {
      const levels = [...body(read(file(lang, p))).matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
      assert.equal(levels.filter((l) => l === 1).length, 1, `${lang}${p}: H1 count`);
      assert.equal(levels[0], 1, `${lang}${p}: first heading is H1`);
      levels.forEach((l, i) => i && assert.ok(l <= levels[i - 1] + 1, `${lang}${p}: h${levels[i - 1]} → h${l}`));
    }
  });
});

describe("cycle 8 — axe serious findings fixed (2026-11-15)", () => {
  const src = (f) => readFileSync(f, "utf8");
  test("language switch: accessible name starts with the visible RU/EN (label in name)", () => {
    assert.match(src("app/components/SiteHeader.tsx"), /aria-label=\{lang === "EN" \? "RU — switch language to Russian" : "EN — переключить язык на английский"\}/);
    // bus 176 P1: the crest pages' RU / EN are links whose name is their visible text (no aria-label to drift)
    assert.match(read("ru.html"), /<a hrefLang="en" lang="en"[^>]*href="\/en"[^>]*>EN<\/a>|<a[^>]*hrefLang="en"[^>]*>EN<\/a>/);
  });
  test("scrolling table wrappers are focusable, named regions", () => {
    for (const f of ["CampusRegistry", "OrganisationsRegistry", "ProjectsDirectory", "RegistryDashboard", "FederationMap"]) {
      const c = src(`app/components/${f}.tsx`);
      const wrappers = [...c.matchAll(/<div [^>]*overflow-x-auto[^>]*>/g)].map((m) => m[0]);
      assert.ok(wrappers.length > 0, f);
      for (const w of wrappers) assert.match(w, /tabIndex=\{0\} role="region" aria-label=\{/, f);
    }
  });
  test("family tree cards are content, not buttons; the desktop tree is a group, not an image", () => {
    const t = src("app/components/FamilyTree.tsx");
    assert.doesNotMatch(t, /role="button"|role="img"|tabIndex=\{0\}/);
    assert.match(t, /data-tree-card=""/);
  });
});

describe("cycle 11 — family tree readability (2026-11-15)", () => {
  const t = readFileSync("app/components/FamilyTree.tsx", "utf8");
  test("#1 a card shows its role only when it differs from the level's default role", () => {
    assert.match(t, /function distinctRole\(node: TreeNode, lang: "EN" \| "RU"\): string \| null/);
    assert.match(t, /return role\.trim\(\)\.toLowerCase\(\) === generic\.toLowerCase\(\) \? null : role;/);
    assert.equal((t.match(/const role = distinctRole\(node, lang\);/g) ?? []).length, 2);
    assert.match(t, /\{role && <p className="mt-1 text-\[14px\] text-\[var\(--muted\)\]">\{role\}<\/p>\}/);
    // the default roles cover every level the data uses, in both languages
    const fp = readFileSync("app/content/family-private.ts", "utf8");
    for (const g of ["root", "founder", "ancestor", "grandparent", "elder", "current", "next"]) {
      assert.match(t, new RegExp(`${g}: \\{ en: "[^"]+", ru: "[^"]+" \\}`), g);
      assert.match(fp, new RegExp(`generation: "${g}"`), g);
    }
  });
  test("#2 desktop: equal widths per level (two 1fr columns in a fit-content grid), long names wrap", () => {
    assert.match(t, /mx-auto grid w-fit max-w-full grid-cols-\[1fr_2\.5rem_1fr\] items-stretch/);
    assert.match(t, /mx-auto grid w-fit max-w-full auto-cols-fr grid-flow-col/);
    assert.match(t, /w-full rounded border text-center/);
    assert.match(t, /md:max-w-\[18rem\]/);
  });
  test("#3 mobile: a couple is one paired card, '&' read as and/и", () => {
    assert.match(t, /level\.length === 2 \? \(\s*<CoupleCard /);
    assert.match(t, /data-tree-couple=""/);
    assert.match(t, /<span className="sr-only">\{lang === "EN" \? "and" : "и"\}<\/span>/);
  });
  test("#4 names are rendered straight from the data (no transformation)", () => {
    assert.match(t, /\{lang === "EN" \? node\.nameEN : node\.nameRU\}/);
    assert.match(t, /const name = lang === "EN" \? node\.nameEN : node\.nameRU;/);
    assert.doesNotMatch(t, /name[A-Z]{2}\.(replace|normalize|toLowerCase|toUpperCase)/);
  });
});

describe("cycle 12 — chronicle memorial block (2026-11-15)", () => {
  // Approved strings. RU: the original from main (cycle 12). EN: R0 decision 2026-11-15 — the closing
  // words are "In loving memory." (was "In cherished memory."); nothing else in the sentence changed.
  // Any other change to wording, dates or names fails here and needs its own recorded decision.
  test("memorial moved into data fields verbatim: rebuilding the old sentence matches the original's hash", async () => {
    const { createHash } = await import("node:crypto");
    const src = readFileSync("app/content/family-private.ts", "utf8");
    const entry = src.slice(src.indexOf('id: "elders"'), src.indexOf("memorial: {", src.indexOf('id: "elders"')) + 2000);
    const str = (k, from = entry) => JSON.parse(from.match(new RegExp(`${k}: ("(?:[^"\\\\]|\\\\.)*")`))[1]);
    const mem = (lang) => {
      const blk = entry.slice(entry.indexOf(`${lang}: { name:`));
      const pair = (k) => JSON.parse(blk.match(new RegExp(`${k}: (\\["[^\\]]*\\])`))[1]);
      return { name: str("name", blk), born: pair("born"), died: pair("died"), burial: str("burial", blk), words: str("words", blk) };
    };
    const sha = (x) => createHash("sha256").update(x, "utf8").digest("hex");
    for (const [lang, key, want] of [["en", "descEN", "d26f712fe20fa696dc74da964687183ed66f2797dc8f0a6329750e15e8fdb324"], ["ru", "descRU", "8a7859972305629e97ff3de7f84335f9eea545a42827a01e25b9086454ec39e1"]]) {
      const m = mem(lang);
      const rebuilt = `${str(key)} ${m.name}: ${m.born[0]}, ${m.born[1]} — ${m.died[0]}, ${m.died[1]}. ${m.burial} ${m.words}`;
      assert.equal(sha(rebuilt), want, lang);
      assert.doesNotMatch(str(key), /\d{4}/, `${lang}: dates left the entry paragraph`);
    }
  });
  test("one spelling per person: every memorial name is, verbatim, a tree-card name (R0 2026-11-15)", () => {
    const src = readFileSync("app/content/family-private.ts", "utf8");
    const tree = src.slice(src.indexOf("FAMILY_TREE_NODES"), src.indexOf("];", src.indexOf("FAMILY_TREE_NODES")));
    const names = { en: [...tree.matchAll(/nameEN: ("(?:[^"\\]|\\.)*")/g)].map((m) => JSON.parse(m[1])), ru: [...tree.matchAll(/nameRU: ("(?:[^"\\]|\\.)*")/g)].map((m) => JSON.parse(m[1])) };
    const mems = [...src.matchAll(/(en|ru): \{ name: ("(?:[^"\\]|\\.)*")/g)];
    assert.ok(mems.length >= 2);
    for (const [, lang, raw] of mems) assert.ok(names[lang].includes(JSON.parse(raw)), `${lang} memorial name is not spelled as on the tree`);
  });
  test("rendered as its own quiet block: left rule, whole date groups, italic serif close, no icons", () => {
    const tl = readFileSync("app/components/FamilyTimeline.tsx", "utf8");
    const at = tl.indexOf("{event.memorial && ");
    const blk = tl.slice(at, tl.indexOf("})()}", at) + 4);
    assert.match(blk, /data-memorial="" className="mt-5 border-l-2 border-\[var\(--border\)\] pl-4/);
    assert.equal((blk.match(/<span className="whitespace-nowrap">/g) ?? []).length, 2);
    assert.match(blk, /font-serif italic/);
    assert.doesNotMatch(blk, /<svg|<img|✝|†|☦/);
  });
});


describe("client static files — no family names", () => {
  test("no file under .next/static contains a family name", () => {
    const hits = walk(".next/static").filter((f) => FAMILY_NAMES.test(unescape(readFileSync(f, "utf8"))));
    assert.deepEqual(hits, []);
  });
  test("no lowercase given-name id literal in any client chunk (cycle 3 finding)", () => {
    const ID = /["'](piotr|andrey|poloneya|aleksandr|lyubov|nikolai|valentina|igor|diana|dominika|arina|feliks)(_[a-z]+)?["']/i;
    const hits = walk(".next/static").filter((f) => ID.test(readFileSync(f, "utf8")));
    assert.deepEqual(hits, []);
  });
});

// Family Heritage is a GATED, dynamic area: force-dynamic + a per-request auth guard
// (family/page.tsx, family/crest/page.tsx). SECURITY INVARIANT — its content must NOT be
// statically prerendered, so an unauthenticated request can never be served family PII from
// a cached HTML file. (This is the regression these tests now guard, after the 2026-07-16
// leak: proxy-gate-on but no page guard served the full family page statically.)
describe("/family (gated) and the old /family/crest URL — NOT statically prerendered", () => {
  const notPrerendered = (f) =>
    assert.throws(
      () => read(f),
      /ENOENT|no such file/i,
      `${f} MUST NOT be a static prerender — it is a gated dynamic page`,
    );

  test("/en/family is not a static HTML file", () => notPrerendered("en/family.html"));
  test("/ru/family is not a static HTML file", () => notPrerendered("ru/family.html"));
  test("/en/family/crest is not a static HTML file", () => notPrerendered("en/family/crest.html"));
  test("/ru/family/crest is not a static HTML file", () => notPrerendered("ru/family/crest.html"));
});

describe("sitemap.xml", () => {
  const xml = read("sitemap.xml.body");

  test("lists /en and /ru as canonical pages", () => {
    assert.match(xml, /<loc>https:\/\/kartel\.org\.uk\/en<\/loc>/);
    assert.match(xml, /<loc>https:\/\/kartel\.org\.uk\/ru<\/loc>/);
  });

  test("does NOT list /family (hidden until registration + admin approval)", () => {
    assert.doesNotMatch(xml, /<loc>https:\/\/kartel\.org\.uk\/en\/family<\/loc>/);
    assert.doesNotMatch(xml, /<loc>https:\/\/kartel\.org\.uk\/ru\/family<\/loc>/);
  });

  test("does NOT list the coat-of-arms (/family/crest) while family is hidden", () => {
    assert.doesNotMatch(xml, /<loc>https:\/\/kartel\.org\.uk\/en\/family\/crest<\/loc>/);
    assert.doesNotMatch(xml, /<loc>https:\/\/kartel\.org\.uk\/ru\/family\/crest<\/loc>/);
  });

  test("does not list legacy ?lang= URLs", () => {
    assert.doesNotMatch(xml, /\?lang=/);
  });

  test("includes hreflang alternates for each page", () => {
    assert.match(xml, /hreflang="en"/);
    assert.match(xml, /hreflang="ru"/);
  });
});

describe("service worker", () => {
  const sw = read("sw.js.body");

  test("cache name is versioned (not the hardcoded old constant)", () => {
    assert.doesNotMatch(sw, /CACHE_NAME = "kartel-20260420"/);
    assert.match(sw, /CACHE_NAME = "kartel-(dev-\d+|[a-f0-9]{8,12})"/);
  });

  test("pre-caches the canonical landing pages", () => {
    assert.match(sw, /"\/"/);
  });

  test("does NOT pre-cache the hidden family pages", () => {
    assert.doesNotMatch(sw, /"\/family"/);
    assert.doesNotMatch(sw, /"\/family\/crest"/);
  });
});
