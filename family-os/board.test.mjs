// Family OS Stage 3c — the family board (synthetic people only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { canMove, buildPlan, autoApprovable, progress, sprintProgress, maskRule } from "./board.mjs";
import { autoApproveDay } from "./board-jobs.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-board-secret-at-least-32-characters!!";
const TODAY = "2026-11-18", TOMORROW = "2026-11-19"; // Wednesday
let server, base, store, nowIso = `${TODAY}T10:00:00Z`;
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
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date(nowIso) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["p2", "adult"], ["c", "child"], ["c2", "child"], ["e", "adult"], ["g", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  for (const k of ["p1", "p2"]) for (const c of ["c", "c2"]) await call("POST", "/grants", { body: { guardian_id: P[k], child_id: P[c], relation: "parent", scopes: ["routines", "health"] } });
  await call("POST", "/grants", { body: { guardian_id: P.g, child_id: P.c, relation: "relative", scopes: ["routines"] } });
  await call("PATCH", `/people/${P.c}`, { body: { birth_date: "2015-03-04" } });
  await call("PATCH", `/people/${P.c2}`, { body: { birth_date: "2019-01-10" } }); // 7: under the self-accept age
});
after(() => server.close());

test("pure: state machine permissions", () => {
  const p1 = { id: "p1", kind: "adult" }, c = { id: "c", kind: "child" }, c2 = { id: "c2", kind: "child" }, g = { id: "g", kind: "adult" };
  const grants = [{ guardian_id: "p1", child_id: "c", relation: "parent", revoked_at: null }, { guardian_id: "p1", child_id: "c2", relation: "parent", revoked_at: null }, { guardian_id: "g", child_id: "c", relation: "relative", revoked_at: null }];
  const t = (state, assignee = "c", extra = {}) => ({ state, assignee_id: assignee, ...extra });
  const age = (p) => (p.id === "c2" ? 7 : 11);
  assert.equal(canMove("accept", c, t("approved"), c, grants, age), null);
  assert.equal(canMove("accept", c2, t("approved"), c, grants, age), "assignee_only", "a child cannot accept another child's task");
  assert.equal(canMove("start", c2, t("accepted"), c, grants, age), "assignee_only");
  assert.equal(canMove("done", c2, t("in_progress"), c, grants, age), "assignee_only");
  assert.equal(canMove("accept", p1, t("approved"), c, grants, age), "assignee_only", "an 11-year-old accepts for themselves");
  assert.equal(canMove("accept", p1, t("approved", "c2"), c2, grants, age), null, "under 9: a parent may accept on the child's behalf");
  assert.equal(canMove("start", p1, t("accepted"), c, grants, age), null, "a parent starts/finishes for a minor");
  assert.equal(canMove("start", g, t("accepted"), c, grants, age), "assignee_only", "a relative is not a parent");
  assert.equal(canMove("review", c, t("done", "c", { needs_review: true }), c, grants, age), "parent_only");
  assert.equal(canMove("review", p1, t("done", "c", { needs_review: false }), c, grants, age), "bad_state");
  assert.equal(canMove("accept", c, t("proposed"), c, grants, age), "bad_state", "nothing before approval");
  assert.equal(canMove("carry", g, t("accepted"), c, grants, age), "parent_only");
});

test("pure: plan from templates + rotation; auto-approval = template set only; progress; sprint totals", () => {
  const templates = [
    { id: "t1", active: true, mask: "1111100", dtstart: "2026-11-16", assignee_id: "c", title: "Set the table", due_time: "18:20" },
    { id: "t2", active: true, mask: "1111111", dtstart: "2026-11-16", members: ["c", "c2"], title: "Clear the table" },
    { id: "t3", active: false, mask: "1111111", dtstart: "2026-11-16", assignee_id: "c", title: "Draft" },
    { id: "t4", active: true, mask: "0000011", dtstart: "2026-11-16", assignee_id: "c", title: "Weekend only" },
  ];
  const plan = buildPlan("2026-11-19", { templates, carried: [{ id: "old", title: "Water", kind: "chore", assignee_id: "c2" }] });
  assert.deepEqual(plan.map((p) => [p.title, p.origin, p.assignee_id]), [["Set the table", "template", "c"], ["Clear the table", "rotation", "c2"], ["Water", "carry", "c2"]], "drafts and other weekdays are out; rotation: 4th occurrence (index 3) → second member");
  assert.equal(maskRule("1000001"), "FREQ=WEEKLY;BYDAY=MO,SU");
  const tasks = [{ state: "proposed", origin: "template" }, { state: "proposed", origin: "rotation" }, { state: "proposed", origin: "adhoc" }, { state: "proposed", origin: "carry" }, { state: "approved", origin: "template" }];
  assert.deepEqual(autoApprovable(tasks).map((t) => t.origin), ["template", "rotation"]);
  assert.deepEqual(progress([{ state: "done" }, { state: "reviewed" }, { state: "in_progress" }, { state: "accepted" }, { state: "approved" }, { state: "declined" }, { state: "cancelled" }]), { done: 2, in_progress: 1, accepted: 1, waiting: 2, total: 6 });
  assert.deepEqual(sprintProgress([{ id: "g", title: "Hall" }], [{ sprint_goal_id: "g", state: "done" }, { sprint_goal_id: "g", state: "accepted" }, { sprint_goal_id: "g", state: "cancelled" }]), [{ id: "g", title: "Hall", done: 1, total: 2 }]);
});

