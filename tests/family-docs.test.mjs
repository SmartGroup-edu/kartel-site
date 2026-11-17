// Family OS Stage 2a — profile/document helpers (synthetic values).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOn, expiryState, maskNumber } from "../app/lib/family-docs.mjs";

const on = new Date("2026-11-17T10:00:00Z");
test("age: whole years, birthday not yet reached this year counts one less", () => {
  assert.equal(ageOn("2007-11-17", on), 19);
  assert.equal(ageOn("2007-11-18", on), 18);
  assert.equal(ageOn("2015-02-28", on), 11);
  assert.equal(ageOn("not-a-date", on), null);
});
test("expiry: expired / soon (≤ ~6 months) / ok / none", () => {
  assert.equal(expiryState("2026-11-16", on), "expired");
  assert.equal(expiryState("2027-05-01", on), "soon");
  assert.equal(expiryState("2028-01-01", on), "ok");
  assert.equal(expiryState(null, on), null);
});
test("mask: never more than the last three characters", () => {
  assert.equal(maskNumber("567"), "•••• 567");
  assert.equal(maskNumber("QA1234567"), "•••• 567");
  assert.doesNotMatch(maskNumber("QA1234567"), /1234/);
});
