// Stage 3e-1 «Здоровье-лайт» — movement/sleep ticks (family total only) and the evening question (author only).
// Synthetic people only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { healthPrefFor, familyTotals, tickDateOk, cleanEvening, MIN_FOR_TOTAL } from "./health.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-stage3e1-secret-at-least-32-chars!!!";
const TODAY = "2026-11-19"; // Thursday; week 2026-11-16 … 2026-11-22
let server, base, store; const clockAt = `${TODAY}T10:00:00Z`;
const ADMIN = "admin:admin@example.test", as = (k) => `member:${E[k]}`;
const E = { p1: "parent1@example.test", c: "child@example.test", c2: "child2@example.test", e: "adult@example.test", f: "adult2@example.test" };
const P = {};
async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* none */ }
  return { status: r.status, json, txt };
}
before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date(clockAt) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["c", "child"], ["c2", "child"], ["e", "adult"], ["f", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  await call("POST", "/grants", { body: { guardian_id: P.p1, child_id: P.c, relation: "parent", scopes: ["routines", "health"] } });
});
after(() => server.close());

test("pure: defaults, the three-person floor, tick dates, one-line answers", () => {
  assert.deepEqual(healthPrefFor({ kind: "child" }, null), { ticks_on: true, evening_q_on: false }, "a child may tick (and may switch it off)");
  assert.deepEqual(healthPrefFor({ kind: "adult" }, null), { ticks_on: false, evening_q_on: false }, "an adult chooses to");
  const people = [{ id: "a", kind: "child" }, { id: "b", kind: "child" }, { id: "c", kind: "adult" }];
  const t = (id, d, kind, done = true) => ({ person_id: id, on_date: d, kind, done });
  assert.deepEqual(familyTotals(people, [], [t("a", "2026-11-17", "move")], "2026-11-16", "2026-11-22"), { ready: false, of: 2 }, "two people → no total");
  assert.equal(MIN_FOR_TOTAL, 3);
  const prefs = [{ person_id: "c", ticks_on: true, evening_q_on: false }];
  assert.deepEqual(familyTotals(people, prefs, [t("a", "2026-11-17", "move"), t("b", "2026-11-17", "move", false), t("c", "2026-11-18", "sleep"), t("c", "2026-11-09", "move")], "2026-11-16", "2026-11-22"),
    { ready: true, of: 3, move: 1, sleep: 1 }, "done ticks this week only; ONE number per kind, nothing per person or per day");
  assert.equal(tickDateOk("2026-11-19", TODAY), true); assert.equal(tickDateOk("2026-11-13", TODAY), true);
  assert.equal(tickDateOk("2026-11-12", TODAY), false); assert.equal(tickDateOk("2026-11-20", TODAY), false, "never the future");
  assert.equal(cleanEvening("  Помог\nбрату  "), "Помог брату"); assert.equal(cleanEvening("   "), null); assert.equal(cleanEvening("x".repeat(201)), undefined); assert.equal(cleanEvening(5), undefined);
});

test("ticks: a child ticks by default; an adult first chooses to; only the viewer's own, only recent days", async () => {
  assert.equal((await call("POST", "/health/tick", { actor: as("c"), body: { date: TODAY, kind: "move", done: true } })).status, 200);
  const off = await call("POST", "/health/tick", { actor: as("e"), body: { date: TODAY, kind: "move", done: true } });
  assert.equal(off.status, 409); assert.equal(off.json.error, "ticks_off");
  assert.equal((await call("PUT", "/health/prefs", { actor: as("e"), body: { ticks_on: true } })).json.ticks_on, true);
  assert.equal((await call("POST", "/health/tick", { actor: as("e"), body: { date: TODAY, kind: "sleep", done: true } })).status, 200);
  for (const b of [{ date: "2026-11-20", kind: "move", done: true }, { date: "2026-11-12", kind: "move", done: true }, { date: TODAY, kind: "steps", done: true },
    { date: TODAY, kind: "move", done: "yes" }, { date: TODAY, kind: "move", done: true, person_id: P.c }, { date: TODAY, kind: "move", done: true, weight: 70 }])
    assert.equal((await call("POST", "/health/tick", { actor: as("e"), body: b })).status, 400, JSON.stringify(b));
  assert.equal((await call("PUT", "/health/prefs", { actor: as("c"), body: { ticks_on: false } })).json.ticks_on, false, "a child may switch ticking off");
  assert.equal((await call("PUT", "/health/prefs", { actor: as("c"), body: { ticks_on: true } })).status, 200);
  assert.equal((await call("PUT", "/health/prefs", { actor: as("c"), body: { ticks_on: true, calories_on: true } })).status, 400, "no other settings exist");
  assert.equal((await call("GET", "/health")).status, 403, "the owner without a person row has nothing to see");
});

