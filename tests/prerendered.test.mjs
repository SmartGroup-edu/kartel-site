// Snapshot tests for the prerendered HTML, sitemap, and service worker.
// These read the .next/server/app outputs after `npm run build` and assert
// invariants we care about — i18n correctness + the public/family split:
//   /              → Coat of Arms of the Kartel family (public home, R0 2026-11-14)
//   /core, /registry → KARTEL Core (one click away in the main menu)
//   /family        → Family Heritage members   — GATED (see below)
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
const FAMILY_NAMES = /Piotr|Pi[eo]tr Nikola|Andrey Petrovich|Poloneya|Aleksandr Andreyevich|Lyubov|Nikolai Aleksandrovich|Valentina|Igor Gor|Diana Zenonovna|Diana Kartel|Dominika|Arina|Igor Kaid|Feliks|Subach|Kirey|Mikhal|Chizhevsk|Пётр Картель|Петр Николаевич|Андрей Петрович|Полонея|Александр Андреевич|Любовь Петровна|Николай Александрович|Валентина|Игорь Гор|Диана|Доминика|Арина|Игорь Каид|Феликс|Субоч|Кирей|Михаль|Чижевск/;

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

  test("coat-of-arms title", () => {
    assert.match(html, /<title>Kartel Coat of Arms — Virtus et Potestas<\/title>/);
  });

  test("share card is the coat of arms (og:title + og:image)", () => {
    assert.match(html, /<meta property="og:title" content="Kartel Coat of Arms — Virtus et Potestas"\/>/);
    assert.match(html, /<meta property="og:image" content="https:\/\/kartel\.org\.uk\/opengraph-image"\/>/);
  });

  test("canonical points at /en", () => {
    assert.match(html, /<link rel="canonical" href="https:\/\/kartel\.org\.uk\/en"\/>/);
  });

  test("hreflang en + ru + x-default present", () => {
    assert.match(html, /hrefLang="en"[^>]*href="https:\/\/kartel\.org\.uk\/en"/);
    assert.match(html, /hrefLang="ru"[^>]*href="https:\/\/kartel\.org\.uk\/ru"/);
    assert.match(html, /hrefLang="x-default"/);
  });

  test("JSON-LD WebSite + Organization + FAQPage present, no Person", () => {
    assert.match(html, /"@type":"WebSite"/);
    assert.match(html, /"@type":"Organization"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.doesNotMatch(html, /"@type":"Person"/);
  });

  test("coat-of-arms content rendered", () => {
    assert.match(html, /griffin/i);
    assert.match(html, /Virtus et Potestas/);
  });

  test("KARTEL Core is one click away (main menu)", () => {
    assert.match(html, /href="\/en\/core"/);
    assert.match(html, /href="\/en\/registry"/);
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

  test("Russian coat-of-arms title", () => {
    assert.match(html, /<title>Фамильный герб Картель — Virtus et Potestas<\/title>/);
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

describe("client static files — no family names", () => {
  test("no file under .next/static contains a family name", () => {
    const hits = walk(".next/static").filter((f) => FAMILY_NAMES.test(unescape(readFileSync(f, "utf8"))));
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

  test("lists every public page: /core, /registry/layers, /registry/projects (EN + RU)", () => {
    for (const l of ["en", "ru"]) for (const p of ["core", "registry/layers", "registry/projects"]) {
      assert.match(xml, new RegExp(`<loc>https://kartel\\.org\\.uk/${l}/${p.replace("/", "\\/")}</loc>`));
    }
  });

  test("lists the Core Registry", () => {
    assert.match(xml, /<loc>https:\/\/kartel\.org\.uk\/en\/registry<\/loc>/);
    assert.match(xml, /<loc>https:\/\/kartel\.org\.uk\/ru\/registry<\/loc>/);
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
