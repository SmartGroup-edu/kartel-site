// Family OS Stage 3c — the family board (synthetic people only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { canMove, nextState, needsDecision, nudgeDue, buildPlan, autoApprovable, progress, sprintProgress, maskRule } from "./board.mjs";
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
  assert.equal(canMove("review", c, t("done", "c", { needs_review: true }), c, grants, age), "not_own_review", "never one's own review");
  assert.equal(canMove("review", g, t("done", "c", { needs_review: true }), c, grants, age), "parent_only", "no accountable → a parent");
  assert.equal(canMove("review", g, t("done", "c", { needs_review: true, accountable_id: "p1" }), c, grants, age), "accountable_only", "the accountable person reviews");
  assert.equal(canMove("review", p1, t("done", "c", { needs_review: true, accountable_id: "p1" }), c, grants, age), null);
  // bus 83 §3: adults' tasks are proposals — a parent neither starts nor finishes them; «Не могу» closes them
  const a = { id: "a", kind: "adult" };
  assert.equal(canMove("start", p1, t("accepted", "a"), a, grants, age), "assignee_only");
  assert.equal(canMove("done", p1, t("in_progress", "a"), a, grants, age), "assignee_only");
  assert.equal(nextState("decline", t("approved", "a"), a), "declined_by_adult");
  assert.equal(nextState("decline", t("approved"), c), "declined");
  // bus 83 §4: any participant moves a joint task; a non-participant child does not
  const joint = t("accepted", "c", { co_ids: ["a"] });
  assert.equal(canMove("start", a, joint, c, grants, age), null);
  assert.equal(canMove("start", c2, joint, c, grants, age), "assignee_only");
  assert.equal(canMove("continue", p1, t("in_progress"), c, grants, age), "assignee_only", "the nudge answer is the participant's own");
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
  assert.equal(needsDecision({ state: "approved", plan_date: "2026-11-19" }, { kind: "child" }, "2026-11-19", "12:00"), true, "not accepted by 12:00");
  assert.equal(needsDecision({ state: "approved", plan_date: "2026-11-19" }, { kind: "child" }, "2026-11-19", "11:59"), false);
  assert.equal(needsDecision({ state: "approved", plan_date: "2026-11-19" }, { kind: "adult" }, "2026-11-19", "15:00"), false, "adults: proposals, never a parent decision");
  const st = "2026-11-19T10:00:00Z";
  assert.equal(nudgeDue({ state: "in_progress", estimate_min: 10, started_at: st }, Date.parse(st) + 29 * 60_000), false, "min 30 min");
  assert.equal(nudgeDue({ state: "in_progress", estimate_min: 10, started_at: st }, Date.parse(st) + 31 * 60_000), true);
  assert.equal(nudgeDue({ state: "in_progress", estimate_min: 30, started_at: st, continued_at: "2026-11-19T10:50:00Z" }, Date.parse(st) + 70 * 60_000), false, "«Продолжаю» restarts the clock");
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
  for (const bad of [{ code: "other", text: "x".repeat(141) }, { code: "other" }, { code: "lessons", text: "free text only with other" }, { code: "nope" }, { reason: "old shape" }])
    assert.equal((await call("POST", `/tasks/${call2.id}/decline`, { actor: as(E.c), body: bad })).json.error, "bad_reason", JSON.stringify(bad));
  assert.equal((await call("POST", `/tasks/${call2.id}/decline`, { actor: as(E.c), body: { code: "other", text: "Synthetic: lessons until 19:30" } })).status, 200);
  assert.ok(![...store._raw.btasks.values()].some((t) => String(t.decline_ct ?? "").includes("lessons")), "reason is ciphertext");
  const parentBoard = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json;
  assert.equal(parentBoard.needs_decision[0].decline_reason, "Synthetic: lessons until 19:30"); assert.equal(parentBoard.needs_decision[0].decline_code, "other");
  assert.equal(parentBoard.needs_decision[0].why, "declined");
  const childBoard = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.c2) })).json;
  assert.ok(!JSON.stringify(childBoard).includes("lessons") && !JSON.stringify(childBoard).includes("decline_code") && !("needs_decision" in childBoard), "reason: parents only");
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
  assert.equal((await call("POST", `/tasks/${table.id}/review`, { actor: as(E.c) })).json.reason, "not_own_review");
  // p2 approved the plan → p2 is accountable and reviews; p1 (the other parent) does not
  assert.equal(store._raw.btasks.get(table.id).accountable_id, P.p2);
  assert.equal((await call("POST", `/tasks/${table.id}/review`, { actor: as(E.p1) })).json.reason, "accountable_only");
  assert.equal((await call("POST", `/tasks/${table.id}/rework`, { actor: as(E.p2), body: { note: "Synthetic: forks too" } })).json.state, "in_progress");
  assert.equal((await mine(E.c)).mine.find((t) => t.id === table.id).rework_note, "Synthetic: forks too", "the assignee sees the note");
  assert.ok(!JSON.stringify((await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json).includes("forks"), "the note: the assignee only (bus 83 §8)");
  await call("POST", `/tasks/${table.id}/done`, { actor: as(E.c) });
  assert.equal((await call("POST", `/tasks/${table.id}/review`, { actor: as(E.p2) })).json.state, "reviewed");
  assert.equal((await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.c2) })).json.tasks.find((t) => t.id === table.id).reviewed_by, P.p2, "«Проверено · <родитель>»");
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

