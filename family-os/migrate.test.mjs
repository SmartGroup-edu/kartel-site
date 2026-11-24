// Bus 85 (High): one model — routines are personal habits; chores, rotations and council decisions are tasks.
// Synthetic people only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { createApp } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { migrateToTaskModel, ruleMask } from "./migrate.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-migrate-secret-at-least-32-characters!!", KEK = randomBytes(32);
const ADMIN = "admin:admin@example.test", as = (e) => `member:${e}`;
const E = { p: "parent@example.test", c: "child@example.test", c2: "child2@example.test" };
let server, base, store, nowIso = "2026-11-18T10:00:00Z";
const P = {};
async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  return { status: r.status, json: await r.json().catch(() => null) };
}
before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: KEK, clock: () => new Date(nowIso) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p", "adult"], ["c", "child"], ["c2", "child"]]) P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  for (const c of ["c", "c2"]) await call("POST", "/grants", { body: { guardian_id: P.p, child_id: P[c], relation: "parent", scopes: ["routines"] } });
  await call("PATCH", `/people/${P.c2}`, { body: { birth_date: "2019-01-10" } });
});
after(() => server.close());

test("rule → weekday mask; intervals and monthly days are not expressible", () => {
  assert.equal(ruleMask("FREQ=DAILY", "2026-11-16"), "1111111");
  assert.equal(ruleMask("FREQ=WEEKLY;BYDAY=MO,WE", "2026-11-16"), "1010000");
  assert.equal(ruleMask("FREQ=DAILY;INTERVAL=2", "2026-11-16"), null);
  assert.equal(ruleMask("FREQ=MONTHLY;BYMONTHDAY=1", "2026-11-16"), null);
});

test("migration: chores and rotations → DRAFT templates, council tasks → tasks; personal routines untouched; idempotent", async () => {
  // legacy shapes, written straight to the store (the API no longer creates them)
  await store.createRoutine({ id: randomUUID(), person_id: P.c, kind: "routine", title: "QA Brush teeth", rrule: "FREQ=DAILY", dtstart: "2026-11-01", at_time: null }, E.p);
  await store.createRoutine({ id: randomUUID(), person_id: P.c, kind: "chore", title: "QA Water plants", rrule: "FREQ=WEEKLY;BYDAY=SA", dtstart: "2026-11-01", at_time: "10:00" }, E.p);
  await store.createRoutine({ id: randomUUID(), person_id: P.c, kind: "chore", title: "QA Every other day", rrule: "FREQ=DAILY;INTERVAL=2", dtstart: "2026-11-01", at_time: null }, E.p);
  await store.createRotation({ id: randomUUID(), title: "QA Bins", rrule: "FREQ=DAILY", dtstart: "2026-11-01", at_time: "19:00", members: [P.c, P.c2] }, E.p);
  const mid = randomUUID(); await store.saveMeeting({ id: mid, on_date: "2026-11-15", wrapped_key: "x", notes_ct: null, held: true }, E.p);
  const ct = randomUUID(); await store.createTask({ id: ct, meeting_id: mid, title: "QA Buy a gift", owner_id: P.p, due_date: "2026-11-20" }, E.p);
  const out = await migrateToTaskModel(store, KEK);
  assert.deepEqual(out, { chores: 1, rotations: 1, council: 1, skipped: 1 });
  console.log(`# migration counts ${JSON.stringify(out)}`);
  const tpl = [...store._raw.templates.values()];
  assert.equal(tpl.length, 2); assert.ok(tpl.every((t) => t.active === false), "drafts: nothing active until «Утвердить шаблоны»");
  assert.deepEqual(tpl.map((t) => [t.mask, t.assignee_id ?? "members", t.members?.length ?? 0]).sort(), [["0000010", P.c, 0], ["1111111", "members", 2]].sort());
  // "QA " with the space: a sealed value is base64 joined by dots, so it never has a space, while a bare "QA"
  // turns up in ~1.5% of random ciphertexts and made this test flaky (bus 154)
  assert.ok(tpl.every((t) => !String(t.title_ct).includes("QA ")), "titles sealed");
  const left = await store.allRoutines();
  assert.equal(left.filter((r) => r.kind === "routine").length, 1, "the personal routine stays a routine");
  assert.equal(left.filter((r) => r.kind === "chore").length, 1, "the inexpressible one is left as it is (skipped)");
  assert.equal((await store.listRotations()).length, 0, "rotation archived");
  const t = store._raw.btasks.get(ct);
  assert.equal(t.origin, "council"); assert.equal(t.council_date, "2026-11-15"); assert.equal(t.state, "accepted");
  assert.deepEqual(await migrateToTaskModel(store, KEK), { chores: 0, rotations: 0, council: 0, skipped: 1 }, "a rerun changes nothing");
});

