// Node parity guards (2026-11-16). CI, Vercel and the Hetzner services run the
// Node major in .nvmrc. Tests are plain .mjs run by `node --test`; importing a
// .ts file only works on Node versions that strip types, so it can pass
// locally and fail in CI. Keep server/test helpers shared with tests in .mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const want = read(".nvmrc").trim().replace(/^v/, "");

test(".nvmrc holds one Node major", () => {
  assert.match(want, /^\d+$/);
});

test("package.json engines, CI and service images use the .nvmrc major", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.engines?.node, `>=${want} <${Number(want) + 1}`);
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /node-version-file: \.nvmrc/);
  assert.doesNotMatch(ci, /node-version: /);
  for (const f of ["family-media/Dockerfile", "relay/Dockerfile"]) {
    const from = read(f).match(/^FROM node:(\S+)/m)?.[1];
    assert.ok(from, `${f}: no node base image`);
    assert.match(from, new RegExp(`^${want}\\.\\d+\\.\\d+-alpine\\d+\\.\\d+$`), `${f}: ${from}`);
  }
});

const IMPORT_TS = /(?:\bfrom\s*|\bimport\s*\(\s*)["'][^"']+\.(?:c|m)?tsx?["']/;

test("the .ts import pattern catches what it must (and not .mjs)", () => {
  assert.match(`import { x } from "../app/lib/a.ts";`, IMPORT_TS);
  assert.match(`const m = await import('./b.tsx');`, IMPORT_TS);
  assert.match(`import y from "./c.mts";`, IMPORT_TS);
  assert.doesNotMatch(`import { x } from "../app/lib/a.mjs";`, IMPORT_TS);
});

test("no test file imports a .ts module", () => {
  const files = [
    ...readdirSync(new URL("../tests/", import.meta.url)).filter((f) => f.endsWith(".mjs")).map((f) => `tests/${f}`),
    ...["relay", "family-media"].flatMap((d) =>
      readdirSync(new URL(`../${d}/`, import.meta.url)).filter((f) => f.endsWith(".test.mjs")).map((f) => `${d}/${f}`)),
  ];
  assert.ok(files.length >= 6, `only ${files.length} test files found`);
  const bad = files.filter((f) => f !== "tests/node-parity.test.mjs" && IMPORT_TS.test(read(f)));
  assert.deepEqual(bad, []);
});