const T = {};
test("templates: parents only; drafts stay out of the plan until «Утвердить шаблоны»", async () => {
  assert.equal((await call("POST", "/templates", { actor: as(E.c), body: { title: "x", mask: "1111111", assignee_id: P.c } })).status, 403);
  assert.equal((await call("POST", "/templates", { actor: as(E.g), body: { title: "x", mask: "1111111", assignee_id: P.c } })).status, 403, "a relative is not a parent");
  T.daily = (await call("POST", "/templates", { actor: as(E.p1), body: { title: "Set the table", mask: "1111111", assignee_id: P.c, due_time: "18:20", needs_review: true } })).json.id;
  T.rot = (await call("POST", "/templates", { actor: as(E.p2), body: { title: "Clear the table", mask: "1111111", members: [P.c, P.c2] } })).json.id;
  T.draft = (await call("POST", "/templates", { actor: as(E.p1), body: { title: "Imported draft", mask: "1111111", assignee_id: P.c2, active: false } })).json.id;
  assert.equal((await call("POST", "/templates", { actor: as(E.p1), body: { title: "x", mask: "0000000", assignee_id: P.c } })).json.error, "bad_template");
  const b = await call("POST", `/plan/${TOMORROW}/build`, { actor: as(E.p1) });
  assert.equal(b.json.created, 2, "the draft is not built");
  assert.equal((await call("POST", `/plan/${TOMORROW}/build`, { actor: as(E.p2) })).json.created, 0, "building twice is harmless");
  assert.equal((await call("POST", "/templates/activate", { actor: as(E.p1), body: { ids: [T.draft] } })).json.activated, 1);
  assert.equal((await call("POST", `/plan/${TOMORROW}/build`, { actor: as(E.p1) })).json.created, 1, "after «Утвердить шаблоны» the draft joins");
  assert.ok([...store._raw.templates.values()].every((t) => !String(t.title_ct).includes("table")), "template titles are ciphertext");
});

test("plan: parents only; edit-per-row approve; exclude → cancelled; ad-hoc after approval goes straight in", async () => {
  assert.equal((await call("GET", `/plan?date=${TOMORROW}`, { actor: as(E.c) })).status, 403);
  assert.equal((await call("GET", `/plan?date=${TOMORROW}`, { actor: as(E.e) })).status, 403, "an adult without children is not a parent");
  const plan = (await call("GET", `/plan?date=${TOMORROW}`, { actor: as(E.p1) })).json;
  assert.equal(plan.tasks.length, 3); assert.equal(plan.approval, null);
  const draft = plan.tasks.find((t) => t.title === "Imported draft"), table = plan.tasks.find((t) => t.title === "Set the table"), clear = plan.tasks.find((t) => t.title === "Clear the table");
  assert.equal((await call("PUT", `/plan/${TOMORROW}`, { actor: as(E.c), body: { items: [] } })).status, 403, "a child cannot approve");
  const r = await call("PUT", `/plan/${TOMORROW}`, { actor: as(E.p2), body: { items: [{ id: table.id, include: true, due_time: "18:30" }, { id: clear.id, include: true, assignee_id: P.c2 }, { id: draft.id, include: false }] } });
  assert.deepEqual(r.json, { approved: 2, skipped: 1 });
  const add = await call("POST", `/plan/${TOMORROW}/tasks`, { actor: as(E.p1), body: { title: "Call grandma", assignee_id: P.c, due_time: "17:00" } });
  assert.equal(add.json.state, "approved", "the plan is approved → straight in");
  const day = [...store._raw.btasks.values()].filter((t) => t.plan_date === TOMORROW);
  assert.equal(day.find((t) => t.id === table.id).due_time, "18:30"); assert.equal(day.find((t) => t.id === clear.id).assignee_id, P.c2);
  assert.equal(day.find((t) => t.id === draft.id).state, "cancelled");
  assert.equal(store._raw.approvals.get(TOMORROW).auto, false);
});