test("the API no longer creates chores or rotations — they are templates now", async () => {
  assert.equal((await call("POST", `/people/${P.c}/routines`, { actor: as(E.p), body: { kind: "chore", title: "x", rrule: "FREQ=DAILY" } })).json.error, "use_templates");
  assert.equal((await call("POST", "/rotations", { actor: as(E.p), body: { title: "x", rrule: "FREQ=DAILY", members: [P.c, P.c2] } })).status, 410);
  assert.equal((await call("POST", `/people/${P.c}/routines`, { actor: as(E.p), body: { kind: "routine", title: "QA Read", rrule: "FREQ=DAILY" } })).status, 201, "personal routines as before");
});

test("council decisions are tasks: on the council page, in «Мои задачи» until done, on the board on their day", async () => {
  const id = (await call("POST", "/council/2026-11-22/tasks", { actor: as(E.p), body: { title: "QA Fix the shelf", owner_id: P.c, due_date: "2026-11-25" } })).json.id;
  const t = store._raw.btasks.get(id);
  assert.equal(t.origin, "council"); assert.equal(t.state, "accepted"); assert.equal(t.accountable_id, P.p); assert.equal(t.plan_date, "2026-11-25");
  const council = (await call("GET", "/council?date=2026-11-22", { actor: as(E.c) })).json;
  assert.deepEqual(council.tasks.map((x) => [x.title, x.owner_id, x.due_date, x.done]), [["QA Fix the shelf", P.c, "2026-11-25", false]]);
  const mine = (await call("GET", "/my-tasks", { actor: as(E.c) })).json.mine;
  assert.ok(mine.some((x) => x.id === id && x.origin === "council"), "in «Мои задачи» before its day");
  assert.equal((await call("POST", `/tasks/${id}/done`, { actor: as(E.c2) })).status, 403, "another child cannot tick it");
  assert.equal((await call("POST", `/tasks/${id}/done`, { actor: as(E.c) })).json.state, "done");
  assert.equal((await call("GET", "/council?date=2026-11-22", { actor: as(E.c) })).json.tasks[0].done, true);
  assert.ok(!(await call("GET", "/my-tasks", { actor: as(E.c) })).json.mine.some((x) => x.id === id && x.state !== "done"), "done leaves the open list");
  assert.equal((await call("GET", "/council-tasks", { actor: as(E.c) })).status, 404, "the old council-task list is gone");
});

test("drawer actions: exactly what the viewer may do (parent of a minor: Готово / Пауза / Передать…)", async () => {
  const d = "2026-11-18";
  await call("POST", `/plan/${d}/build`, { actor: as(E.p) });
  const id = (await call("POST", `/plan/${d}/tasks`, { actor: as(E.p), body: { title: "QA Drawer task", assignee_id: P.c2 } })).json.id;
  await call("PUT", `/plan/${d}`, { actor: as(E.p), body: { items: [{ id, include: true }] } });
  await call("POST", `/tasks/${id}/accept`, { actor: as(E.p) }); // c2 is 7
  await call("POST", `/tasks/${id}/start`, { actor: as(E.p) });
  const parent = (await call("GET", `/tasks/${id}`, { actor: as(E.p) })).json.can;
  assert.deepEqual(parent.sort(), ["carry", "done", "pause"].sort(), JSON.stringify(parent)); // Готово · Пауза · На завтра
  const self = (await call("GET", `/tasks/${id}`, { actor: as(E.c2) })).json.can;
  assert.deepEqual(self.sort(), ["continue", "done", "pause"].sort());
  assert.deepEqual((await call("GET", `/tasks/${id}`, { actor: as(E.c) })).json.can, [], "a sibling: nothing");
  assert.equal((await call("POST", `/tasks/${id}/pause`, { actor: as(E.p) })).json.state, "accepted", "Пауза → back to accepted");
  assert.ok((await call("GET", `/tasks/${id}`, { actor: as(E.p) })).json.can.includes("reassign"), "accepted: a parent may hand it over");
});
