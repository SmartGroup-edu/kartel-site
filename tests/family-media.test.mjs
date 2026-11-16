// Family photos & stories (Phase A, 2026-11-16) — site side. Source-level invariants + pure units.
// The service itself is tested in family-media/media.test.mjs. No names, no personal data here.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatPartialDate, formatDateRange } from "../app/lib/partial-date.mjs";

const src = (p) => readFileSync(p, "utf8");

describe("dormant until configured, fail-soft for viewers", () => {
  const lib = src("app/lib/family-media.ts");
  test("enabled only when both URL and secret are set", () => {
    assert.match(lib, /return Boolean\(process\.env\.FAMILY_MEDIA_URL && process\.env\.FAMILY_MEDIA_SECRET\);/);
  });
  test("viewer read never throws: any failure → empty content (static page as before)", () => {
    const fn = lib.slice(lib.indexOf("export async function getPublishedMedia"), lib.indexOf("export async function getDraft"));
    assert.match(fn, /if \(!mediaEnabled\(\)\) return EMPTY_MEDIA;/);
    assert.match(fn, /catch \{\s*return EMPTY_MEDIA;/);
  });
  test("server-only module", () => assert.match(lib, /^import "server-only";/));
});

describe("photo route: approved viewers only, never cached", () => {
  const r = src("app/api/family-media/[id]/[variant]/route.ts");
  test("gate, session and approval checked in the route (/api is outside proxy.ts)", () => {
    assert.match(r, /if \(decision !== "allow" \|\| !session\) return deny\(401\);/);
    assert.match(r, /if \(!familyEnv\.gateOn\(\) \|\| !mediaEnabled\(\)\) return deny\(404\);/);
  });
  test("strict id and variant, viewers get published files only", () => {
    assert.match(r, /const VARIANT = \/\^\(256\|640\|1280\)\\\.\(webp\|avif\)\$\/;/);
    assert.match(r, /admin \? "admin" : "published"/);
  });
  test("private, no-store, noindex, nosniff", () => {
    for (const h of [/"cache-control": "private, no-store"/, /"x-robots-tag": "noindex, nofollow"/, /"x-content-type-options": "nosniff"/]) assert.match(r, h);
  });
});

describe("editor API and page: admins only", () => {
  const a = src("app/api/family-admin/[...op]/route.ts");
  test("guard: gate on, approved session, admin, same-origin writes", () => {
    assert.match(a, /if \(!isFamilyAdmin\(session\.cpifSubjectId\)\) return json\(403/);
    assert.match(a, /req\.method !== "GET" && req\.headers\.get\("origin"\) !== familyEnv\.siteOrigin\(\)/);
  });
  test("only existing people and chronicle entries can be edited", () => {
    assert.match(a, /const known = kind === "person" \? PERSON_IDS\.has\(id\) : kind === "event" \? EVENT_IDS\.has\(id\) : false;/);
  });
  test("uploads: JPEG/PNG/WebP only, at most 4 MB", () => {
    assert.match(a, /\^image\\\/\(jpeg\|png\|webp\)\$/);
    assert.match(a, /buf\.length > 4 \* 1024 \* 1024/);
  });
  test("non-admins get a real 404 at the edge (page notFound() would stream a 200)", () => {
    const p = src("proxy.ts");
    assert.match(p, /\\\/\(en\|ru\)\\\/family\\\/admin\(\\\/\|\$\)/);
    assert.match(p, /if \(!admins\.includes\(sub\.toLowerCase\(\)\)\) return new NextResponse\("Not found", \{ status: 404 \}\);/);
  });
  test("editor page never prerendered or indexed", () => {
    const pg = src("app/[lang]/family/admin/page.tsx");
    assert.match(pg, /export const dynamic = "force-dynamic";/);
    assert.match(pg, /robots: \{ index: false, follow: false \}/);
  });
  test("the editor cannot change names or existing chronicle text", () => {
    const v = src("family-media/validate.mjs");
    assert.doesNotMatch(v, /name(EN|RU)|title(EN|RU)|desc(EN|RU)/);
  });
});

describe("display", () => {
  test("portrait or monogram (no stock image); photos keep for print", () => {
    const p = src("app/components/FamilyPortrait.tsx");
    assert.match(p, /data-portrait="monogram"/);
    assert.doesNotMatch(p, /https?:\/\//, "no external image source");
    assert.doesNotMatch(src("app/globals.css").slice(src("app/globals.css").indexOf("@media print")), /\[data-photos\][^{]*\{\s*display: none/);
  });
  test("story is plain text (no HTML injection path)", () => {
    const tl = src("app/components/FamilyTimeline.tsx");
    const block = tl.slice(tl.indexOf("Story and photos from the editor"), tl.indexOf("Memorial (cycle 12 #1)"));
    assert.doesNotMatch(block, /dangerouslySetInnerHTML/);
  });
});

describe("partial dates", () => {
  test("year, month-year, full date; EN and RU", () => {
    assert.equal(formatPartialDate("1955", "EN"), "1955");
    assert.equal(formatPartialDate("1955-02", "EN"), "February 1955");
    assert.equal(formatPartialDate("1955-02-08", "EN"), "8 February 1955");
    assert.equal(formatPartialDate("1955-02-08", "RU"), "8 февраля 1955");
    assert.equal(formatPartialDate("bad", "EN"), "");
    assert.equal(formatDateRange("1955", "2026-01", "EN"), "1955 — January 2026");
    assert.equal(formatDateRange("", "2026", "RU"), "2026");
  });
});
