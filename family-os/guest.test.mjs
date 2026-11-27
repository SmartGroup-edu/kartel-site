// Family OS bus 176 P4 — the read-only guest: the owner invites and revokes; a guest reads only their sections, only
// while the grant is active; every write is refused; no child or person data; reads and sign-ins are logged
// (synthetic people only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createApp } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { parseActor } from "./policy.mjs";
import { cleanGuestInvite, guestSectionOf, guestActive, plusDays, GUEST_SECTIONS } from "./guest.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-guest-secret-at-least-32-characters!!";
const TODAY = "2026-11-27";
let server, base, store, clockAt = `${TODAY}T10:00:00Z`;
const ADMIN = "admin:admin@example.test", GUEST_EMAIL = "accountant@example.test";
const E = { a: "anna@example.test", c: "vera@example.test" };
const P = {};
async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* none */ }
  return { status: r.status, json };
}
const lookup = (body) => call("POST", "/guests/lookup", { body, actor: "auth:guest" });
const until = plusDays(TODAY, 120);
let G; // the guest grant id
const asGuest = (id = G) => `guest:${id}`;

before(async () => {
  store = memoryStore({ clock: () => new Date(clockAt) });
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date(clockAt), passkeys: null })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["a", "adult"], ["c", "child"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  await call("PATCH", `/people/${P.c}`, { body: { birth_date: "2015-12-01" } });
  await call("POST", "/grants", { body: { guardian_id: P.a, child_id: P.c, relation: "parent", scopes: ["routines", "health", "education", "documents"] } });
  await call("POST", "/events", { body: { title: "QA family dinner", on_date: plusDays(TODAY, 2) }, actor: `member:${E.a}` });
  // An adult's own task and a task the child takes part in, both today (the day's plan approved first, so they are on the board).
  await call("PUT", `/plan/${TODAY}`, { body: { items: [] }, actor: `member:${E.a}` });
  for (const [title, assignee_id] of [["QA adult task", P.a], ["QA child task", P.c]])
    assert.equal((await call("POST", `/plan/${TODAY}/tasks`, { body: { title, assignee_id }, actor: `member:${E.a}` })).json?.state, "approved");
});
after(() => server.close());

test("pure: the actor, the invitation rules, the route map", () => {
  const id = "0b0e7f5c-1a2b-4c3d-8e4f-123456789abc";
  assert.deepEqual(parseActor(`guest:${id}`), { role: "guest", id, email: `guest:${id}` });
  assert.equal(parseActor("guest:not-a-uuid"), null);
  assert.equal(parseActor(`guest:${id.toUpperCase()}`), null);
  const ok = { email: " Accountant@Example.TEST ", label: "Бухгалтер", sections: ["review", "calendar"], until };
  assert.deepEqual(cleanGuestInvite(ok, TODAY), { email: GUEST_EMAIL, label: "Бухгалтер", sections: ["calendar", "review"], until });
  assert.equal(cleanGuestInvite({ ...ok, until: undefined }, TODAY).error, "bad_until", "the end date is required");
  assert.equal(cleanGuestInvite({ ...ok, until: plusDays(TODAY, 366) }, TODAY).error, "bad_until", "one year at most");
  assert.equal(cleanGuestInvite({ ...ok, until: plusDays(TODAY, 365) }, TODAY).error, undefined);
  assert.equal(cleanGuestInvite({ ...ok, until: plusDays(TODAY, -1) }, TODAY).error, "bad_until");
  assert.equal(cleanGuestInvite({ ...ok, until: "2027-02-30" }, TODAY).error, "bad_until");
  assert.equal(cleanGuestInvite({ ...ok, sections: [] }, TODAY).error, "bad_sections");
  assert.equal(cleanGuestInvite({ ...ok, sections: ["people"] }, TODAY).error, "bad_sections", "only the allow-list");
  assert.equal(cleanGuestInvite({ ...ok, sections: ["calendar", "calendar"] }, TODAY).error, "bad_sections");
  assert.equal(cleanGuestInvite({ ...ok, label: "" }, TODAY).error, "bad_label");
  assert.equal(cleanGuestInvite({ ...ok, email: "a:b@c.test" }, TODAY).error, "bad_email");
  assert.deepEqual(GUEST_SECTIONS, ["calendar", "kodeks", "companies", "review"]);
  assert.equal(guestSectionOf("GET", "/board"), "review");
  assert.equal(guestSectionOf("POST", "/board"), null);
  assert.equal(guestSectionOf("GET", "/people"), null);
  assert.equal(guestActive({ until: TODAY, revoked_at: null }, TODAY), true, "the end date is inclusive");
  assert.equal(guestActive({ until: TODAY, revoked_at: null }, plusDays(TODAY, 1)), false);
});