test("the family total: hidden until three people tick; then one number per kind — nobody sees anyone else's ticks", async () => {
  // c2 switches ticking off: c (child, default on) + e (opted in) = 2 → no total.
  await call("PUT", "/health/prefs", { actor: as("c2"), body: { ticks_on: false } });
  let h = (await call("GET", "/health", { actor: as("p1") })).json;
  assert.deepEqual(h.family, { ready: false, of: 2 }, "two people: the total would point at someone");
  await call("PUT", "/health/prefs", { actor: as("c2"), body: { ticks_on: true } });
  await call("POST", "/health/tick", { actor: as("c2"), body: { date: "2026-11-18", kind: "move", done: true } });
  h = (await call("GET", "/health", { actor: as("p1") })).json;
  assert.deepEqual(h.family, { ready: true, of: 3, move: 2, sleep: 1 });
  assert.deepEqual(h.mine, { ticks_on: false, evening_q_on: false, kind: "adult", ticks: [] }, "the parent sees the total and their own ticks — never the child's");
  const raw = (await call("GET", "/health", { actor: as("p1") })).txt;
  for (const id of [P.c, P.c2, P.e]) assert.ok(!raw.includes(id), "no other person's id in the answer");
  const mine = (await call("GET", "/health", { actor: as("c") })).json.mine;
  assert.deepEqual(mine.ticks, [{ date: TODAY, kind: "move" }]);
  // An un-tick is a tick with done:false — it stops counting.
  await call("POST", "/health/tick", { actor: as("c"), body: { date: TODAY, kind: "move", done: false } });
  assert.equal((await call("GET", "/health", { actor: as("e") })).json.family.move, 1);
});

test("evening question: opt-in, one line, sealed at rest, only its author reads it; empty deletes; the read is logged", async () => {
  const off = await call("PUT", `/evening/${TODAY}`, { actor: as("c"), body: { text: "Помог брату" } });
  assert.equal(off.status, 409); assert.equal(off.json.error, "question_off");
  await call("PUT", "/health/prefs", { actor: as("c"), body: { evening_q_on: true } });
  assert.equal((await call("PUT", `/evening/${TODAY}`, { actor: as("c"), body: { text: "Помог\nбрату с уроками" } })).status, 200);
  assert.equal((await call("PUT", `/evening/${TODAY}`, { actor: as("c"), body: { text: "Помог брату с уроками и дочитал книгу" } })).status, 200, "same day: replaced");
  const g = (await call("GET", "/evening", { actor: as("c") })).json;
  assert.deepEqual(g, { on: true, today: TODAY, answers: [{ date: TODAY, text: "Помог брату с уроками и дочитал книгу" }] });
  for (const k of ["p1", "e"]) assert.deepEqual((await call("GET", "/evening", { actor: as(k) })).json.answers, [], `${k} (a parent too) gets only their own — none`);
  assert.equal((await call("GET", "/evening")).status, 403, "the owner without a person row: nothing");
  const rows = await store.eveningFor(P.c, "2026-11-13", TODAY);
  assert.equal(rows.length, 1); assert.ok(!String(rows[0].text_ct).includes("книгу"), "sealed at rest");
  for (const [d, b, err] of [[TODAY, { text: "x".repeat(201) }, "bad_text"], ["2026-11-20", { text: "x" }, "bad_date"], [TODAY, { text: "x", child: P.c2 }, "bad_text"]]) {
    const r = await call("PUT", `/evening/${d}`, { actor: as("c"), body: b }); assert.equal(r.status, 400); assert.equal(r.json.error, err);
  }
  assert.equal((await call("PUT", `/evening/${TODAY}`, { actor: as("c"), body: { text: "  " } })).json.deleted, true);
  assert.deepEqual((await call("GET", "/evening", { actor: as("c") })).json.answers, []);
});

test("red lines (plan §2.4): no weight, calorie or medical anything in 3e-1; no ids in logs; the module ships", () => {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  const block = schema.slice(schema.indexOf("Stage 3e-1")).split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(block, /weight|calori|kcal|bmi|вес|калор/i);
  const mod = readFileSync(new URL("./health.mjs", import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(mod, /weight|calori|kcal|bmi|диагноз|лекарств|таблет/i);
  const roles = readFileSync(new URL("./roles.sql", import.meta.url), "utf8");
  assert.match(roles, /GRANT SELECT, INSERT, UPDATE \(done\) ON health_tick TO kfo_app;/);
  assert.doesNotMatch(roles, /GRANT[^;]*DELETE[^;]* ON health_(tick|pref)/, "ticks and settings are never deleted by the app");
  assert.equal(routeClass(`/evening/${TODAY}`), "/evening/:date"); assert.equal(routeClass("/health/tick"), "/health/tick");
  assert.match(readFileSync(new URL("./Dockerfile", import.meta.url), "utf8"), /\bhealth\.mjs\b/);
});
