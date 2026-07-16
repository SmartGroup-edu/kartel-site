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
// kartel-core is a SEPARATE PRIVATE repo, so CI (in kartel-site) cannot read
// it. This check therefore runs locally (pre-push), where both repos live
// side by side. If the private source is not found it SKIPS with a warning —
// never a false green.
//
// Resolve the source with, in order:
//   1. env KARTEL_CORE_DIR = path to the kartel-core repo root
//   2. default: ../../Documents/Claude/Projects/KARTEL/kartel-core (rel. to repo root)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VENDORED = join(repoRoot, "app/content/registry.public.json");
const REL_IN_CORE = "registry/registry.public.json";

const coreDir =
  process.env.KARTEL_CORE_DIR ??
  resolve(repoRoot, "../../Documents/Claude/Projects/KARTEL/kartel-core");
const SOURCE = join(coreDir, REL_IN_CORE);

const warn = (m) => console.warn(`\x1b[33m⚠ registry-sync: ${m}\x1b[0m`);
const ok = (m) => console.log(`\x1b[32m✔ registry-sync: ${m}\x1b[0m`);
const fail = (m) => console.error(`\x1b[31m✖ registry-sync: ${m}\x1b[0m`);

if (!existsSync(SOURCE)) {
  warn(`private source not found at ${SOURCE}`);
  warn(
    "SKIPPED — cannot verify public↔private registry parity. " +
      "Set KARTEL_CORE_DIR to the kartel-core repo root to enable this check.",
  );
  process.exit(0); // skip, not a false green
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

// Content comparison (deep, formatting-insensitive).
const norm = (o) => JSON.stringify(o);
if (norm(vend) === norm(src)) {
  ok(`in sync (version ${src.version}, updated ${src.updated})`);
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
