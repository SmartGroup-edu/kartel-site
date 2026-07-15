// Snapshot tests for the prerendered HTML, sitemap, and service worker.
// These read the .next/server/app outputs after `npm run build` and assert
// invariants we care about — i18n correctness + the Core/Family split:
//   /              → KARTEL Core (authority surface)
//   /registry      → Core Registry dashboard
//   /family        → Family Heritage members   — HIDDEN (see below)
//   /family/crest  → Coat of Arms (heraldry)   — HIDDEN (see below)
//
// Family Heritage is currently HIDDEN from visitors: proxy.ts redirects
// /{en,ru}/family(/*) to the homepage, and the pages are excluded from the
// sitemap, service-worker precache and nav. The page components are still
// prerendered (kept for re-enabling), so the /family* HTML snapshot tests below
// still run and guard that content — but sitemap/sw MUST NOT advertise them.
// Intended future access model (NOT built here): registration + admin approval
// via CPIF / Keycloak (Federation v2) — not bespoke auth, and no PII on this
// public no-PII authority surface. Until then these stay hidden.
//
// Run with: npm test  (after npm run build)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const APP = ".next/server/app";

function read(file) {
  return readFileSync(`${APP}/${file}`, "utf8");
}

describe("/en — KARTEL Core home", () => {
  const html = read("en.html");

  test("html element has lang=en", () => {
    assert.match(html, /<html[^>]*\blang="en"/);
  });

  test("KARTEL Core title (no longer coat-of-arms)", () => {
    assert.match(html, /<title>KARTEL Core — federation authority, registry, governance<\/title>/);
  });

  test("canonical points at /en", () => {
    assert.match(html, /<link rel="canonical" href="https:\/\/kartel\.org\.uk\/en"\/>/);
  });

  test("hreflang en + ru + x-default present", () => {
    assert.match(html, /hrefLang="en"[^>]*href="https:\/\/kartel\.org\.uk\/en"/);
    assert.match(html, /hrefLang="ru"[^>]*href="https:\/\/kartel\.org\.uk\/ru"/);
    assert.match(html, /hrefLang="x-default"/);
  });

  test("JSON-LD WebSite + Organization present", () => {
    assert.match(html, /"@type":"WebSite"/);
    assert.match(html, /"@type":"Organization"/);
  });

  test("Core body content rendered (canonical layers)", () => {
    assert.match(html, /canonical layers/i);
    assert.match(html, /KARTEL Core/);
  });

  test("coat-of-arms content has moved OFF the home", () => {
    assert.doesNotMatch(html, /griffin/i);
    assert.doesNotMatch(html, /"@type":"FAQPage"/);
  });

  test("no personal contact email on the authority surface", () => {
    assert.doesNotMatch(html, /gor@kartel\.org\.uk/);
  });

  test("favicon and apple-touch-icon link tags reference generated routes", () => {
    assert.match(html, /<link rel="icon" href="\/icon"/);
    assert.match(html, /<link rel="apple-touch-icon" href="\/apple-icon"/);
  });
});

describe("/ru — KARTEL Core home", () => {
  const html = read("ru.html");

  test("html element has lang=ru", () => {
    assert.match(html, /<html[^>]*\blang="ru"/);
  });

  test("Russian Core title", () => {
    assert.match(html, /<title>Ядро KARTEL — авторитетность федерации, реестр, governance<\/title>/);
  });

  test("canonical points at /ru", () => {
    assert.match(html, /<link rel="canonical" href="https:\/\/kartel\.org\.uk\/ru"\/>/);
  });

  test("Russian Core body rendered (Cyrillic)", () => {
    assert.match(html, /авторитетности|Канонических|Федерация|Реестр/);
  });
});

describe("/en/family/crest + /ru/family/crest — Coat of Arms", () => {
  test("/en/family/crest has the heraldry (griffin, crest image, FAQ)", () => {
    const html = read("en/family/crest.html");
    assert.match(html, /<html[^>]*\blang="en"/);
    assert.match(html, /Kartel Coat of Arms/i);
    assert.match(html, /griffin/i);
    assert.match(html, /crest\.(jpeg|webp)/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /<link rel="canonical" href="https:\/\/kartel\.org\.uk\/en\/family\/crest"\/>/);
  });

  test("/ru/family/crest has Russian heraldry (грифон / Сила и Власть)", () => {
    const html = read("ru/family/crest.html");
    assert.match(html, /<html[^>]*\blang="ru"/);
    assert.match(html, /грифон|Сила и Власть|герб/i);
  });
});

describe("/en/family + /ru/family — Family Heritage members", () => {
  test("/en/family has lang=en and English title", () => {
    const html = read("en/family.html");
    assert.match(html, /<html[^>]*\blang="en"/);
    assert.match(html, /Kartel Family Members — London/);
  });

  test("/ru/family has lang=ru and Russian title", () => {
    const html = read("ru/family.html");
    assert.match(html, /<html[^>]*\blang="ru"/);
    assert.match(html, /Члены семьи Картель/);
  });
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
