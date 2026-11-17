// Family OS Stage 3a — engine planning (synthetic people only; no clock, no DB).
import { test } from "node:test";
import assert from "node:assert/strict";
import { localParts, isDue, inQuiet, rotationAssignee, missedRun, itemsFor, planSends, MAX_PER_DAY } from "./engine.mjs";

const at = (iso) => new Date(iso);
test("time: Europe/London across both DST switches", () => {
  // BST starts 2027-03-28 01:00 UTC; ends 2026-10-25 01:00 UTC
  assert.deepEqual(localParts(at("2027-03-28T06:00:00Z")), { date: "2027-03-28", hhmm: "07:00", weekday: 6 }, "07:00 BST = 06:00 UTC");
  assert.equal(localParts(at("2027-03-27T07:00:00Z")).hhmm, "07:00", "the day before: 07:00 GMT = 07:00 UTC");
  assert.equal(localParts(at("2026-10-25T07:00:00Z")).hhmm, "07:00", "after the switch back: GMT");
  assert.equal(localParts(at("2026-10-24T06:00:00Z")).hhmm, "07:00", "before: BST");
  assert.equal(localParts(at("2026-06-30T23:30:00Z")).date, "2026-07-01", "the family day follows London, not UTC");
});

test("windows and quiet hours", () => {
  assert.equal(isDue("07:00", "07:00"), true); assert.equal(isDue("07:00", "07:09"), true); assert.equal(isDue("07:00", "07:10"), false); assert.equal(isDue("07:00", "06:59"), false);
  assert.equal(inQuiet("21:00"), true); assert.equal(inQuiet("23:59"), true); assert.equal(inQuiet("06:59"), true); assert.equal(inQuiet("07:00"), false); assert.equal(inQuiet("20:59"), false);
  assert.equal(inQuiet("13:00", "12:00", "14:00"), true, "a daytime quiet window also works");
});

test("rotation: round-robin by occurrence, skipping unscheduled days", () => {
  const rot = { rrule: "FREQ=WEEKLY;BYDAY=MO,TH", dtstart: "2026-11-02", members: ["a", "b", "c"] };
  assert.deepEqual(["2026-11-02", "2026-11-05", "2026-11-09", "2026-11-12", "2026-11-16"].map((d) => rotationAssignee(rot, d)), ["a", "b", "c", "a", "b"]);
  assert.equal(rotationAssignee(rot, "2026-11-03"), null, "Tuesday: no turn");
  assert.equal(rotationAssignee({ ...rot, members: [] }, "2026-11-02"), null);
});

test("missed run: counts scheduled days back from yesterday; a tick or a pause interrupts/skips", () => {
  const r = { rrule: "FREQ=DAILY", dtstart: "2026-11-01" };
  assert.deepEqual(missedRun(r, new Set(["2026-11-14"]), () => false, "2026-11-18"), { count: 3, since: "2026-11-15" });
  assert.deepEqual(missedRun(r, new Set(["2026-11-16"]), () => false, "2026-11-18"), { count: 1, since: "2026-11-17" });
  assert.deepEqual(missedRun(r, new Set(["2026-11-14"]), (d) => d === "2026-11-16", "2026-11-18"), { count: 2, since: "2026-11-15" }, "paused day is skipped, not a miss");
});

// ---- a synthetic family
const P = { p1: { id: "p1", kind: "adult", email: "p1@example.test", name_ru: "Анна Тест", name_en: "Anna Test" },
  p2: { id: "p2", kind: "adult", email: "p2@example.test", name_ru: "Борис Тест", name_en: "Boris Test" },
  c: { id: "c", kind: "child", email: "c@example.test", name_ru: "Вера Тест", name_en: "Vera Test" },
  g: { id: "g", kind: "adult", email: "g@example.test", name_ru: "Галина Тест", name_en: "Galina Test" } };
const grants = [
  { guardian_id: "p1", child_id: "c", relation: "parent", scopes: ["routines", "documents"], revoked_at: null },
  { guardian_id: "p2", child_id: "c", relation: "parent", scopes: ["routines"], revoked_at: null },
  { guardian_id: "g", child_id: "c", relation: "relative", scopes: ["routines", "documents"], revoked_at: null } ];
const routines = [
  { id: "r1", person_id: "c", title: "Почистить зубы", rrule: "FREQ=DAILY", dtstart: "2026-11-01", at_time: "20:00" },
  { id: "r2", person_id: "p1", title: "Пробежка", rrule: "FREQ=DAILY", dtstart: "2026-11-01", at_time: "07:00" } ];
const base = (over = {}) => ({ people: Object.values(P), grants, routines, rotations: [], pauses: [], checks: [], rotationChecks: [],
  documents: [{ id: "d1", person_id: "c", type: "passport", expiry_date: "2027-01-31" }, { id: "d2", person_id: "p1", type: "passport", expiry_date: "2026-11-07" }],
  prefs: new Map(), rules: new Map([["digest", { enabled: true, dry_run: false }], ["evening_checkin", { enabled: true, dry_run: false }]]), ledger: new Set(), sentToday: new Map(), ...over });
const MORNING = at("2026-11-18T07:02:00Z"); // Wed 07:02 GMT

test("digest: each person gets only their own items; a child gets nothing about anyone else", () => {
  const s = planSends(MORNING, base());
  const by = Object.fromEntries(s.map((x) => [x.person.id, x]));
  assert.deepEqual(by.c.payload.items, [{ title: "Почистить зубы", time: "20:00" }]);
  assert.deepEqual(by.p1.payload.items, [{ title: "Пробежка", time: "07:00" }]);
  assert.equal(by.p2, undefined, "nothing scheduled → no empty email");
  assert.equal(by.c.payload.firstName, "Вера");
  assert.ok(s.every((x) => x.rule === "digest" && !x.skip && !x.dry_run && x.key === "2026-11-18"));
});

