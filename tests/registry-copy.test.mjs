// Hand-written project/status copy stays tied to the vendored registry (bus 168, C4).
// - Project name lists (site description, /projects meta) are derived: app/content/registryText.mjs.
// - Prose that cannot be derived (the /core "The projects" paragraph in coreAbout.ts and the
//   EN/RU overlays in federationCopy.ts) is pinned to the registry facts it was written against,
//   recorded in app/content/registry.copy-basis.json. When the registry changes those facts, this
//   test fails until the copy is reviewed and the basis re-recorded:
//     node tests/registry-copy.test.mjs --record
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { listJoin, projectNames } from "../app/content/registryText.mjs";

const registry = JSON.parse(readFileSync(new URL("../app/content/registry.public.json", import.meta.url), "utf8"));
const BASIS = new URL("../app/content/registry.copy-basis.json", import.meta.url);
const h = (s) => createHash("sha256").update(String(s)).digest("hex").slice(0, 12);

function copyBasis(r) {
  return {
    _comment: "Registry facts the hand-written copy was reviewed against (coreAbout.ts «The projects», federationCopy.ts overlays). Re-record only after reviewing that copy: node tests/registry-copy.test.mjs --record",
    projects: r.projects.map((p) => `${p.key}:${p.type}:${p.role}`),
    summaries: Object.fromEntries(r.projects.map((p) => [p.key, h(p.summary)])),
    gate: Object.fromEntries(r.federationGate.items.map((i) => [i.key, h(i.description)])),
  };
}

if (process.argv.includes("--record")) {
  writeFileSync(BASIS, JSON.stringify(copyBasis(registry), null, 2) + "\n");
  console.log("recorded", BASIS.pathname);
} else {
  describe("hand-written copy vs the vendored registry", () => {
    test("the copy basis matches the registry (else review coreAbout.ts + federationCopy.ts, then --record)", () => {
      assert.deepEqual(copyBasis(registry), JSON.parse(readFileSync(BASIS, "utf8")));
    });
    test("derived project lists: retired and future modules are not active", () => {
      const r = { projects: [
        { name: "A", type: "project", role: "Retired" },
        { name: "B", type: "project", role: "Consumer" },
        { name: "C", type: "project", role: "Steward" },
        { name: "D", type: "future-module", role: "Planned" },
      ] };
      assert.equal(listJoin(projectNames(r), "EN"), "A, B, C and D");
      assert.equal(listJoin(projectNames(r, "active"), "RU"), "B и C");
      assert.equal(listJoin(["A"], "EN"), "A");
    });
  });
}
