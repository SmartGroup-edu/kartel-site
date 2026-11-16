// Family editor rules (bus 60): autosave, unpublished count, card status, dates, gallery rows, time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAutosaver, unpublishedKeys, cardStatus, eventChips, splitDate, joinDate, justifyRows, formatPublished } from "../app/lib/family-editor.mjs";

function fakeClock() {
  let t = 0, seq = 0; const timers = new Map();
  return {
    setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { fn, at: t + ms }); return id; },
    clearTimer: (id) => timers.delete(id),
    now: () => t,
    async advance(ms) { t += ms; for (const [id, x] of [...timers]) if (x.at <= t) { timers.delete(id); await x.fn(); } },
  };
}

test("autosave: debounced — rapid edits send only the last value, once", async () => {
  const c = fakeClock(), sent = [], states = [];
  const a = createAutosaver({ save: async (v) => { sent.push(v); return true; }, delay: 800, onState: (s) => states.push(s.state), ...c });
  a.schedule({ x: 1 }); await c.advance(300); a.schedule({ x: 2 }); await c.advance(300); a.schedule({ x: 3 });
  await c.advance(799); assert.deepEqual(sent, []);
  await c.advance(1); assert.deepEqual(sent, [{ x: 3 }]);
  assert.equal(states.at(-1), "saved");
});

test("autosave: failure keeps the value, shows error, retry sends it again", async () => {
  const c = fakeClock(); let fail = true; const sent = [], states = [];
  const a = createAutosaver({ save: async (v) => { sent.push(v); return !fail; }, onState: (s) => states.push(s.state), ...c });
  a.schedule({ x: 1 }); await c.advance(800);
  assert.equal(states.at(-1), "error");
  fail = false; await a.retry();
  assert.deepEqual(sent, [{ x: 1 }, { x: 1 }]); assert.equal(states.at(-1), "saved");
});

test("autosave: flush on blur saves at once; unchanged value is not sent again", async () => {
  const c = fakeClock(), sent = [];
  const a = createAutosaver({ save: async (v) => { sent.push(v); return true; }, ...c });
  a.seed({ x: 0 });
  a.schedule({ x: 0 }); await a.flush(); assert.deepEqual(sent, []);
  a.schedule({ x: 5 }); await a.flush(); assert.deepEqual(sent, [{ x: 5 }]);
});

test("unpublished count: only cards whose draft differs from published", () => {
  const pub = { persons: { a: { portrait: "1", altEN: "", altRU: "" } }, events: {} };
  const draft = { persons: { a: { portrait: "1", altEN: "", altRU: "" }, b: { portrait: "2", altEN: "", altRU: "" }, c: { portrait: null, altEN: "", altRU: "" } }, events: { e: { storyEN: "x", photos: [] } } };
  assert.deepEqual(unpublishedKeys(draft, pub), ["person:b", "event:e"]);
  assert.deepEqual(unpublishedKeys(pub, pub), []);
});

test("card status: empty · draft · published", () => {
  const v = { portrait: "1", altEN: "", altRU: "" };
  assert.equal(cardStatus(undefined, undefined), "empty");
  assert.equal(cardStatus({ portrait: null, altEN: "", altRU: "" }, undefined), "empty");
  assert.equal(cardStatus(v, undefined), "draft");
  assert.equal(cardStatus(v, v), "published");
  assert.equal(cardStatus({ ...v, altEN: "x" }, v), "draft");
});

test("event chips: story, photo count, dates", () => {
  assert.deepEqual(eventChips({ storyEN: "s", photos: [{}, {}, {}], dateFrom: "1900" }), [{ kind: "story" }, { kind: "photos", n: 3 }, { kind: "dates" }]);
  assert.deepEqual(eventChips({ storyEN: " ", photos: [] }), []);
});

test("dates: split and join keep the stored format", () => {
  assert.deepEqual(splitDate("1901-05"), { y: "1901", m: "05", d: "" });
  assert.deepEqual(splitDate(""), { y: "", m: "", d: "" });
  assert.deepEqual(joinDate({ y: "1901", m: "05", d: "" }), { value: "1901-05", error: null });
  assert.deepEqual(joinDate({ y: "1901", m: "05", d: "7" }), { value: "1901-05-07", error: null });
  assert.deepEqual(joinDate({ y: "1901", m: "", d: "" }), { value: "1901", error: null });
  assert.deepEqual(joinDate({}), { value: "", error: null });
});

test("dates: inline validation errors", () => {
  assert.equal(joinDate({ y: "", m: "05" }).error, "year_required");
  assert.equal(joinDate({ y: "19", m: "" }).error, "year");
  assert.equal(joinDate({ y: "1901", m: "", d: "3" }).error, "day_without_month");
  assert.equal(joinDate({ y: "1901", m: "02", d: "30" }).error, "day");
  assert.equal(joinDate({ y: "1904", m: "02", d: "29" }).error, null); // leap year
});

test("gallery rows: full rows fill the width exactly, last row keeps the target height, a panorama spans", () => {
  const W = 700, G = 12, T = 220;
  const rows = justifyRows([4 / 3, 3 / 4, 4, 16 / 9, 9 / 16], W, T, G);
  for (const r of rows.slice(0, -1)) {
    const used = r.items.reduce((s, i) => s + i.width, 0) + G * (r.items.length - 1);
    assert.ok(Math.abs(used - W) < 1e-6, `row fills ${used}`); assert.ok(r.height <= T * 1.6, `row height ${r.height}`); // a row closed early by a panorama may stand a little taller
  }
  const pano = rows.find((r) => r.items.some((i) => i.index === 2));
  assert.equal(pano.items.length, 1); assert.ok(Math.abs(pano.items[0].width - W) < 1e-6);
  assert.equal(rows.at(-1).height, T);
  assert.deepEqual(rows.flatMap((r) => r.items.map((i) => i.index)), [0, 1, 2, 3, 4]);
  for (const r of rows) for (const it of r.items) assert.ok(Math.abs(it.width / r.height - [4 / 3, 3 / 4, 4, 16 / 9, 9 / 16][it.index]) < 1e-9);
});

test("last published: locale-aware, no seconds", () => {
  const now = new Date("2026-11-16T15:00:00Z");
  const ru = formatPublished("2026-11-16T11:38:51Z", "RU", now), en = formatPublished("2026-11-16T11:38:51Z", "EN", now);
  assert.match(ru, /^16 ноября, \d{2}:38$/); assert.match(en, /^16 November, \d{2}:38$/);
  assert.match(formatPublished("2025-01-02T10:00:00Z", "EN", now), /2025/);
  assert.equal(formatPublished(null, "EN"), null);
});
