// Family OS Stage 3a — settings, pauses, rotations, rules, events (synthetic people only).
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { canEditPrefs } from "./policy.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-stage3a-secret-at-least-32-chars!!!";
const TODAY = "2026-11-18"; // Wednesday
let server, base, store;
const ADMIN = "admin:admin@example.test", as = (e) => `member:${e}`;
const E = { p1: "parent1@example.test", p2: "parent2@example.test", c: "child@example.test", c2: "child2@example.test", e: "adult@example.test", g: "relative@example.test", x: "outsider@example.test" };
const P = {};

async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  return { status: r.status, json: await r.json().catch(() => null) };
}

before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date(`${TODAY}T10:00:00Z`) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["p2", "adult"], ["c", "child"], ["c2", "child"], ["e", "adult"], ["g", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  for (const k of ["p1", "p2"]) for (const c of ["c", "c2"]) await call("POST", "/grants", { body: { guardian_id: P[k], child_id: P[c], relation: "parent", scopes: ["routines", "documents"] } });
  await call("POST", "/grants", { body: { guardian_id: P.g, child_id: P.c, relation: "relative", scopes: ["health"] } });
});
after(() => server.close());

const PREFS = { email_on: true, digest_time: "07:30", evening_on: true, evening_time: "19:45", lang: "ru" };

test("policy: who edits a person's notification settings and pauses", () => {
  const p1 = { id: "p1", kind: "adult" }, c = { id: "c", kind: "child" }, e = { id: "e", kind: "adult" }, g = { id: "g", kind: "adult" };
  const grants = [{ guardian_id: "p1", child_id: "c", scopes: ["routines"], revoked_at: null }, { guardian_id: "g", child_id: "c", scopes: ["health"], revoked_at: null }];
  assert.equal(canEditPrefs(c, c, grants), true, "a child: own inbox");
  assert.equal(canEditPrefs(p1, c, grants), true, "parent with routines");
  assert.equal(canEditPrefs(g, c, grants), false, "relative without routines");
  assert.equal(canEditPrefs(p1, e, grants), false, "another adult");
  assert.equal(canEditPrefs(null, c, grants), false, "admin / outsider");
});

test("prefs: defaults, validated writes, 7-role matrix", async () => {
  for (const [actor, can] of [[as(E.c), true], [as(E.p1), true], [as(E.g), false], [ADMIN, false]])
    assert.equal((await call("GET", `/people/${P.c}`, { actor })).json.can.prefs, can, `profile can.prefs ${actor}`);
  const d = await call("GET", `/people/${P.c}/prefs`, { actor: as(E.c) });
  assert.deepEqual(d.json.prefs, { email_on: true, digest_time: "07:00", evening_on: false, evening_time: "20:00", quiet_start: "21:00", quiet_end: "07:00", lang: "ru", count_mode: "week" });
  assert.equal((await call("PUT", `/people/${P.c}/prefs`, { actor: as(E.p1), body: PREFS })).status, 200);
  assert.equal((await call("GET", `/people/${P.c}/prefs`, { actor: as(E.c) })).json.prefs.digest_time, "07:30");
  for (const bad of [{ ...PREFS, digest_time: "06:30" }, { ...PREFS, evening_time: "21:00" }, { ...PREFS, email_on: "yes" }, { ...PREFS, lang: "de" }])
    assert.equal((await call("PUT", `/people/${P.c}/prefs`, { actor: as(E.c), body: bad })).json.error, "bad_prefs", JSON.stringify(bad));
  for (const [actor, code] of [[as(E.p2), 200], [as(E.c), 200], [as(E.g), 403], [as(E.e), 403], [as(E.x), 403], [ADMIN, 403]])
    assert.equal((await call("GET", `/people/${P.c}/prefs`, { actor })).status, code, actor);
  assert.equal((await call("PUT", `/people/${P.e}/prefs`, { actor: as(E.p1), body: PREFS })).status, 403, "another adult's settings");
});

test("pause («день без ритма»): hides today's items, skips streak days, cancel restores", async () => {
  const r = (await call("POST", `/people/${P.c}/routines`, { actor: as(E.p1), body: { kind: "routine", title: "Brush teeth", rrule: "FREQ=DAILY", dtstart: "2026-11-10" } })).json.id;
  for (const d of ["2026-11-16", "2026-11-17"]) await call("POST", `/routines/${r}/check`, { actor: as(E.c), body: { date: d, done: true } });
  const pause = await call("POST", `/people/${P.c}/pauses`, { actor: as(E.c), body: { from_date: TODAY, to_date: "2026-11-20" } });
  assert.equal(pause.status, 201);
  let v = await call("GET", `/people/${P.c}/routines`, { actor: as(E.c) });
  assert.equal(v.json.paused_today, true);
  assert.equal(v.json.routines.find((x) => x.id === r).due_today, false, "paused: nothing due");
  // bus 86: a child sees «N из M на этой неделе» (no streak); paused days drop out of M, nothing is "lost"
  assert.deepEqual(v.json.routines.find((x) => x.id === r).week, { done: 2, of: 2 }, "Wed 18.11 inside the pause (18–20): Mon + Tue so far; paused and future days are out (bus 95)");
  assert.ok(!("streak" in v.json.routines.find((x) => x.id === r)), "no streak for a child");
  assert.ok(!v.json.routines.find((x) => x.id === r).next.includes("2026-11-19"), "paused days not in the agenda");
  for (const bad of [{ from_date: "2026-11-17", to_date: "2026-11-18" }, { from_date: TODAY, to_date: "2027-02-01" }, { from_date: "2026-11-20", to_date: TODAY }])
    assert.equal((await call("POST", `/people/${P.c}/pauses`, { actor: as(E.c), body: bad })).json.error, "bad_pause", JSON.stringify(bad));
  assert.equal((await call("POST", `/people/${P.c}/pauses`, { actor: as(E.g), body: { from_date: TODAY, to_date: TODAY } })).status, 403);
  assert.equal((await call("PATCH", `/pauses/${pause.json.id}`, { actor: as(E.e), body: { cancel: true } })).status, 403);
  assert.equal((await call("PATCH", `/pauses/${pause.json.id}`, { actor: as(E.p2), body: { cancel: true } })).status, 200);
  v = await call("GET", `/people/${P.c}/routines`, { actor: as(E.c) });
  assert.equal(v.json.routines.find((x) => x.id === r).due_today, true);
});

