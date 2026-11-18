// Family OS Stage 3d-1 — Кодекс, принцип недели, признание, бережный счёт, якорь, WOOP (bus 86; synthetic people only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { KODEKS_V1, KODEKS_V1_APPROVED_ON, validKodeks, mondayOf, principleOfWeek, weekCount, countModeFor, canSeeRecognition, cleanWoop, cleanAnchor } from "./kodeks.mjs";
import { parseRule } from "./recur.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-stage3d-secret-at-least-32-chars!!!";
const TODAY = "2026-11-18"; // Wednesday; week 2026-11-16 … 2026-11-22
let server, base, store;
const ADMIN = "admin:admin@example.test", as = (k) => `member:${E[k]}`;
const E = { p1: "parent1@example.test", p2: "parent2@example.test", c: "child@example.test", c2: "child2@example.test", e: "adult@example.test", g: "relative@example.test" };
const P = {};
async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* none */ }
  return { status: r.status, json, text: txt };
}
before(async () => {
  store = memoryStore();
  await store.addKodeksVersion({ version: 1, body: KODEKS_V1, status: "approved", approved_on: KODEKS_V1_APPROVED_ON }, "system:r0-2026-11-18");
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date(`${TODAY}T10:00:00Z`) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["p2", "adult"], ["c", "child"], ["c2", "child"], ["e", "adult"], ["g", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  for (const k of ["p1", "p2"]) for (const c of ["c", "c2"]) await call("POST", "/grants", { body: { guardian_id: P[k], child_id: P[c], relation: "parent", scopes: ["routines"] } });
  await call("POST", "/grants", { body: { guardian_id: P.g, child_id: P.c, relation: "relative", scopes: ["routines"] } });
});
after(() => server.close());

test("pure: the seeded Кодекс is the plan §3 text — 8 principles on 8 crest elements, valid", () => {
  assert.equal(KODEKS_V1.principles.length, 8);
  assert.deepEqual(KODEKS_V1.principles.map((p) => p.element), ["griffin", "staff", "keys", "wings", "mantling", "coronet", "fleurdelis", "swords"]);
  assert.equal(KODEKS_V1.principles[0].principle, "Береги своих. Сильный защищает, а не обижает");
  assert.ok(KODEKS_V1.motto.startsWith("Virtus et Potestas"));
  assert.equal(validKodeks(KODEKS_V1), true);
  assert.equal(validKodeks({ ...KODEKS_V1, principles: KODEKS_V1.principles.slice(0, 7) }), false);
  assert.equal(validKodeks({ ...KODEKS_V1, principles: [...KODEKS_V1.principles].reverse() }), false, "elements keep their order");
});

test("pure: principle of the week — round-robin from 16.11.2026, a parent's pick wins", () => {
  assert.equal(mondayOf("2026-11-18"), "2026-11-16"); assert.equal(mondayOf("2026-11-22"), "2026-11-16"); assert.equal(mondayOf("2026-11-23"), "2026-11-23");
  assert.deepEqual(principleOfWeek("2026-11-16", null), { index: 0, picked: false });
  assert.deepEqual(principleOfWeek("2026-11-23", null), { index: 1, picked: false });
  assert.deepEqual(principleOfWeek("2027-01-11", null), { index: 0, picked: false }, "8 weeks later it wraps");
  assert.deepEqual(principleOfWeek("2026-11-09", null), { index: 7, picked: false }, "before the start it still wraps");
  assert.deepEqual(principleOfWeek("2026-11-16", 5), { index: 5, picked: true });
});

test("pure: weekly count «N из M» — only this week, paused days out, a missed day is just not counted", () => {
  const daily = parseRule("FREQ=DAILY"), wk = parseRule("FREQ=WEEKLY;BYDAY=MO,WE,FR");
  assert.deepEqual(weekCount(daily, "2026-11-01", new Set(["2026-11-16", "2026-11-18", "2026-11-09"]), TODAY), { done: 2, of: 7 });
  assert.deepEqual(weekCount(wk, "2026-11-01", new Set(["2026-11-16"]), TODAY), { done: 1, of: 3 });
  assert.deepEqual(weekCount(daily, "2026-11-01", new Set(), TODAY, (d) => d === "2026-11-20"), { done: 0, of: 6 });
  assert.deepEqual(weekCount(daily, "2026-11-19", new Set(), TODAY), { done: 0, of: 4 }, "starts Thursday");
  assert.equal(countModeFor({ kind: "child" }, "streak"), "week", "a child never gets the streak");
  assert.equal(countModeFor({ kind: "adult" }, undefined), "week");
  assert.equal(countModeFor({ kind: "adult" }, "streak"), "streak");
});

test("pure: recognition visibility, WOOP and anchor cleaning", () => {
  const grants = [{ guardian_id: "p1", child_id: "c", relation: "parent", revoked_at: null }, { guardian_id: "g", child_id: "c", relation: "relative", revoked_at: null }];
  const r = { from_id: "c2", to_id: "c" };
  for (const [id, want] of [["c2", true], ["c", true], ["p1", true], ["g", false], ["e", false]]) assert.equal(canSeeRecognition({ id }, r, grants), want, id);
  assert.equal(canSeeRecognition(null, r, grants), false);
  assert.deepEqual(cleanWoop({ wish: " W ", plan: "" }), { wish: "W" });
  assert.equal(cleanWoop({}), null); assert.equal(cleanWoop(null), null);
  assert.equal(cleanWoop({ wish: "x".repeat(301) }), undefined); assert.equal(cleanWoop("x"), undefined);
  assert.deepEqual(cleanAnchor({ anchor_text: "После завтрака" }, [], "a"), { anchor_text: "После завтрака", anchor_routine_id: null });
  assert.equal(cleanAnchor({ anchor_text: "x".repeat(61) }, [], "a").error, "bad_anchor");
  assert.equal(cleanAnchor({ anchor_routine_id: "b" }, ["a"], "a").error, "bad_anchor", "only the same person's routine");
  assert.equal(cleanAnchor({ anchor_routine_id: "a" }, ["a"], "a").error, "bad_anchor", "never itself");
  assert.equal(cleanAnchor({ anchor_text: "x", anchor_routine_id: "b" }, ["b"], "a").error, "one_anchor");
});

test("Кодекс: every member reads it approved 18.11.2026; only a parent adds a version; history kept", async () => {
  for (const k of ["c", "e", "g", "p1"]) {
    const r = await call("GET", "/kodeks", { actor: as(k) });
    assert.equal(r.status, 200, k);
    assert.equal(r.json.current.status, "approved"); assert.equal(r.json.current.approved_on, "2026-11-18");
    assert.equal(r.json.current.body.principles.length, 8);
    assert.equal(r.json.can.edit, k === "p1", k);
    assert.ok(!JSON.stringify(r.json).includes("@"), "no email in the answer");
  }
  assert.equal((await call("GET", "/kodeks")).status, 403, "admin who is not a member");
  const body = structuredClone(KODEKS_V1); body.principles[2].practice = "Чтение или новый навык";
  for (const k of ["c", "e", "g"]) assert.equal((await call("POST", "/kodeks", { actor: as(k), body: { body } })).status, 403, `${k} cannot edit`);
  assert.equal((await call("POST", "/kodeks", { actor: as("p1"), body: { body: { ...body, principles: body.principles.slice(1) } } })).status, 400);
  assert.equal((await call("POST", "/kodeks", { actor: as("p1"), body: { body, approved_on: "2026-12-01" } })).status, 400, "no approval in the future");
  const v2 = await call("POST", "/kodeks", { actor: as("p1"), body: { body } });
  assert.equal(v2.status, 201); assert.equal(v2.json.version, 2);
  const after = (await call("GET", "/kodeks", { actor: as("c") })).json;
  assert.equal(after.current.version, 2); assert.equal(after.current.status, "draft");
  assert.deepEqual(after.history.map((h) => [h.version, h.status]), [[2, "draft"], [1, "approved"]]);
  assert.equal(after.history[0].by.name_ru, "QA p1");
  const v3 = await call("POST", "/kodeks", { actor: as("p2"), body: { body, approved_on: "2026-11-18" } });
  assert.equal(v3.json.version, 3);
  assert.equal((await call("GET", "/kodeks", { actor: as("c") })).json.current.status, "approved");
});

test("principle of the week: everyone reads; a parent picks this week or later; council shows this + next", async () => {
  const r = await call("GET", "/principle", { actor: as("c") });
  assert.equal(r.status, 200); assert.equal(r.json.week_start, "2026-11-16"); assert.equal(r.json.index, 0); assert.equal(r.json.can.pick, false);
  assert.equal(r.json.principle, "Береги своих. Сильный защищает, а не обижает");
  for (const k of ["c", "e", "g"]) assert.equal((await call("PUT", "/principle/2026-11-23", { actor: as(k), body: { index: 3 } })).status, 403, k);
  assert.equal((await call("PUT", "/principle/2026-11-24", { actor: as("p1"), body: { index: 3 } })).status, 400, "not a Monday");
  assert.equal((await call("PUT", "/principle/2026-11-09", { actor: as("p1"), body: { index: 3 } })).status, 400, "not in the past");
  assert.equal((await call("PUT", "/principle/2026-11-23", { actor: as("p1"), body: { index: 8 } })).status, 400);
  const ok = await call("PUT", "/principle/2026-11-23", { actor: as("p1"), body: { index: 3 } });
  assert.equal(ok.status, 200); assert.equal(ok.json.index, 3); assert.equal(ok.json.picked, true);
  const c = await call("GET", "/council?date=2026-11-22", { actor: as("c") });
  assert.equal(c.status, 200, c.text);
  assert.equal(c.json.principle.this_week.week_start, "2026-11-16"); assert.equal(c.json.principle.this_week.index, 0);
  assert.equal(c.json.principle.next_week.week_start, "2026-11-23"); assert.equal(c.json.principle.next_week.index, 3);
  assert.equal(c.json.can.pick_principle, false);
  assert.equal((await call("GET", "/council?date=2026-11-22", { actor: as("p2") })).json.can.pick_principle, true);
});

test("признание: not visible to outsiders; member → member only; ≤ 200; five a day; no counts", async () => {
  const send = (k, to, text, index = 0) => call("POST", "/recognitions", { actor: as(k), body: { to_id: to, index, text } });
  assert.equal((await send("c2", P.c, "Помог с уроками")).status, 201);
  assert.equal((await send("e", P.p1, "Спасибо за ужин", 3)).status, 201);
  assert.equal((await send("c", "00000000-0000-4000-8000-000000000000", "x")).status, 400, "a child cannot send to a non-member");
  assert.equal((await send("c", P.c, "себе")).status, 400, "not to oneself");
  assert.equal((await send("c", P.c2, "x".repeat(201))).status, 400);
  assert.equal((await send("c", P.c2, "ok", 8)).status, 400);
  assert.equal((await call("POST", "/recognitions", { body: { to_id: P.c, index: 0, text: "x" } })).status, 403, "admin outside the family");
  const seen = async (k) => (await call("GET", "/recognitions", { actor: as(k) })).json.recognitions.map((r) => r.text).sort();
  assert.deepEqual(await seen("c"), ["Помог с уроками"], "recipient");
  assert.deepEqual(await seen("c2"), ["Помог с уроками"], "sender");
  assert.deepEqual(await seen("p1"), ["Помог с уроками", "Спасибо за ужин"].sort(), "recipient's parent + own");
  assert.deepEqual(await seen("p2"), ["Помог с уроками"], "the other parent sees the child's, not the spouse's");
  assert.deepEqual(await seen("g"), [], "a relative is not a parent");
  assert.deepEqual(await seen("e"), ["Спасибо за ужин"], "sender only");
  const body = (await call("GET", "/recognitions", { actor: as("p1") })).json;
  assert.ok(!/count|total|likes|score|rank/i.test(Object.keys(body).join(",") + Object.keys(body.recognitions[0]).join(",")), "no counters in the shape");
  assert.ok(!JSON.stringify(body).includes("@"), "no emails");
  const log = await store.accessLog();
  assert.ok(log.some((l) => l.entity === "recognitions:week" && l.subject === P.c), "a parent's read of a child's recognition is logged");
  for (let i = 0; i < 4; i++) assert.equal((await send("c2", P.c, `ещё ${i}`)).status, 201);
  assert.equal((await send("c2", P.c, "шестое")).status, 429, "5 a day per sender");
  const raw = (await store.recognitionsBetween("2026-11-16", "2026-11-22"))[0];
  assert.ok(!JSON.stringify(raw).includes("Помог"), "stored as ciphertext");
});

test("бережный счёт: a child's routines carry «N из M», never a streak; an adult may choose the streak", async () => {
  const mk = async (k, title, extra = {}) => (await call("POST", `/people/${P[k]}/routines`, { actor: as(k === "c" ? "p1" : k), body: { kind: "routine", title, rrule: "FREQ=DAILY", dtstart: "2026-11-01", ...extra } })).json.id;
  const rc = await mk("c", "Почистить зубы");
  await call("POST", `/routines/${rc}/check`, { actor: as("c"), body: { date: "2026-11-16", done: true } });
  await call("POST", `/routines/${rc}/check`, { actor: as("c"), body: { date: "2026-11-17", done: true } });
  for (const k of ["c", "p1"]) {
    const r = (await call("GET", `/people/${P.c}/routines`, { actor: as(k) })).json;
    assert.equal(r.count_mode, "week", k);
    const it = r.routines.find((x) => x.id === rc);
    assert.deepEqual(it.week, { done: 2, of: 7 }, k);
    assert.ok(!("streak" in it), `${k}: no streak field for a child`);
  }
  assert.equal((await call("PUT", `/people/${P.c}/prefs`, { actor: as("p1"), body: { email_on: true, digest_time: "07:00", evening_on: false, evening_time: "20:00", lang: "ru", count_mode: "streak" } })).status, 400, "never for a child");
  const re = await mk("e", "Пробежка");
  assert.ok(!("streak" in (await call("GET", `/people/${P.e}/routines`, { actor: as("e") })).json.routines.find((x) => x.id === re)), "adult default: weekly");
  assert.equal((await call("PUT", `/people/${P.e}/prefs`, { actor: as("e"), body: { email_on: true, digest_time: "07:00", evening_on: false, evening_time: "20:00", lang: "ru", count_mode: "streak" } })).status, 200);
  const ad = (await call("GET", `/people/${P.e}/routines`, { actor: as("e") })).json;
  assert.equal(ad.count_mode, "streak"); assert.equal(typeof ad.routines.find((x) => x.id === re).streak, "number");
  assert.equal((await call("GET", `/people/${P.e}/prefs`, { actor: as("e") })).json.prefs.count_mode, "streak");
  assert.equal((await call("PUT", `/people/${P.e}/prefs`, { actor: as("e"), body: { email_on: true, digest_time: "07:00", evening_on: false, evening_time: "20:00", lang: "ru" } })).status, 200, "old clients without count_mode still work");
  assert.equal((await call("GET", `/people/${P.e}/prefs`, { actor: as("e") })).json.prefs.count_mode, "streak", "…and keep the choice");
});

test("якорь: «После чего?» — free text ≤ 60 or the same person's routine; shown with the title", async () => {
  const base = { kind: "routine", rrule: "FREQ=DAILY", dtstart: "2026-11-01" };
  const a = (await call("POST", `/people/${P.c}/routines`, { actor: as("p1"), body: { ...base, title: "Завтрак" } })).json.id;
  const b = await call("POST", `/people/${P.c}/routines`, { actor: as("p1"), body: { ...base, title: "Собрать портфель", anchor_routine_id: a } });
  assert.equal(b.status, 201);
  const t = await call("POST", `/people/${P.c}/routines`, { actor: as("p1"), body: { ...base, title: "Почитать", anchor_text: "После ужина" } });
  assert.equal(t.status, 201);
  const other = (await call("POST", `/people/${P.c2}/routines`, { actor: as("p1"), body: { ...base, title: "Чужое" } })).json.id;
  assert.equal((await call("POST", `/people/${P.c}/routines`, { actor: as("p1"), body: { ...base, title: "X", anchor_routine_id: other } })).status, 400, "not another person's routine");
  assert.equal((await call("POST", `/people/${P.c}/routines`, { actor: as("p1"), body: { ...base, title: "X", anchor_text: "x".repeat(61) } })).status, 400);
  const list = (await call("GET", `/people/${P.c}/routines`, { actor: as("c") })).json.routines;
  const pb = list.find((x) => x.id === b.json.id), pt = list.find((x) => x.id === t.json.id);
  assert.equal(pb.anchor_title, "Завтрак"); assert.equal(pb.anchor_routine_id, a);
  assert.equal(pt.anchor_text, "После ужина"); assert.equal(pt.anchor_title, null);
});

test("WOOP: owner-only, sealed, never returned to anyone else whatever the goal's visibility", async () => {
  const woop = { wish: "Прочитать 10 книг", outcome: "Свободно читаю", obstacle: "Устаю вечером", plan: "Если устал — читаю 10 минут утром" };
  const g = await call("POST", `/people/${P.c}/goals`, { actor: as("c"), body: { title: "Читать больше", sphere: "learning", visibility: "family", woop } });
  assert.equal(g.status, 201);
  const own = (await call("GET", `/people/${P.c}/goals`, { actor: as("c") })).json.goals.find((x) => x.id === g.json.id);
  assert.deepEqual(own.woop, woop);
  for (const k of ["p1", "e"]) {
    const v = (await call("GET", `/people/${P.c}/goals`, { actor: as(k) })).json.goals.find((x) => x.id === g.json.id);
    assert.ok(v, `${k} sees the family goal`); assert.ok(!("woop" in v), `${k} never sees its WOOP`);
  }
  assert.ok(!JSON.stringify(await store.getGoal(g.json.id)).includes("10 книг"), "ciphertext at rest");
  assert.equal((await call("PATCH", `/goals/${g.json.id}`, { actor: as("p1"), body: { woop: { wish: "x" } } })).status, 403, "a parent never edits a child's WOOP");
  assert.equal((await call("PATCH", `/goals/${g.json.id}`, { actor: as("c"), body: { woop: { wish: "x".repeat(301) } } })).status, 400);
  assert.equal((await call("PATCH", `/goals/${g.json.id}`, { actor: as("c"), body: { woop: { plan: "Если — то" } } })).status, 200);
  assert.deepEqual((await call("GET", `/people/${P.c}/goals`, { actor: as("c") })).json.goals.find((x) => x.id === g.json.id).woop, { plan: "Если — то" });
  assert.equal((await call("PATCH", `/goals/${g.json.id}`, { actor: as("c"), body: { woop: null } })).status, 200);
  assert.equal((await call("GET", `/people/${P.c}/goals`, { actor: as("c") })).json.goals.find((x) => x.id === g.json.id).woop, null);
  const plain = await call("POST", `/people/${P.c}/goals`, { actor: as("c"), body: { title: "Без WOOP", sphere: "joy" } });
  assert.equal(plain.status, 201, "WOOP stays optional");
});

test("route classes for logs carry no ids", () => {
  assert.equal(routeClass("/principle/2026-11-23"), "/principle/:week");
  for (const p of ["/kodeks", "/principle", "/recognitions"]) assert.equal(routeClass(p), p);
});