test("drawer: facts + history for any member — who and when, never an email", async () => {
  const table = [...store._raw.btasks.values()].find((t) => t.plan_date === TOMORROW && t.state === "reviewed");
  const r = await call("GET", `/tasks/${table.id}`, { actor: as(E.c2) });
  assert.equal(r.status, 200);
  const steps = r.json.history.map((h) => [h.step, h.by]);
  assert.deepEqual(steps.filter(([s]) => ["approved", "accepted", "started", "done", "reviewed"].includes(s)).slice(0, 3), [["approved", P.p2], ["accepted", P.c], ["started", P.c]]);
  assert.ok(steps.some(([s, by]) => s === "reviewed" && by === P.p2));
  assert.ok(!/@/.test(JSON.stringify(r.json)), "no emails in the drawer");
  assert.equal((await call("GET", `/tasks/${table.id}`, { actor: as(E.x) })).status, 403);
});

test("adults: tasks are proposals — «Не могу» closes them, no parent decision; parents never start or finish them", async () => {
  const a1 = (await call("POST", `/plan/${TOMORROW}/tasks`, { actor: as(E.p1), body: { title: "Adult proposal one", assignee_id: P.e } })).json.id;
  const a2 = (await call("POST", `/plan/${TOMORROW}/tasks`, { actor: as(E.p1), body: { title: "Adult proposal two", assignee_id: P.e } })).json.id;
  assert.equal((await call("POST", `/tasks/${a1}/decline`, { actor: as(E.e), body: { code: "away" } })).json.state, "declined_by_adult");
  const b = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json;
  assert.ok(!b.needs_decision.some((t) => t.id === a1) && !b.tasks.some((t) => t.id === a1), "closed: not on the board, not a decision");
  await call("POST", `/tasks/${a2}/accept`, { actor: as(E.e) });
  assert.equal((await call("POST", `/tasks/${a2}/start`, { actor: as(E.p1) })).json.reason, "assignee_only");
  assert.equal((await call("POST", `/tasks/${a2}/done`, { actor: as(E.p1) })).json.reason, "assignee_only");
});