test("documents in the digest: only with the rule on; adults own + guardians with documents; never to the child", () => {
  assert.ok(planSends(MORNING, base()).every((x) => x.payload.docs.length === 0), "rule off → no document lines");
  const s = planSends(MORNING, base({ rules: new Map([["digest", { enabled: true, dry_run: false }], ["documents_in_digest", { enabled: true }]]) }));
  const by = Object.fromEntries(s.map((x) => [x.person.id, x]));
  assert.deepEqual(by.p1.payload.docs.map((d) => d.who).sort(), ["Анна", "Вера"], "own expired + child's within 3 months");
  assert.deepEqual(by.g.payload.docs.map((d) => d.who), ["Вера"], "relative with the documents scope");
  assert.deepEqual(by.c.payload.docs, [], "the child gets no document lines");
  assert.equal(by.p2, undefined, "parent without the documents scope, nothing else → no email");
  assert.ok(!JSON.stringify(s).match(/d1|d2|expiry_date/), "no document ids in payloads");
});

test("missed-routine note: parents only (not the relative, never the child), once per run", () => {
  const rules = new Map([["digest", { enabled: true, dry_run: false }], ["missed_routine_parent_note", { enabled: true }]]);
  const checks = [{ routine_id: "r1", on_date: "2026-11-14", done: true }];
  const s = planSends(MORNING, base({ rules, checks }));
  const notes = Object.fromEntries(s.map((x) => [x.person.id, x.payload.notes]));
  assert.deepEqual(notes.p1, [{ child: "Вера", title: "Почистить зубы" }]);
  assert.deepEqual(notes.p2, [{ child: "Вера", title: "Почистить зубы" }]);
  assert.deepEqual(notes.g ?? [], [], "relative: no note");
  assert.deepEqual(notes.c, [], "the child never gets it");
  const dayAfter = planSends(at("2026-11-19T07:02:00Z"), base({ rules, checks }));
  assert.ok(dayAfter.every((x) => x.payload.notes.length === 0), "4th day: not repeated");
});

test("guards: opt-out, quiet hours, dry-run, ledger, daily cap", () => {
  const prefs = new Map([["p1", { email_on: false }], ["c", { digest_time: "06:30" }]]);
  const early = planSends(at("2026-11-18T06:31:00Z"), base({ prefs }));
  assert.equal(early.find((x) => x.person.id === "c").skip, "quiet_hours", "a 06:30 digest falls in quiet hours");
  assert.equal(planSends(MORNING, base({ prefs })).find((x) => x.person.id === "p1").skip, "opted_out");
  assert.ok(planSends(MORNING, base({ rules: new Map([["digest", { enabled: true, dry_run: true }]]) })).every((x) => x.dry_run), "dry run");
  assert.equal(planSends(MORNING, base({ rules: new Map([["digest", { enabled: false }]]) })).length, 0, "rule off");
  assert.equal(planSends(MORNING, base({ ledger: new Set(["digest|2026-11-18|c"]) })).some((x) => x.person.id === "c"), false, "already sent today");
  assert.equal(planSends(MORNING, base({ sentToday: new Map([["c", MAX_PER_DAY]]) })).find((x) => x.person.id === "c").skip, "daily_cap");
});

test("pause («день без ритма»): no items, no digest, no evening", () => {
  const pauses = [{ person_id: "c", from_date: "2026-11-17", to_date: "2026-11-19", cancelled_at: null }];
  assert.deepEqual(itemsFor(P.c, "2026-11-18", base({ pauses })), []);
  assert.equal(planSends(MORNING, base({ pauses })).some((x) => x.person.id === "c"), false);
  assert.equal(itemsFor(P.c, "2026-11-18", base({ pauses: [{ ...pauses[0], cancelled_at: "x" }] })).length, 1, "a cancelled pause has no effect");
});

test("evening check-in: opt-in, only open items; council reminder Sunday 18:00 to every member", () => {
  const prefs = new Map([["c", { evening_on: true }]]);
  const eve = at("2026-11-18T20:03:00Z");
  assert.deepEqual(planSends(eve, base({ prefs })).map((x) => [x.person.id, x.payload.kind, x.payload.items.length]), [["c", "evening", 1]]);
  assert.equal(planSends(eve, base({ prefs, checks: [{ routine_id: "r1", on_date: "2026-11-18", done: true }] })).length, 0, "all done → no email");
  const rules = new Map([["council_reminder", { enabled: true, dry_run: false }]]);
  assert.equal(planSends(at("2026-11-22T18:01:00Z"), base({ rules })).length, 4, "Sunday 18:01: every member");
  assert.equal(planSends(at("2026-11-21T18:01:00Z"), base({ rules })).length, 0, "Saturday: none");
});

test("rotation turns appear in the assignee's items and digest only", () => {
  const rotations = [{ id: "x1", title: "Вынести мусор", rrule: "FREQ=DAILY", dtstart: "2026-11-17", at_time: null, members: ["c", "p1"], archived_at: null }];
  assert.ok(itemsFor(P.p1, "2026-11-18", base({ rotations })).some((i) => i.title === "Вынести мусор"), "day 2 → second member");
  assert.ok(!itemsFor(P.c, "2026-11-18", base({ rotations })).some((i) => i.title === "Вынести мусор"));
  assert.ok(itemsFor(P.c, "2026-11-19", base({ rotations })).some((i) => i.title === "Вынести мусор"), "day 3 → back to the first");
});
