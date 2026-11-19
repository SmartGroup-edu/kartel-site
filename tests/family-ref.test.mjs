// Error reference codes (bus 84/97 item 6): readable code, logged with a route class that carries no ids.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newRef, refFromDigest, routeClass, refLogLine, REF_RE } from "../app/lib/family-ref.mjs";

test("newRef: 6 characters, Crockford base32 (no I, L, O, U), different each time", () => {
  const a = new Set(Array.from({ length: 200 }, () => newRef()));
  assert.ok(a.size > 195);
  for (const r of a) { assert.match(r, /^[0-9A-HJKMNP-TV-Z]{6}$/); assert.match(r, REF_RE); }
  assert.equal(newRef(() => new Uint8Array([0, 1, 31, 32, 63, 255])), "01Z0ZZ");
});

test("refFromDigest: a prefix of Next's digest, or nothing for client errors", () => {
  assert.equal(refFromDigest("2894716531"), "E-28947165");
  assert.match(refFromDigest("2894716531"), REF_RE);
  assert.equal(refFromDigest(undefined), null);
  assert.equal(refFromDigest("<script>"), null);
});

test("routeClass: no ids, dates, numbers, queries or odd segments ever reach the log", () => {
  assert.equal(routeClass("/ru/family/os/people/0b5e6b0e-1f2a-4c3d-9e8f-0123456789ab"), "/family/os/people/:id");
  assert.equal(routeClass("/en/family/os/council?date=2026-11-22"), "/family/os/council");
  assert.equal(routeClass("/ru/family/os/calendar/2026-11-22"), "/family/os/calendar/:date");
  assert.equal(routeClass("/ru/family/os/x/12345"), "/family/os/x/:n");
  assert.equal(routeClass("/ru/family/os/qa-child@example.test"), "/family/os/:x");
  assert.equal(routeClass("/ru"), "/");
  assert.equal(routeClass(routeClass("/ru/family/os/people/0b5e6b0e-1f2a-4c3d-9e8f-0123456789ab/2026-11-22")), "/family/os/people/:id/:date", "idempotent: the edge already sends a class");
  const line = refLogLine("not-found", "X7K2QD", "/ru/family/os/people/0b5e6b0e-1f2a-4c3d-9e8f-0123456789ab");
  assert.equal(line, "[family] not-found ref=X7K2QD route=/family/os/people/:id");
  assert.doesNotMatch(line, /@|[0-9a-f]{8}-/);
});

test("family pages: not-found and error show «Код обращения» and log it; the edge gate forwards the route", () => {
  const nf = readFileSync("app/[lang]/family/not-found.tsx", "utf8");
  assert.match(nf, /newRef\(\)/); assert.match(nf, /console\.warn\(refLogLine\("not-found"/);
  const er = readFileSync("app/[lang]/family/error.tsx", "utf8");
  assert.match(er, /refFromDigest\(/); assert.match(er, /Код обращения/);
  const px = readFileSync("proxy.ts", "utf8");
  assert.match(px, /x-family-route/);
});
