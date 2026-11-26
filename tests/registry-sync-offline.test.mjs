// Bus 169 B4: scripts/check-registry-sync.mjs must FAIL when kartel-core is missing (it used to
// skip with exit 0, so a push without kartel-core passed unchecked), and skip only when
// REGISTRY_CHECK_OFFLINE=1 is set on purpose.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/check-registry-sync.mjs", import.meta.url));
const run = (env) =>
  spawnSync(process.execPath, [script], {
    env: { ...process.env, REGISTRY_CHECK_OFFLINE: "", KARTEL_CORE_DIR: "/nonexistent/kartel-core", ...env },
    encoding: "utf8",
  });

describe("registry-sync without kartel-core", () => {
  test("fails by default", () => {
    const r = run({});
    assert.equal(r.status, 1);
    assert.match(r.stderr, /private source not found/);
  });
  test("skips with a warning only when REGISTRY_CHECK_OFFLINE=1", () => {
    const r = run({ REGISTRY_CHECK_OFFLINE: "1" });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /SKIPPED because REGISTRY_CHECK_OFFLINE=1/);
    assert.doesNotMatch(r.stdout, /in sync/);
  });
});
