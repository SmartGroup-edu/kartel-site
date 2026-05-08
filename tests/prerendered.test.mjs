// Snapshot tests for the prerendered HTML, sitemap, and service worker.
// These read the .next/server/app outputs after `npm run build` and assert
// invariants we care about — primarily i18n correctness (html lang, hreflang,
// canonical, JSON-LD, sitemap URLs) so the [lang] migration can't silently
// regress.
//
// Run with: npm test  (after npm run build)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const APP = ".next/server/app";

function read(file) {
  return readFileSync(`${APP}/${file}`, "utf8");
}

describe("/en prerendered HTML", () => {
  const html = read("en.html");

  test("html element has lang=en", () => {
    assert.match(html, /<html[^>]*\blang="en"/);
  });

  test("English title", () => {
    assert.match(
      html,
      /<title>Kartel Family — Coat of Arms, Legacy, London<\/title>/
    );
  });

  test("canonical points at /en", () => {
    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/kartel\.org\.uk\/en"\/>/
    );
  });

  test("hreflang en + ru + x-default present", () => {
    assert.match(html, /hrefLang="en"[^>]*href="https:\/\/kartel\.org\.uk\/en"/);
    assert.match(html, /hrefLang="ru"[^>]*href="https:\/\/kartel\.org\.uk\/ru"/);
    assert.match(html, /hrefLang="x-default"/);
  });

  test("JSON-LD WebSite + FAQPage present", () => {
    assert.match(html, /"@type":"WebSite"/);
    assert.match(html, /"@type":"FAQPage"/);
  });

  test("hero crest image is in initial HTML (not gated by JS)", () => {
    // crest.jpeg or its next/image-optimized variant should appear
    assert.match(html, /crest\.(jpeg|webp)/);
  });

  test("English body content rendered (griffin description)", () => {
    assert.match(html, /griffin/i);
  });

  test("favicon and apple-touch-icon link tags reference generated routes", () => {
    assert.match(html, /<link rel="icon" href="\/icon"/);
    assert.match(html, /<link rel="apple-touch-icon" href="\/apple-icon"/);
  });
});

describe("/ru prerendered HTML", () => {
  const html = read("ru.html");

  test("html element has lang=ru", () => {
    assert.match(html, /<html[^>]*\blang="ru"/);
  });

  test("Russian title", () => {
    assert.match(
      html,
      /<title>Семья Картель — герб, наследие, Лондон<\/title>/
    );
  });

  test("canonical points at /ru", () => {
    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/kartel\.org\.uk\/ru"\/>/
    );
  });

  test("Russian body content rendered (Cyrillic)", () => {
    assert.match(html, /грифон|Картель/);
  });

  test("Russian heading appears in JSON-LD or visible HTML", () => {
    assert.match(html, /Сила и Власть|Фамильный герб/);
  });
});

describe("/en/family + /ru/family", () => {
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

  test("lists /en/family and /ru/family", () => {
    assert.match(xml, /<loc>https:\/\/kartel\.org\.uk\/en\/family<\/loc>/);
    assert.match(xml, /<loc>https:\/\/kartel\.org\.uk\/ru\/family<\/loc>/);
  });

  test("does not list legacy ?lang= URLs", () => {
    assert.doesNotMatch(xml, /\?lang=/);
  });

  test("includes hreflang alternates for each page", () => {
    // xhtml:link rel="alternate" hreflang attributes
    assert.match(xml, /hreflang="en"/);
    assert.match(xml, /hreflang="ru"/);
  });
});

describe("service worker", () => {
  const sw = read("sw.js.body");

  test("cache name is versioned (not the hardcoded old constant)", () => {
    // Must be either the dev fallback or a SHA-prefixed name, never the
    // hardcoded "kartel-20260420" that was replaced.
    assert.doesNotMatch(sw, /CACHE_NAME = "kartel-20260420"/);
    assert.match(sw, /CACHE_NAME = "kartel-(dev-\d+|[a-f0-9]{8,12})"/);
  });

  test("pre-caches the canonical landing pages", () => {
    assert.match(sw, /"\/"/);
    assert.match(sw, /"\/family"/);
  });
});