test("07:00 auto-approval: exactly the template set, never ad-hoc; not when a parent already approved", async () => {
  const d = "2026-11-20";
  await call("POST", `/plan/${d}/build`, { actor: as(E.p1) });
  await call("POST", `/plan/${d}/tasks`, { actor: as(E.p1), body: { title: "Ad hoc", assignee_id: P.c } });
  const r = await autoApproveDay(store, d);
  assert.equal(r.approved, 3, "template + rotation + activated draft");
  const day = [...store._raw.btasks.values()].filter((t) => t.plan_date === d);
  assert.equal(day.find((t) => t.origin === "adhoc").state, "proposed", "ad-hoc waits for a parent");
  assert.ok(day.filter((t) => t.state === "approved").every((t) => t.approved_by === "auto"));
  assert.equal(store._raw.approvals.get(d).auto, true);
  assert.equal((await autoApproveDay(store, TOMORROW)).skipped, "already_approved");
});

test("accept / decline / start / done / review — owner moves; one in progress; reasons for parents only", async () => {
  nowIso = `${TOMORROW}T10:00:00Z`;
  const mine = async (who) => (await call("GET", "/my-tasks", { actor: as(who) })).json;
  const cNew = (await mine(E.c)).new;
  assert.deepEqual(cNew.map((t) => t.title).sort(), ["Call grandma", "Set the table"]);
  const table = cNew.find((t) => t.title === "Set the table"), call2 = cNew.find((t) => t.title === "Call grandma");
  assert.equal((await call("POST", `/tasks/${table.id}/accept`, { actor: as(E.c2) })).json.reason, "assignee_only", "another child cannot accept");
  assert.equal((await call("POST", `/tasks/${table.id}/accept`, { actor: as(E.c) })).status, 200);
  assert.equal((await call("POST", `/tasks/${call2.id}/decline`, { actor: as(E.c), body: { reason: "x".repeat(141) } })).json.error, "bad_reason");
  assert.equal((await call("POST", `/tasks/${call2.id}/decline`, { actor: as(E.c), body: { reason: "Synthetic: lessons until 19:30" } })).status, 200);
  assert.ok(![...store._raw.btasks.values()].some((t) => String(t.decline_ct ?? "").includes("lessons")), "reason is ciphertext");
  const parentBoard = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json;
  assert.equal(parentBoard.needs_decision[0].decline_reason, "Synthetic: lessons until 19:30");
  const childBoard = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.c2) })).json;
  assert.ok(!JSON.stringify(childBoard).includes("lessons") && !("needs_decision" in childBoard), "reason: parents only");
  // c2 (7) — a parent accepts on its behalf; the clear-table rotation task
  const c2task = (await mine(E.c2)).new[0];
  assert.equal((await call("POST", `/tasks/${c2task.id}/accept`, { actor: as(E.p2) })).status, 200, "under 9: parent accepts on behalf");
  // start: one in progress per person
  assert.equal((await call("POST", `/tasks/${table.id}/start`, { actor: as(E.c2) })).status, 403);
  assert.equal((await call("POST", `/tasks/${table.id}/start`, { actor: as(E.c) })).status, 200);
  await call("POST", `/tasks/${call2.id}/reassign`, { actor: as(E.p1), body: { assignee_id: P.c } });
  await call("POST", `/tasks/${call2.id}/accept`, { actor: as(E.c) });
  const second = await call("POST", `/tasks/${call2.id}/start`, { actor: as(E.c) });
  assert.equal(second.status, 409); assert.equal(second.json.error, "one_in_progress"); assert.equal(second.json.title, "Set the table");
  assert.equal((await call("POST", `/tasks/${call2.id}/start`, { actor: as(E.c), body: { pause_other: true } })).status, 200);
  assert.equal(store._raw.btasks.get(table.id).state, "accepted", "the first one paused back to accepted");
  // done + review (needs_review): parent «Ещё немного» → in progress with a note; then «Проверено»
  await call("POST", `/tasks/${call2.id}/done`, { actor: as(E.c) });
  await call("POST", `/tasks/${table.id}/start`, { actor: as(E.c) });
  assert.equal((await call("POST", `/tasks/${table.id}/done`, { actor: as(E.c) })).json.state, "done");
  assert.equal((await call("POST", `/tasks/${table.id}/review`, { actor: as(E.c) })).json.reason, "parent_only");
  assert.equal((await call("POST", `/tasks/${table.id}/rework`, { actor: as(E.p2), body: { note: "Synthetic: forks too" } })).json.state, "in_progress");
  assert.equal((await mine(E.c)).mine.find((t) => t.id === table.id).rework_note, "Synthetic: forks too", "the assignee sees the note");
  await call("POST", `/tasks/${table.id}/done`, { actor: as(E.c) });
  assert.equal((await call("POST", `/tasks/${table.id}/review`, { actor: as(E.p1) })).json.state, "reviewed");
  assert.ok(store._raw.btasks.get(table.id).started_at && store._raw.btasks.get(table.id).reviewed_at, "every transition is timestamped");
});