test("invite: owner only; member address refused; one open grant per address", async () => {
  const body = { email: GUEST_EMAIL, label: "Бухгалтер", sections: ["calendar", "review", "companies"], until };
  assert.equal((await call("POST", "/guests", { body, actor: `member:${E.a}` })).status, 403);
  assert.equal((await call("POST", "/guests", { body: { ...body, email: E.a } })).json.error, "is_member");
  assert.equal((await call("POST", "/guests", { body: { ...body, until: plusDays(TODAY, 400) } })).status, 400);
  const r = await call("POST", "/guests", { body });
  assert.equal(r.status, 201); G = r.json.id;
  assert.equal((await call("POST", "/guests", { body })).json.error, "exists");
  const list = (await call("GET", "/guests")).json.guests;
  assert.deepEqual(list.map((g) => [g.label, g.email, g.sections, g.until, g.active]), [["Бухгалтер", GUEST_EMAIL, ["calendar", "companies", "review"], until, true]]);
  assert.equal((await call("GET", "/guests", { actor: `member:${E.a}` })).status, 403);
});

test("lookup (auth:guest): active → the grant without the address; unknown → 404; a page view of an allowed section is logged", async () => {
  const r = await lookup({ email: GUEST_EMAIL, sat: Math.floor(Date.parse(clockAt) / 1000), section: "companies" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.guest, { id: G, label: "Бухгалтер", sections: ["calendar", "companies", "review"], until });
  assert.equal((await lookup({ email: "stranger@example.test" })).status, 404);
  assert.equal((await lookup({ email: E.a })).status, 404, "a member is not a guest");
  await lookup({ email: GUEST_EMAIL, section: "kodeks" }); // not one of theirs: not logged
  assert.equal((await call("POST", "/guests/signin", { body: { email: GUEST_EMAIL }, actor: "auth:guest" })).status, 200);
  const log = (await call("GET", `/guests/${G}/log`)).json.log;
  assert.deepEqual(log.map((x) => [x.action, x.section, x.route]), [["signin", null, "signin"], ["read", "companies", "page"]]);
  assert.equal((await call("GET", "/me", { actor: "auth:guest" })).status, 403, "auth:guest is accepted on its two routes only");
  assert.equal((await call("POST", "/guests", { body: {}, actor: "auth:guest" })).status, 403);
});

test("guest reads: /me says guest; the calendar has no birthdays and no write; closed sections and person routes are 403", async () => {
  const me = await call("GET", "/me", { actor: asGuest() });
  assert.deepEqual(me.json, { me: null, admin: false, guest: { id: G, label: "Бухгалтер", sections: ["calendar", "companies", "review"], until } });
  const cal = await call("GET", "/calendar?days=62", { actor: asGuest() });
  assert.equal(cal.status, 200);
  assert.equal(cal.json.can.write, false);
  assert.ok(cal.json.items.some((x) => x.title === "QA family dinner"));
  assert.ok(!cal.json.items.some((x) => x.kind === "birthday"), "no birthdays for a guest");
  for (const p of ["/kodeks", "/principle", "/people", `/people/${P.a}`, `/people/${P.c}/documents`, `/people/${P.c}/notes`, `/people/${P.c}/routines`, "/my-tasks",
    "/council", "/reminders", "/grants", "/guests", "/adoption", "/recognitions", "/goals", "/health", "/body", `/tasks/${P.a}`])
    assert.equal((await call("GET", p, { actor: asGuest() })).status, 403, p);
});

test("guest writes: every one is 403 read_only, before any route runs", async () => {
  for (const [m, p, body] of [["POST", "/events", { title: "x", on_date: TODAY }], ["POST", "/signins", {}], ["PUT", `/council/2026-11-29`, { notes: "x", held: false }],
    ["POST", "/kodeks", {}], ["POST", "/sprint/goals", { title: "x" }], ["POST", `/people/${P.c}/notes`, {}], ["PATCH", `/people/${P.a}`, {}], ["DELETE", `/grants/${P.a}`, undefined],
    ["POST", "/onboarding", {}], ["POST", "/guests", {}], ["POST", `/guests/${G}/revoke`, {}], ["POST", "/sessions/end-all", {}]]) {
    const r = await call(m, p, { body, actor: asGuest() });
    assert.deepEqual([r.status, r.json?.error], [403, "read_only"], `${m} ${p}`);
  }
  assert.equal((await call("GET", "/guests", {})).json.guests[0].active, true, "nothing changed");
});

test("guest board («Обзор недели»): adults' tasks only — no child, no child's task, no routines, no parent-only blocks", async () => {
  const own = await call("GET", "/board", { actor: `member:${E.a}` });
  assert.ok(own.json.tasks.some((t) => t.assignee_id === P.c), "the parent sees the child's task (fixture check)");
  const b = await call("GET", "/board", { actor: asGuest() });
  assert.equal(b.status, 200);
  assert.deepEqual(b.json.members.map((m) => m.id), [P.a]);
  assert.ok(b.json.tasks.length >= 1 && b.json.tasks.every((t) => t.assignee_id === P.a && t.co_ids.length === 0));
  assert.ok(!JSON.stringify(b.json).includes("QA child"));
  assert.equal(b.json.needs_decision, undefined);
  assert.deepEqual(b.json.can, { approve: false, sprint: false });
  const s = await call("GET", "/sprint", { actor: asGuest() });
  assert.deepEqual([s.status, s.json.can.write], [200, false]);
  const log = (await call("GET", `/guests/${G}/log`)).json.log;
  assert.deepEqual(log.slice(0, 3).map((x) => [x.section, x.route]), [["review", "/sprint"], ["review", "/board"], ["calendar", "/calendar"]], "reads logged by section and route class");
});

test("acceptor: a guest's sprint counts leave out the tasks a child takes part in (/sprint as /board)", async () => {
  const goal = (await call("POST", "/sprint/goals", { body: { title: "QA sprint goal" }, actor: `member:${E.a}` })).json.id;
  for (const assignee_id of [P.a, P.c])
    assert.equal((await call("POST", `/sprint/goals/${goal}/tasks`, { body: { title: "QA sprint task", assignee_id, plan_date: TODAY }, actor: `member:${E.a}` })).status, 201);
  const count = (r) => r.json.goals.find((g) => g.id === goal)?.total;
  assert.equal(count(await call("GET", "/sprint", { actor: `member:${E.a}` })), 2, "the parent counts both (fixture check)");
  assert.equal(count(await call("GET", "/sprint", { actor: asGuest() })), 1);
  assert.equal((await call("GET", "/board", { actor: asGuest() })).json.sprint.goals.find((g) => g.id === goal)?.total, 1);
});

test("the log fails closed: no log row, no read", async () => {
  store.failLog = true;
  try {
    assert.equal((await call("GET", "/calendar", { actor: asGuest() })).status, 503);
    assert.equal((await lookup({ email: GUEST_EMAIL, section: "calendar" })).status, 503);
  } finally { store.failLog = false; }
});

test("revoke: immediate — the next guest call is 401 guest_ended and the lookup is 404; owner only", async () => {
  assert.equal((await call("POST", `/guests/${G}/revoke`, { body: {}, actor: `member:${E.a}` })).status, 403);
  assert.equal((await call("POST", `/guests/${G}/revoke`, { body: {} })).status, 200);
  assert.equal((await call("POST", `/guests/${G}/revoke`, { body: {} })).status, 404);
  assert.deepEqual([(await call("GET", "/me", { actor: asGuest() })).status, (await call("GET", "/calendar", { actor: asGuest() })).json?.error], [401, "guest_ended"]);
  assert.equal((await lookup({ email: GUEST_EMAIL })).status, 404);
  const g = (await call("GET", "/guests")).json.guests.find((x) => x.id === G);
  assert.equal(g.active, false); assert.ok(g.revoked_at);
  assert.equal((await call("GET", "/me", { actor: asGuest("0b0e7f5c-1a2b-4c3d-8e4f-123456789abc") })).status, 401, "an unknown grant is refused the same way");
});

test("expiry: the day after the end date the guest is refused; the address can then be invited again", async () => {
  const r = await call("POST", "/guests", { body: { email: GUEST_EMAIL, label: "Бухгалтер", sections: ["kodeks"], until: plusDays(TODAY, 1) } });
  assert.equal(r.status, 201);
  const id = r.json.id;
  clockAt = `${plusDays(TODAY, 1)}T22:00:00Z`; // 22:00 UTC on the end date is still the end date in London
  assert.equal((await call("GET", "/kodeks", { actor: asGuest(id) })).status, 200);
  assert.equal((await call("GET", "/kodeks", { actor: asGuest(id) })).json.history.every((h) => h.by === null), true, "no family names in the history");
  clockAt = `${plusDays(TODAY, 2)}T09:00:00Z`;
  assert.equal((await call("GET", "/kodeks", { actor: asGuest(id) })).status, 401);
  assert.equal((await lookup({ email: GUEST_EMAIL })).status, 404);
  assert.equal((await call("POST", "/guests", { body: { email: GUEST_EMAIL, label: "Бухгалтер", sections: ["kodeks"], until: plusDays(TODAY, 30) } })).status, 201, "the expired grant was closed first");
  const audit = (await store.listGuests()).filter((g) => g.revoked_by === "system:expired");
  assert.equal(audit.length, 1);
});

test("«Завершить сеансы для всех» ends a guest's older session at the edge lookup", async () => {
  const old = Math.floor(Date.parse(clockAt) / 1000) - 60;
  clockAt = new Date(Date.parse(clockAt) + 300_000).toISOString();
  assert.equal((await call("POST", "/sessions/end-all", { body: {} })).status, 200);
  assert.equal((await lookup({ email: GUEST_EMAIL, sat: old })).json?.error, "session_ended");
  assert.equal((await lookup({ email: GUEST_EMAIL, sat: Math.floor(Date.parse(clockAt) / 1000) + 1 })).status, 200);
});
