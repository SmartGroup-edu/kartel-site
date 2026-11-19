// Family OS Stage 3d-2 — «Кто уже с нами» (bus 84/97 item 3; synthetic people only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { familyWeek, adoptionRows } from "./adoption.mjs";
import { planInvites } from "./engine.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-stage3d2-secret-at-least-32-chars!!";
const TODAY = "2026-11-18"; // Wednesday; week 2026-11-16 … 2026-11-22
let server, base, store, clockAt = `${TODAY}T10:00:00Z`;
const ADMIN = "admin:admin@example.test", as = (k) => `member:${E[k]}`;
const E = { p1: "parent1@example.test", c: "child@example.test", e: "adult@example.test" };
const P = {};
async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* none */ }
  return { status: r.status, json };
}
before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date(clockAt) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["c", "child"], ["e", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  await call("POST", "/grants", { body: { guardian_id: P.p1, child_id: P.c, relation: "parent", scopes: ["routines"] } });
});
after(() => server.close());

test("pure: the family line counts members with a routine ticked done Monday..today — one number, the gate's measure", () => {
  const people = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const routines = [{ id: "r1", person_id: "a" }, { id: "r2", person_id: "b" }, { id: "r3", person_id: "b" }];
  const checks = [{ routine_id: "r1", on_date: "2026-11-17", done: true }, { routine_id: "r2", on_date: "2026-11-15", done: true }, { routine_id: "r3", on_date: "2026-11-18", done: false }, { routine_id: "r3", on_date: "2026-11-19", done: true }];
  assert.deepEqual(familyWeek(people, routines, checks, "2026-11-16", "2026-11-18"), { active: 1, of: 3 }, "last week, an undone tick and a future date don't count");
  assert.deepEqual(familyWeek(people, [...routines, { id: "r9", person_id: "gone" }], [{ routine_id: "r9", on_date: "2026-11-17", done: true }], "2026-11-16", "2026-11-18"), { active: 0, of: 3 }, "only current members");
  const rows = adoptionRows([{ id: "a", email: "a@example.test", name_en: "A", name_ru: "А", kind: "child" }], [{ email: "a@example.test", first_on: "2026-11-14", last_on: "2026-11-18" }], new Map(), []);
  assert.deepEqual(rows[0], { id: "a", name_en: "A", name_ru: "А", kind: "child", signed_in: { first_on: "2026-11-14", last_on: "2026-11-18" }, digest: { on: true, time: "07:00" }, passkey: null, invite: null });
});

test("/signins records the actor's own sign-in date only; first stays, last moves", async () => {
  assert.equal((await call("POST", "/signins", { actor: as("c") })).status, 200);
  clockAt = "2026-11-19T10:00:00Z";
  assert.equal((await call("POST", "/signins", { actor: as("c") })).status, 200);
  assert.equal((await call("POST", "/signins", { actor: as("c"), body: { email: E.p1 } })).status, 200, "a body is ignored");
  clockAt = `${TODAY}T10:00:00Z`;
  const seen = await store.signIns();
  assert.deepEqual(seen, [{ email: E.c, first_on: "2026-11-18", last_on: "2026-11-19" }], "only the actor's own address is ever written");
});

test("/adoption: owner only; per person dates + letter + invite; ONE family line; no per-person activity numbers", async () => {
  for (const k of ["p1", "c", "e"]) assert.equal((await call("GET", "/adoption", { actor: as(k) })).status, 403, k);
  const routine = (await call("POST", `/people/${P.c}/routines`, { actor: as("p1"), body: { kind: "routine", title: "QA Зубы", rrule: "FREQ=DAILY", dtstart: "2026-11-01" } })).json.id;
  await call("POST", `/routines/${routine}/check`, { actor: as("c"), body: { date: "2026-11-17", done: true } });
  const a = (await call("GET", "/adoption")).json;
  assert.deepEqual(a.family, { week_start: "2026-11-16", active: 1, of: 3 });
  const child = a.people.find((x) => x.id === P.c);
  assert.deepEqual(child.signed_in, { first_on: "2026-11-18", last_on: "2026-11-19" });
  assert.deepEqual(a.people.find((x) => x.id === P.e).signed_in, null);
  for (const row of a.people) {
    assert.deepEqual(Object.keys(row).sort(), ["digest", "id", "invite", "kind", "name_en", "name_ru", "passkey", "signed_in"]);
    assert.ok(!JSON.stringify(row).match(/"(done|count|ticks|streak|week|n)"\s*:/), "no activity numbers per person");
    assert.ok(!("email" in row));
  }
});

