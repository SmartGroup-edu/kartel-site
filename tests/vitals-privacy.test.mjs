// bus 176c (R0 2026-11-27): Speed Insights and Web Analytics send the route pattern only — no ids, dates, tokens or
// sign-in parameters from the address.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { redactVitalsUrl, vitalsBeforeSend } from "../app/lib/vitals-privacy.mjs";

const O = "https://kartel.org.uk";

test("the SDK's route pattern replaces the path; query and hash are dropped", () => {
  assert.equal(redactVitalsUrl(`${O}/ru/family/os/people/3f2b1c4d-1111-4222-8333-444455556666?x=1#a`, "/[lang]/family/os/people/[id]"), `${O}/[lang]/family/os/people/[id]`);
  assert.equal(redactVitalsUrl(`${O}/en/family/signin?returnTo=%2Fen%2Ffamily%2Fos&sent=1`, "/[lang]/family/signin"), `${O}/[lang]/family/signin`);
});

test("without a route: ids and tokens become [id], the family area is cut to its first level, no query", () => {
  assert.equal(redactVitalsUrl(`${O}/ru/family/os/people/3f2b1c4d-1111-4222-8333-444455556666`), `${O}/ru/family/os/[...]`);
  assert.equal(redactVitalsUrl(`${O}/en/family/os/council?date=2026-11-27`), `${O}/en/family/os/[...]`);
  assert.equal(redactVitalsUrl(`${O}/en/family/signin?returnTo=%2Fen%2Ffamily%2Fos`), `${O}/en/family/signin`);
  assert.equal(redactVitalsUrl(`${O}/m/AbCdEfGhIjKlMnOpQrStUvWx`), `${O}/m/[id]`);
  assert.equal(redactVitalsUrl(`${O}/ru`), `${O}/ru`);
});

test("an unparsable URL drops the event", () => {
  assert.equal(vitalsBeforeSend({ type: "vital", url: "not a url" }), null);
  assert.deepEqual(vitalsBeforeSend({ type: "vital", url: `${O}/ru?utm=1`, route: "/[lang]" }), { type: "vital", url: `${O}/[lang]`, route: "/[lang]" });
});

test("both SDKs are mounted with the redacting beforeSend", () => {
  const s = readFileSync("app/components/LateVitals.tsx", "utf8");
  assert.match(s, /<Analytics beforeSend=\{vitalsBeforeSend\} \/>/);
  assert.match(s, /<SpeedInsights beforeSend=\{vitalsBeforeSend\} \/>/);
});