const ROT = { title: "Take out the bins", rrule: "FREQ=DAILY", dtstart: "2026-11-17" };
test("rotation: the creator must manage every member; turns go round; ticks by the assignee or a guardian", async () => {
  // bus 85: chores in turns are task templates now — no new rotations; a legacy one (straight to the store) still turns, ticks and archives
  assert.equal((await call("POST", "/rotations", { actor: as(E.p1), body: { ...ROT, members: [P.c, P.c2, P.p1] } })).json.error, "use_templates");
  const id = randomUUID(); await store.createRotation({ id, ...ROT, at_time: null, members: [P.c, P.c2, P.p1] }, E.p1); await store.emit("rotation.created", E.p1, null, id);
  const turn = async (who, pid) => (await call("GET", `/people/${pid}/routines`, { actor: as(who) })).json.routines.find((x) => x.id === id);
  assert.equal((await turn(E.c2, P.c2)).due_today, true, "17th → c, 18th → c2");
  assert.equal((await turn(E.c, P.c)).due_today, false);
  assert.deepEqual((await turn(E.p1, P.p1)).next.slice(0, 2), ["2026-11-19", "2026-11-22"]);
  assert.equal((await call("POST", `/rotations/${id}/check`, { actor: as(E.c), body: { date: TODAY, done: true } })).status, 403, "not c's turn today");
  assert.equal((await call("POST", `/rotations/${id}/check`, { actor: as(E.c2), body: { date: TODAY, done: true } })).status, 200);
  assert.equal((await turn(E.c2, P.c2)).done_today, true);
  assert.equal((await call("POST", `/rotations/${id}/check`, { actor: as(E.p2), body: { date: "2026-11-17", done: true } })).status, 200, "a parent ticks yesterday's turn");
  assert.equal((await call("PATCH", `/rotations/${id}`, { actor: as(E.p2), body: { archived: true } })).status, 403, "p2 does not manage p1 → cannot remove");
  assert.equal((await call("PATCH", `/rotations/${id}`, { actor: as(E.p1), body: { archived: true } })).status, 200);
  assert.equal(await turn(E.c2, P.c2), undefined);
});

test("rules: admin only; on/off and dry-run switch; counts only", async () => {
  for (const actor of [as(E.p1), as(E.c), as(E.x)]) {
    assert.equal((await call("GET", "/rules", { actor })).status, 403);
    assert.equal((await call("PATCH", "/rules/council_reminder", { actor, body: { enabled: true } })).status, 403);
  }
  const r = await call("GET", "/rules");
  assert.deepEqual(r.json.rules.map((x) => [x.id, x.enabled, x.dry_run]).sort(), [["board_new_tasks", false, true], ["council_reminder", false, true], ["digest", true, true], ["documents_in_digest", false, true], ["evening_checkin", true, true], ["missed_routine_parent_note", false, true], ["needs_decision", false, true], ["plan_ready", false, true]], "3c rules arrive off + dry-run");
  assert.equal((await call("PATCH", "/rules/council_reminder", { body: { enabled: true, dry_run: false } })).status, 200);
  assert.equal((await call("PATCH", "/rules/nope", { body: { enabled: true } })).status, 404);
  assert.equal((await call("PATCH", "/rules/digest", { body: { enabled: "on" } })).json.error, "bad_rule");
  assert.deepEqual((await call("GET", "/rules")).json.rules.find((x) => x.id === "council_reminder"), { id: "council_reminder", enabled: true, dry_run: false, last7: {} });
});

test("events: every write emits a typed event without titles; a broken bus never fails the write", async () => {
  const ev = store._raw.events;
  const types = new Set(ev.map((e) => e.type));
  for (const t of ["routine.created", "routine.checked", "pause.created", "pause.cancelled", "prefs.updated", "rotation.created", "rotation.checked", "rotation.archived", "rule.updated"]) assert.ok(types.has(t), t);
  assert.ok(ev.every((e) => /^[a-z_]+\.[a-z_]+$/.test(e.type) && !JSON.stringify(e).match(/Brush|bins|QA /)), "no titles or names in events");
  store.failEvents = true;
  try { assert.equal((await call("POST", `/people/${P.c}/pauses`, { actor: as(E.c), body: { from_date: "2026-11-25", to_date: "2026-11-25" } })).status, 201); }
  finally { store.failEvents = false; }
});

test("logs: new routes are classed without ids", () => {
  const id = "00000000-0000-4000-8000-000000000000";
  assert.equal(routeClass(`/people/${id}/prefs`), "/people/:id/prefs");
  assert.equal(routeClass(`/people/${id}/pauses`), "/people/:id/pauses");
  assert.equal(routeClass(`/pauses/${id}`), "/pauses/:id");
  assert.equal(routeClass(`/rotations/${id}/check`), "/rotations/:id/check");
  assert.equal(routeClass(`/rotations/${id}`), "/rotations/:id");
  assert.equal(routeClass("/rules/digest"), "/rules/:id");
});
