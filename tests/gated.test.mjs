// Gated area (family, sign-in, console) — invariants from the gated UI/UX audit, 2026-11-14.
// Source-level checks: the gated pages are dynamic, so there is no prerendered HTML to read.
// Runtime behaviour (headers, redirects) is verified against a running server separately.
// No family names in this file — only levels, keys and patterns.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(p, "utf8");
const consoleHtml = () => {
  const m = src("app/console/console-html.ts").match(/export const CONSOLE_HTML = (".*");\s*$/s);
  return JSON.parse(m[1]);
};

describe("gated routes are never indexed", () => {
  test("next.config sends X-Robots-Tag noindex for /family, /family/* and /console", () => {
    const cfg = src("next.config.ts");
    for (const source of ["/:lang(en|ru)/family", "/:lang(en|ru)/family/:path*", "/console"]) {
      assert.match(cfg, new RegExp(`source: "${source.replace(/[()|*/:]/g, "\\$&")}", headers: \\[\\{ key: "X-Robots-Tag", value: "noindex, nofollow" \\}\\]`));
    }
  });
  test("proxy.ts sets X-Robots-Tag on gated responses (redirects included)", () => {
    const p = src("proxy.ts");
    assert.match(p, /res\.headers\.set\("X-Robots-Tag", "noindex, nofollow"\)/);
    assert.match(p, /return noindex\(await familyEdgeGate\(/);
    assert.match(p, /noindex\(NextResponse\.redirect\(new URL\("https:\/\/kartel\.org\.uk\/en\/family\/signin\?returnTo=%2Fconsole"\)\)\)/);
  });
  test("family, sign-in and pending pages declare robots noindex", () => {
    for (const f of ["app/[lang]/family/page.tsx", "app/[lang]/family/signin/page.tsx", "app/[lang]/family/pending/page.tsx"]) {
      assert.match(src(f), /robots: \{ index: false, follow: false \}/, f);
    }
  });
  test("console HTML carries meta robots noindex", () => {
    assert.match(consoleHtml(), /<meta name="robots" content="noindex, nofollow">/);
  });
});

describe("console", () => {
  test("no environment variable names in the console page", () => {
    assert.doesNotMatch(consoleHtml(), /\b[A-Z][A-Z0-9]*_[A-Z0-9_]{3,}\b/);
    // the live-panel fallback never interpolates its reason into the page
    const lp = src("app/console/live-panel.ts");
    const fn = lp.slice(lp.indexOf("function notice("), lp.indexOf("export async function renderLivePanel"));
    assert.doesNotMatch(fn.slice(fn.indexOf("return (")), /\$\{[^}]*reason/);
  });
  test("site palette: no retired beige background, white + burgundy light tokens, site fonts", () => {
    const h = consoleHtml();
    assert.doesNotMatch(h, /#f2f1ec/i);
    assert.match(h, /--bg:#ffffff;/);
    assert.match(h, /--gold:#7b1e2d;/);
    assert.match(h, /font-family:"Inter"/);
    assert.match(h, /font-family:"Source Serif 4"/);
  });
  test("plain-language labels (no 'under R0', no 'Integrity Floor bound')", () => {
    const h = consoleHtml();
    assert.doesNotMatch(h, /under R0/);
    assert.doesNotMatch(h, /Integrity Floor bound/);
  });
  test("static registry data is labelled a snapshot, not live", () => {
    const lp = src("app/console/live-panel.ts");
    assert.doesNotMatch(lp, /Registry · live/);
    assert.match(lp, /Registry snapshot/);
  });
});

describe("family page", () => {
  test("no per-generation card sections (tree + chronicle only)", () => {
    const fc = src("app/components/FamilyClient.tsx");
    assert.doesNotMatch(fc, /groupByGeneration/);
    assert.doesNotMatch(fc, /schema\.org\/Person/);
  });
  test("no placeholder generation label used as body text", () => {
    const fp = src("app/content/family-private.ts");
    assert.doesNotMatch(fp, /description: "Next generation\."/);
    assert.doesNotMatch(fp, /description: "\\u041d|description: "Новое поколение\."/);
    assert.doesNotMatch(fp, /Representative of the older generation of the Kartel family\./);
  });
  test("auth pages use the neutral footer, not the registry line", () => {
    assert.doesNotMatch(src("app/components/AuthShell.tsx"), /public registry of the federation|публичный реестр федерации/);
  });
});

describe("sitemap never lists gated routes", () => {
  const xml = readFileSync(".next/server/app/sitemap.xml.body", "utf8");
  test("no /family, /console or sign-in URLs", () => {
    assert.doesNotMatch(xml, /\/family|\/console|signin/);
  });
});
