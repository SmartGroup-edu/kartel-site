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

import { DOC_LABELS, createRevealTimer } from "../app/lib/family-docs.mjs";

test("labels: RU is Russian (Latin only inside parentheses), EN has no Cyrillic; all types covered", () => {
  const types = ["passport", "national_id", "ni_number", "residence", "other"];
  for (const t of types) {
    const ru = DOC_LABELS.RU[t], en = DOC_LABELS.EN[t];
    assert.ok(ru && en, t);
    assert.doesNotMatch(ru.replace(/\([^)]*\)/g, ""), /[A-Za-z]/, `RU "${ru}" mixes scripts outside parentheses`);
    assert.doesNotMatch(en, /[А-Яа-яЁё]/, `EN "${en}" has Cyrillic`);
  }
  assert.equal(DOC_LABELS.RU.residence, "Статус проживания (EU Settlement)");
  assert.equal(DOC_LABELS.EN.residence, "EU Settlement status");
});

test("reveal timer: hides after 30 s, at once when the tab is hidden, restarts on a new reveal", () => {
  let t = 0; const timers = new Map(); let id = 0, hides = 0;
  const clock = { setTimer: (fn, ms) => { timers.set(++id, { fn, at: t + ms }); return id; }, clearTimer: (i) => timers.delete(i) };
  const tick = (ms) => { t += ms; for (const [i, x] of [...timers]) if (x.at <= t) { timers.delete(i); x.fn(); } };
  const r = createRevealTimer({ onHide: () => hides++, ...clock });
  r.reveal(); tick(29_999); assert.equal(r.shown, true); tick(1); assert.equal(r.shown, false); assert.equal(hides, 1);
  r.reveal(); tick(10_000); r.reveal(); tick(25_000); assert.equal(r.shown, true, "a second reveal restarts the 30 s");
  r.visibility(true); assert.equal(r.shown, false); assert.equal(hides, 2);
  r.visibility(false); r.hide(); assert.equal(hides, 2, "hiding twice fires once");
});
