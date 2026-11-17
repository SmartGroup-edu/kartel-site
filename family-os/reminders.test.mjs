// Bus 66 — document-expiry reminders: milestones, tiers, recipients, idempotency, no numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { daysLeft, dueMilestone, tier, recipients, planReminders, relayPayload } from "./reminders.mjs";
import { sign } from "./relay-sign.mjs";
import { createHmac } from "node:crypto";

const today = new Date("2026-11-17T09:00:00Z");
const day = (n) => new Date(Date.UTC(2026, 10, 17) + n * 86400_000).toISOString().slice(0, 10);

test("milestones: the tightest reached one; nothing before 12 months or after expiry", () => {
  const cases = [[400, null], [366, null], [365, 12], [200, 12], [183, 6], [100, 6], [91, 3], [31, 3], [30, 1], [1, 1], [0, 0], [-1, null]];
  for (const [d, m] of cases) assert.equal(dueMilestone(daysLeft(day(d), today)), m, `${d} days`);
});

test("tiers on Today: expired / < 3 / < 6 / < 12 months", () => {
  assert.deepEqual([-5, 0, 91, 92, 183, 184, 365, 366].map((d) => tier(daysLeft(day(d), today))), ["expired", "lt3", "lt3", "lt6", "lt6", "lt12", "lt12", null]);
});

const people = [
  { id: "a", email: "a@x.test", name_en: "QA Adult", name_ru: "QA Взрослый", kind: "adult" },
  { id: "m", email: "m@x.test", name_en: "QA Mum", name_ru: "QA Мама", kind: "adult" },
  { id: "d", email: "d@x.test", name_en: "QA Dad", name_ru: "QA Папа", kind: "adult" },
  { id: "g", email: "g@x.test", name_en: "QA Gran", name_ru: "QA Бабушка", kind: "adult" },
  { id: "c", email: "c@x.test", name_en: "QA Kid", name_ru: "QA Ребёнок", kind: "child" },
];
const grants = [
  { guardian_id: "m", child_id: "c", scopes: ["routines", "documents"], revoked_at: null },
  { guardian_id: "d", child_id: "c", scopes: ["health", "documents"], revoked_at: null },
  { guardian_id: "g", child_id: "c", scopes: ["routines"], revoked_at: null },
];

test("recipients: adults themselves; minors → guardians with documents (not the child, not grandma)", () => {
  assert.deepEqual(recipients(people[0], people, grants).map((p) => p.id), ["a"]);
  assert.deepEqual(recipients(people[4], people, grants).map((p) => p.id).sort(), ["d", "m"]);
});

test("plan: one email per milestone and recipient; already-sent ones are skipped (idempotent)", () => {
  const docs = [{ id: "D1", person_id: "c", type: "passport", expiry_date: day(80) }, { id: "D2", person_id: "a", type: "ni_number", expiry_date: day(500) }];
  const first = planReminders(docs, people, grants, new Set(), today);
  assert.deepEqual(first.map((x) => `${x.doc.id}:${x.milestone}:${x.recipient.id}`).sort(), ["D1:3:d", "D1:3:m"]);
  const sent = new Set(first.map((x) => `${x.doc.id}:${x.milestone}:${x.recipient.id}`));
  assert.deepEqual(planReminders(docs, people, grants, sent, today), [], "a second run the same day sends nothing");
  const later = planReminders(docs, people, grants, sent, new Date("2027-01-14T09:00:00Z"));
  assert.deepEqual(later.map((x) => x.milestone), [1, 1], "the next milestone fires once its day comes");
});

test("relay payload: type, first name, date, milestone, profile link — never a number", () => {
  const p = relayPayload({ doc: { id: "D1", type: "passport", expiry_date: "2027-02-05", number_ct: "x", number: "QA1234567" }, holder: { ...people[4], id: "11111111-1111-4111-8111-111111111111" }, milestone: 3, recipient: people[1] });
  assert.deepEqual(Object.keys(p).sort(), ["expiry", "firstName", "kind", "lang", "link", "milestone", "to"]);
  assert.equal(p.firstName, "QA");
  assert.equal(p.link, "https://kartel.org.uk/ru/family/os/people/11111111-1111-4111-8111-111111111111");
  assert.ok(!JSON.stringify(p).includes("QA1234567"));
});

test("relay signature matches the relay's scheme", () => {
  assert.equal(sign("s".repeat(40), "1", "{}"), createHmac("sha256", "s".repeat(40)).update("1.{}").digest("hex"));
});