test("12:00: a child's task still not accepted → «Нужно решение»; adults' never", async () => {
  const k = (await call("POST", `/plan/${TOMORROW}/tasks`, { actor: as(E.p1), body: { title: "Late one", assignee_id: P.c } })).json.id;
  const e2 = (await call("POST", `/plan/${TOMORROW}/tasks`, { actor: as(E.p1), body: { title: "Adult late", assignee_id: P.e } })).json.id;
  nowIso = `${TOMORROW}T11:59:00Z`;
  assert.ok(!(await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json.needs_decision.some((t) => t.id === k));
  nowIso = `${TOMORROW}T12:01:00Z`;
  const nd = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json.needs_decision;
  assert.equal(nd.find((t) => t.id === k)?.why, "not_accepted"); assert.ok(!nd.some((t) => t.id === e2));
  assert.equal((await call("POST", `/tasks/${k}/cancel`, { actor: as(E.p1) })).json.state, "cancelled", "«Снять»");
  await call("POST", `/tasks/${e2}/decline`, { actor: as(E.e), body: { code: "unwell" } });
  nowIso = `${TOMORROW}T10:00:00Z`;
});

test("joint task: in each participant's lane, counted once; any participant starts it; one in progress across tasks", async () => {
  const before = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json;
  assert.equal((await call("POST", `/plan/${TOMORROW}/tasks`, { actor: as(E.p1), body: { title: "x", assignee_id: P.c2, co_ids: [P.c2] } })).json.error, "bad_task", "assignee is not also a co-participant");
  const j = (await call("POST", `/plan/${TOMORROW}/tasks`, { actor: as(E.p1), body: { title: "Read together", assignee_id: P.c2, co_ids: [P.e], when_slot: "evening", estimate_min: 15 } })).json.id;
  const b = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.p1) })).json;
  assert.equal(b.progress.total, before.progress.total + 1, "counted once in the family totals");
  const lane = (id) => b.members.find((m) => m.id === id);
  assert.equal(lane(P.c2).total, before.members.find((m) => m.id === P.c2).total + 1);
  assert.equal(lane(P.e).total, before.members.find((m) => m.id === P.e).total + 1, "and once in each participant's lane");
  assert.equal((await call("POST", `/tasks/${j}/accept`, { actor: as(E.e) })).json.state, "accepted", "any participant accepts");
  assert.equal((await call("POST", `/tasks/${j}/start`, { actor: as(E.c) })).json.reason, "assignee_only", "a non-participant child cannot");
  const rota = { id: (await call("POST", `/plan/${TOMORROW}/tasks`, { actor: as(E.p1), body: { title: "Busy one", assignee_id: P.c2 } })).json.id };
  await call("POST", `/tasks/${rota.id}/accept`, { actor: as(E.p2) }); // c2 is 7: a parent accepts on the child's behalf
  assert.equal((await call("POST", `/tasks/${rota.id}/start`, { actor: as(E.p2) })).json.state, "in_progress", "a parent starts for the minor");
  const busy = await call("POST", `/tasks/${j}/start`, { actor: as(E.e) });
  assert.equal(busy.status, 409); assert.equal(busy.json.error, "participant_busy", "another participant's running task is never paused by someone else");
  await call("POST", `/tasks/${rota.id}/done`, { actor: as(E.c2) });
  assert.equal((await call("POST", `/tasks/${j}/start`, { actor: as(E.e) })).json.state, "in_progress");
  const a2 = [...store._raw.btasks.values()].find((t) => t.plan_date === TOMORROW && t.assignee_id === P.e && t.state === "accepted");
  assert.equal((await call("POST", `/tasks/${a2.id}/start`, { actor: as(E.e) })).json.error, "one_in_progress", "the joint task counts as e's one in progress");
  const strip = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(E.c) })).json.members;
  assert.equal(strip.find((m) => m.id === P.c2).current.id, j); assert.equal(strip.find((m) => m.id === P.e).current.id, j);
});

test("«Ещё в работе?» — only the participants, only past 2× the estimate; never on the board or to parents", async () => {
  const j = [...store._raw.btasks.values()].find((t) => t.plan_date === TOMORROW && t.state === "in_progress" && t.co_ids?.length);
  j.started_at = `${TOMORROW}T10:00:00.000Z`; // the memory twin stamps with the wall clock; pin it to the test clock
  const started = Date.parse(j.started_at);
  nowIso = new Date(started + 29 * 60_000).toISOString();
  assert.ok(!(await call("GET", "/my-tasks", { actor: as(E.e) })).json.mine.find((t) => t.id === j.id).nudge, "not before 30 min");
  nowIso = new Date(started + 31 * 60_000).toISOString();
  assert.equal((await call("GET", "/my-tasks", { actor: as(E.e) })).json.mine.find((t) => t.id === j.id).nudge, true);
  for (const who of [E.p1, E.p2, E.c]) {
    assert.ok(!JSON.stringify((await call("GET", `/board?date=${TOMORROW}`, { actor: as(who) })).json).includes("nudge"), `${who}: no nudge on the board`);
    assert.ok(!JSON.stringify((await call("GET", "/my-tasks", { actor: as(who) })).json).includes("nudge"), `${who}: not a participant → no nudge`);
  }
  assert.equal((await call("POST", `/tasks/${j.id}/continue`, { actor: as(E.p1) })).json.reason, "assignee_only");
  assert.equal((await call("POST", `/tasks/${j.id}/continue`, { actor: as(E.c2) })).json.state, "in_progress");
  assert.ok(!(await call("GET", "/my-tasks", { actor: as(E.e) })).json.mine.find((t) => t.id === j.id).nudge, "«Продолжаю» restarts the clock");
  assert.equal(store._raw.btasks.get(j.id).started_at, j.started_at, "started_at untouched");
  nowIso = `${TOMORROW}T10:00:00Z`;
});