test("invite: owner only; one per person per day (409); 404 for an unknown person; the route class carries no id", async () => {
  assert.equal((await call("POST", `/people/${P.e}/invite`, { actor: as("p1"), body: {} })).status, 403);
  assert.equal((await call("POST", `/people/00000000-0000-4000-8000-000000000000/invite`, { body: {} })).status, 404);
  assert.equal((await call("POST", `/people/${P.e}/invite`, { body: {} })).status, 202);
  assert.equal((await call("POST", `/people/${P.e}/invite`, { body: {} })).status, 409, "once a day");
  const row = (await call("GET", "/adoption")).json.people.find((x) => x.id === P.e);
  assert.deepEqual(row.invite, { on_date: TODAY, sent: false, sent_at: null });
  assert.equal(routeClass(`/people/${P.e}/invite`), "/people/:id/invite");
  assert.equal(routeClass("/adoption"), "/adoption"); assert.equal(routeClass("/signins"), "/signins");
});

test("planInvites: quiet hours defer, older than two days drop, sent ones skip; first name only", () => {
  const people = [{ id: "x", email: "x@example.test", name_ru: "Анна QA", name_en: "Anna QA" }];
  const inv = (on_date, extra = {}) => ({ id: 1, person_id: "x", on_date, sent_at: null, ...extra });
  const at = (iso) => new Date(iso);
  assert.equal(planInvites([inv(TODAY)], people, new Map(), at("2026-11-18T10:00:00Z")).length, 1);
  assert.deepEqual(planInvites([inv(TODAY)], people, new Map(), at("2026-11-18T10:00:00Z"))[0].firstName, "Анна");
  assert.equal(planInvites([inv(TODAY)], people, new Map(), at("2026-11-18T22:30:00Z")).length, 0, "21:00–07:00 is quiet");
  assert.equal(planInvites([inv("2026-11-15")], people, new Map(), at("2026-11-18T10:00:00Z")).length, 0, "too old: dropped");
  assert.equal(planInvites([inv("2026-11-17")], people, new Map(), at("2026-11-18T07:05:00Z")).length, 1, "last night's request goes in the morning");
  assert.equal(planInvites([inv(TODAY, { sent_at: "x" })], people, new Map(), at("2026-11-18T10:00:00Z")).length, 0);
  assert.equal(planInvites([inv(TODAY)], people, new Map([["x", { lang: "en" }]]), at("2026-11-18T10:00:00Z"))[0].firstName, "Anna");
});

test("privileges: kfo_app may upsert sign-in dates and mark invites sent — never delete either", () => {
  const roles = readFileSync(new URL("./roles.sql", import.meta.url), "utf8");
  assert.match(roles, /GRANT SELECT, INSERT, UPDATE \(last_on\) ON signin_seen TO kfo_app;/);
  assert.match(roles, /GRANT SELECT, INSERT, UPDATE \(sent_at\) ON invite_request TO kfo_app;/);
  assert.doesNotMatch(roles, /GRANT[^;]*DELETE[^;]* ON [^;]*\b(signin_seen|invite_request)\b/);
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS signin_seen \(\s*email\s+text PRIMARY KEY CHECK \(email = lower\(email\)/);
  assert.doesNotMatch(schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS signin_seen"), schema.indexOf("CREATE TABLE IF NOT EXISTS invite_request")), /\bip\b|user_agent|\bat\s+timestamptz/i, "dates only: no time, IP or device");
});
