// The vendored public registry must be exactly the kartel-core copy it was synced from.
// kartel-core is private, so CI cannot read it; app/content/registry.source.json records
// the source version, date, commit and file hash at sync time. This fails when the site
// copy changes without the record (hand edit, partial re-vendor) or the record without
// the copy. The pre-push check (scripts/check-registry-sync.mjs) compares the record with
// the local kartel-core checkout. Bus 155: the site sat at v6 while kartel-core reached v10.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const bytes = readFileSync(new URL("../app/content/registry.public.json", import.meta.url));
const vendored = JSON.parse(bytes.toString("utf8"));
const source = JSON.parse(readFileSync(new URL("../app/content/registry.source.json", import.meta.url), "utf8"));

describe("vendored registry matches its recorded kartel-core source", () => {
  test("the record names a source commit", () => {
    assert.equal(source.repo, "SmartGroup-edu/kartel-core");
    assert.equal(source.path, "registry/registry.public.json");
    assert.match(source.sourceCommit, /^[0-9a-f]{40}$/);
  });
  test("version equals the source version", () => {
    assert.equal(vendored.version, source.sourceVersion);
  });
  test("updated date equals the source date", () => {
    assert.equal(vendored.updated, source.sourceUpdated);
  });
  test("bytes equal the source file (sha256)", () => {
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256);
  });
});