test("board: every member sees family tasks; never routines, goals or notes; who-is-doing-what; progress", async () => {
  await call("POST", `/people/${P.c}/routines`, { actor: as(E.p1), body: { kind: "routine", title: "Brush teeth ROUTINE", rrule: "FREQ=DAILY", dtstart: "2026-11-01" } });
  await call("POST", `/people/${P.c}/goals`, { actor: as(E.c), body: { title: "Secret GOAL", sphere: "joy", visibility: "family" } });
  await call("POST", `/people/${P.c}/notes`, { actor: as(E.p1), body: { kind: "health", title: "HEALTH note", body: "x" } });
  for (const who of [E.p1, E.c, E.c2, E.e, E.g]) {
    const b = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(who) })).json;
    const s = JSON.stringify(b);
    assert.ok(s.includes("Set the table") && !/ROUTINE|GOAL|HEALTH/.test(s), `${who}: family tasks only`);
  }
  const b = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json;
  assert.deepEqual(b.progress, { done: 2, in_progress: 0, accepted: 1, waiting: 0, total: 3 });
  assert.equal(b.can.approve, true); assert.equal((await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.c) })).json.can.approve, false);
  assert.equal((await call("GET", "/board", { actor: as(E.x) })).status, 403);
  assert.ok(store._raw.events.filter((e) => e.type.startsWith("task.")).every((e) => !/table|grandma/i.test(JSON.stringify(e))), "events carry no titles");
});

test("21:00 carry-over (parents): open tasks offered; carried → a proposed copy tomorrow", async () => {
  nowIso = `${TOMORROW}T21:05:00Z`;
  const b = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json;
  assert.equal(b.carry_offer.length, 1, "the one open task");
  assert.equal((await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.c) })).json.carry_offer, undefined, "children never see it");
  const id = b.carry_offer[0].id;
  assert.equal((await call("POST", `/tasks/${id}/carry`, { actor: as(E.c) })).status, 403);
  assert.equal((await call("POST", `/tasks/${id}/carry`, { actor: as(E.p1) })).json.state, "carried_over");
  const copy = [...store._raw.btasks.values()].find((t) => t.carried_from === id);
  assert.equal(copy.plan_date, "2026-11-20"); assert.equal(copy.state, "proposed"); assert.equal(copy.origin, "carry");
  nowIso = `${TOMORROW}T10:00:00Z`;
});

test("sprint: adults set 1–3 goals; tasks join the plan; progress in family totals", async () => {
  assert.equal((await call("POST", "/sprint/goals", { actor: as(E.c), body: { title: "x" } })).status, 403);
  const g = (await call("POST", "/sprint/goals", { actor: as(E.p1), body: { title: "Tidy hall" } })).json;
  await call("POST", "/sprint/goals", { actor: as(E.p1), body: { title: "Gift list" } });
  await call("POST", "/sprint/goals", { actor: as(E.p2), body: { title: "Read daily" } });
  assert.equal((await call("POST", "/sprint/goals", { actor: as(E.p2), body: { title: "Fourth" } })).json.error, "three_goals_max");
  assert.equal((await call("POST", `/sprint/goals/${g.id}/tasks`, { actor: as(E.p1), body: { title: "Hooks", assignee_id: P.p1, plan_date: "2026-11-21" } })).status, 201);
  assert.equal((await call("POST", `/sprint/goals/${g.id}/tasks`, { actor: as(E.p1), body: { title: "x", assignee_id: P.p1, plan_date: "2026-11-30" } })).json.error, "bad_task", "inside the sprint week only");
  const s = (await call("GET", "/sprint", { actor: as(E.c) })).json;
  assert.deepEqual(s.goals.find((x) => x.title === "Tidy hall"), { id: g.id, title: "Tidy hall", done: 0, total: 1 });
  assert.ok(!JSON.stringify(s).match(/assignee|QA /), "family totals only — no names");
});

test("logs: board routes classed without ids", () => {
  const id = "00000000-0000-4000-8000-000000000000";
  assert.equal(routeClass(`/tasks/${id}/accept`), "/tasks/:id/accept");
  assert.equal(routeClass(`/plan/${TODAY}/build`), "/plan/:date/build");
  assert.equal(routeClass(`/plan/${TODAY}`), "/plan/:date");
  assert.equal(routeClass(`/sprint/goals/${id}/tasks`), "/sprint/goals/:id/tasks");
  assert.equal(routeClass(`/templates/${id}`), "/templates/:id");
});