test("routine count line: the child and routines guardians only — never siblings or other adults; never routine cards", async () => {
  const views = {};
  for (const [k, who] of Object.entries({ c: E.c, p1: E.p1, g: E.g, c2: E.c2, e: E.e })) views[k] = (await call("GET", `/board?date=${TOMORROW}`, { actor: as(who) })).json;
  const line = (b) => b.members.find((m) => m.id === P.c).routines;
  assert.deepEqual(line(views.c), { done: 0, total: 1 }, "the child sees their own count");
  assert.deepEqual(line(views.p1), { done: 0, total: 1 }); assert.ok(line(views.g), "a relative holding routines");
  assert.equal(line(views.c2), undefined, "a sibling never"); assert.equal(line(views.e), undefined, "an adult without the scope never");
  assert.ok(views.c2.members.filter((m) => m.id !== P.c2).every((m) => !("routines" in m)), "no one else's line in the sibling's response at all");
  for (const b of Object.values(views)) assert.ok(!/ROUTINE/.test(JSON.stringify(b)), "never a routine card");
  assert.ok(store._raw.log.some((l) => l.entity === "routines:summary" && l.subject === P.c), "a guardian's read is access-logged");
});

test("approval: the first approval wins; the stamp on the board; «Изменить» after approval is logged per affected person", async () => {
  const d = "2026-11-21";
  await call("POST", `/plan/${d}/build`, { actor: as(E.p1) });
  const plan = (await call("GET", `/plan?date=${d}`, { actor: as(E.p1) })).json;
  const items = plan.tasks.map((t) => ({ id: t.id, include: true }));
  assert.deepEqual((await call("PUT", `/plan/${d}`, { actor: as(E.p1), body: { items } })).json.approved, items.length);
  const second = await call("PUT", `/plan/${d}`, { actor: as(E.p2), body: { items } });
  assert.equal(second.status, 409); assert.equal(second.json.error, "already_approved"); assert.equal(second.json.approval.by, P.p1);
  assert.equal((await call("GET", `/board?date=${d}`, { actor: as(E.c) })).json.approval.by, P.p1, "«План утвердила <имя> в HH:MM»");
  assert.equal((await call("GET", `/board?date=2026-11-20`, { actor: as(E.c) })).json.approval.auto, true, "«Утверждён автоматически»");
  const after = (await call("GET", `/plan?date=${d}`, { actor: as(E.p2) })).json;
  assert.ok(after.approval && after.tasks.every((t) => t.state === "approved"), "the second parent sees the approved list");
  const t = after.tasks[0], to = t.assignee_id === P.c ? P.c2 : P.c;
  const before = store._raw.events.length;
  assert.equal((await call("PATCH", `/plan/${d}/tasks/${t.id}`, { actor: as(E.p2), body: { assignee_id: to } })).json.state, "approved");
  const edited = store._raw.events.slice(before).filter((e) => e.type === "task.edited").map((e) => e.subject_person_id).sort();
  assert.deepEqual(edited, [t.assignee_id, to].sort(), "only the affected people");
  assert.equal((await call("PATCH", `/plan/${d}/tasks/${t.id}`, { actor: as(E.c), body: { include: false } })).status, 403);
});

test("logs: board routes classed without ids", () => {
  const id = "00000000-0000-4000-8000-000000000000";
  assert.equal(routeClass(`/tasks/${id}/accept`), "/tasks/:id/accept");
  assert.equal(routeClass(`/plan/${TODAY}/build`), "/plan/:date/build");
  assert.equal(routeClass(`/plan/${TODAY}`), "/plan/:date");
  assert.equal(routeClass(`/sprint/goals/${id}/tasks`), "/sprint/goals/:id/tasks");
  assert.equal(routeClass(`/templates/${id}`), "/templates/:id");
  assert.equal(routeClass(`/tasks/${id}`), "/tasks/:id");
  assert.equal(routeClass(`/plan/${TODAY}/tasks/${id}`), "/plan/:date/tasks/:id");
});
