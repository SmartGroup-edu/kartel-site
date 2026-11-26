#!/usr/bin/env node
// Drift check: the PUBLIC registry projection vendored into this repo
// (app/content/registry.public.json) must match the canonical PRIVATE source
// in the kartel-core repo (registry/registry.public.json). This is the
// PUBLIC/PRIVATE firewall — see the _comment in registry.public.json.
//
// Why this exists: ZNANIYE-FINCHLEY was registered in kartel-core on
// 2026-06-19 but only reached the public site on 2026-07-15 (~4 weeks),
// because vendoring is manual and nothing flagged the drift.
//
// kartel-core is a SEPARATE PRIVATE repo. It runs locally (pre-push), where both
// repos live side by side, and in CI (job registry-sync), which checks kartel-core
// out with the kartel-sync-bot App token (bus 169 B4).
// If the private source is not found it FAILS. To skip on purpose (offline,
// no kartel-core checkout), set REGISTRY_CHECK_OFFLINE=1: it then warns and
// exits 0 — a skip, never a green.
//
// Resolve the source with, in order:
//   1. env KARTEL_CORE_DIR = path to the kartel-core repo root
//   2. ../kartel-core — a sibling of this repo (or of a worktree beside it), e.g. ~/Sites/kartel-core
//   3. ../../Documents/Claude/Projects/KARTEL/kartel-core (the old location)
// Bus 155: kartel-core had moved to ~/Sites, only the old default was tried, and every
// push SKIPPED with a warning while the site copy fell from v10 back to v6.
//
// It also checks app/content/registry.source.json (the sync record that the CI test
// tests/registry-source.test.mjs holds the vendored copy to) against the source version.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VENDORED = join(repoRoot, "app/content/registry.public.json");
const RECORD = join(repoRoot, "app/content/registry.source.json");
const REL_IN_CORE = "registry/registry.public.json";

const candidates = process.env.KARTEL_CORE_DIR
  ? [process.env.KARTEL_CORE_DIR]
  : [resolve(repoRoot, "../kartel-core"), resolve(repoRoot, "../../Documents/Claude/Projects/KARTEL/kartel-core")];
const coreDir = candidates.find((d) => existsSync(join(d, REL_IN_CORE))) ?? candidates[0];
const SOURCE = join(coreDir, REL_IN_CORE);

const warn = (m) => console.warn(`\x1b[33m⚠ registry-sync: ${m}\x1b[0m`);
const ok = (m) => console.log(`\x1b[32m✔ registry-sync: ${m}\x1b[0m`);
const fail = (m) => console.error(`\x1b[31m✖ registry-sync: ${m}\x1b[0m`);

// Bus 169 B4: a missing source used to SKIP with exit 0, so a push from a machine without
// kartel-core passed unchecked. Now that is a failure unless the skip is asked for.
const OFFLINE = process.env.REGISTRY_CHECK_OFFLINE === "1";
const missing = (what, path) => {
  if (OFFLINE) {
    warn(`${what} not found at ${path} — SKIPPED because REGISTRY_CHECK_OFFLINE=1 (not a green)`);
    return;
  }
  fail(`${what} not found at ${path}`);
  console.error(
    "   Set KARTEL_CORE_DIR to the kartel-core repo root, or REGISTRY_CHECK_OFFLINE=1 to skip on purpose.",
  );
  process.exit(1);
};

if (!existsSync(SOURCE)) {
  missing("private source", SOURCE);
  process.exit(0); // offline skip, not a green
}

const parse = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`cannot parse ${p}: ${e.message}`);
    process.exit(1);
  }
};

const vend = parse(VENDORED);
const src = parse(SOURCE);
const record = existsSync(RECORD) ? parse(RECORD) : null;

// Content comparison (deep, formatting-insensitive).
const norm = (o) => JSON.stringify(o);

// Bus 161: the federation snapshot (federation.public.json) is vendored the same way and had
// drifted unguarded (2026-06-18 copy, still listing RUSJAZ-FDN, while the registry reached v11).
const FED_VENDORED = join(repoRoot, "app/content/federation.public.json");
const FED_SOURCE = join(coreDir, "registry/federation.public.json");
let fedOk = true;
if (existsSync(FED_SOURCE)) {
  const fv = parse(FED_VENDORED);
  const fs = parse(FED_SOURCE);
  if (norm(fv) !== norm(fs)) {
    fail("federation snapshot is OUT OF SYNC with the private kartel-core source.");
    console.error(`   vendored : generatedAt ${fv.generatedAt}  (${FED_VENDORED})`);
    console.error(`   canonical: generatedAt ${fs.generatedAt}  (${FED_SOURCE})`);
    fedOk = false;
  } else if (record?.federation?.generatedAt !== fs.generatedAt || record?.federation?.registryVersion !== fs.registryVersion) {
    fail(
      `app/content/registry.source.json does not record the federation snapshot ` +
        `(record: ${record?.federation?.generatedAt}; source: ${fs.generatedAt}). Update record.federation with the re-vendor.`,
    );
    fedOk = false;
  }
} else {
  missing("federation snapshot source", FED_SOURCE);
}

if (norm(vend) === norm(src)) {
  if (!record || record.sourceVersion !== src.version || record.sourceUpdated !== src.updated) {
    fail(
      `app/content/registry.source.json does not record the source version ` +
        `(record: ${record?.sourceVersion} / ${record?.sourceUpdated}; source: ${src.version} / ${src.updated}). ` +
        "Update the record (commit, version, updated, sha256) with the re-vendor.",
    );
    process.exit(1);
  }
  if (!fedOk) process.exit(1);
  ok(`in sync (version ${src.version}, updated ${src.updated}; federation snapshot ${record.federation?.generatedAt})`);
  process.exit(0);
}

fail("PUBLIC projection is OUT OF SYNC with the private kartel-core source.");
console.error(`   vendored : version ${vend.version}, updated ${vend.updated}  (${VENDORED})`);
console.error(`   canonical: version ${src.version}, updated ${src.updated}  (${SOURCE})`);

// Best-effort: surface which top-level keys differ, to speed the fix.
const keys = [...new Set([...Object.keys(vend), ...Object.keys(src)])];
const drifted = keys.filter((k) => norm(vend[k]) !== norm(src[k]));
if (drifted.length) console.error(`   differing keys: ${drifted.join(", ")}`);
console.error(
  "   Fix: re-vendor the canonical projection into app/content/registry.public.json, " +
    "then commit. (The private source is authoritative.)",
);
process.exit(1);
