// Stage 3e-2 — an adult's own weight and calorie log (R0 18.11.2026). Synthetic people only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { bodyAllowed, cleanWeight, cleanKcal, cleanGoal, weightTrend, gpLine } from "./body.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-stage3e2-secret-at-least-32-chars!!!";
const TODAY = "2026-11-19";
let server, base, store; const clockAt = `${TODAY}T10:00:00Z`;
const ADMIN = "admin:owner@example.test", as = (k) => `member:${E[k]}`;
const E = { a: "adult@example.test", sp: "spouse@example.test", c: "child@example.test", y: "young@example.test", owner: "owner@example.test" };
const P = {};
async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* none */ }
  return { status: r.status, json, txt, headers: r.headers };
}
before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date(clockAt) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["a", "adult"], ["sp", "adult"], ["c", "child"], ["y", "adult"], ["owner", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  await call("PATCH", `/people/${P.y}`, { body: { birth_date: "2009-03-01" } }); // an "adult" row that is 17
  await call("PATCH", `/people/${P.a}`, { body: { birth_date: "1985-06-01" } });
  await call("POST", "/grants", { body: { guardian_id: P.sp, child_id: P.c, relation: "parent", scopes: ["routines", "health", "education", "documents"] } });
});
after(() => server.close());

test("pure: 18+ adults only; values, goal, trend, the GP line", () => {
  assert.equal(bodyAllowed({ kind: "child" }, TODAY), false);
  assert.equal(bodyAllowed({ kind: "adult", birth_date: "2009-03-01" }, TODAY), false, "17 → no");
  assert.equal(bodyAllowed({ kind: "adult", birth_date: "2008-11-19" }, TODAY), true, "18 today → yes");
  assert.equal(bodyAllowed({ kind: "adult", birth_date: "2008-11-20" }, TODAY), false);
  assert.equal(bodyAllowed({ kind: "adult" }, TODAY), true, "no birth date: the adult row decides");
  assert.equal(cleanWeight(72.34), 72.3); assert.equal(cleanWeight(19), undefined); assert.equal(cleanWeight("70"), undefined); assert.equal(cleanWeight(null), null);
  assert.equal(cleanKcal(1800), 1800); assert.equal(cleanKcal(1800.5), undefined); assert.equal(cleanKcal(400), undefined);
  assert.deepEqual(cleanGoal({ weight_kg: 70, by_date: "2027-03-01", kcal_day: 1900 }, TODAY), { weight_kg: 70, by_date: "2027-03-01", kcal_day: 1900 });
  assert.equal(cleanGoal({ bmi: 22 }, TODAY), undefined, "no BMI anywhere"); assert.equal(cleanGoal({ by_date: TODAY }, TODAY), undefined);
  const e = (d, w) => ({ on_date: d, weight_kg: w });
  const t = weightTrend([e("2026-11-02", 80), e("2026-11-04", 79.6), e("2026-11-10", 78.5), e("2026-11-17", 77.2), e("2026-11-19", 77.0)]);
  assert.deepEqual(t.weekly.map((x) => [x.from, x.mean]), [["2026-11-02", 79.8], ["2026-11-09", 78.5], ["2026-11-16", 77.1]], "weekly means; missing days don't count");
  assert.deepEqual(t.monthly.map((x) => x.from), ["2026-11-01"]);
  assert.equal(gpLine({ kcal_day: 1199 }, []), true, "target under 1200");
  assert.equal(gpLine({ kcal_day: 1200 }, []), false);
  const wk = (from, mean) => ({ from, mean, n: 1 });
  assert.equal(gpLine({}, [wk("2026-10-26", 85), wk("2026-11-02", 83.8), wk("2026-11-09", 82.6), wk("2026-11-16", 81.4)]), true, "> 1 kg down three weeks running");
  assert.equal(gpLine({}, [wk("2026-10-26", 85), wk("2026-11-02", 83.8), wk("2026-11-09", 82.6)]), false, "two weeks is not three");
  assert.equal(gpLine({}, [wk("2026-10-19", 85), wk("2026-11-02", 83.8), wk("2026-11-09", 82.6), wk("2026-11-16", 81.4)]), false, "a gap breaks the run");
  assert.equal(gpLine({}, [wk("2026-10-26", 85), wk("2026-11-02", 84.2), wk("2026-11-09", 83.4), wk("2026-11-16", 82.6)]), false, "0.8 kg a week: no line");
});

test("children and under-18s: the routes do not exist (404), whatever they send", async () => {
  for (const k of ["c", "y"]) for (const [m, p, b] of [["GET", "/body"], ["PUT", "/body/prefs", { on: true }], ["PUT", `/body/log/${TODAY}`, { weight_kg: 50 }], ["PUT", "/body/goal", { weight_kg: 50 }], ["GET", "/body/export"], ["DELETE", "/body"]])
    assert.equal((await call(m, p, { actor: as(k), body: b })).status, 404, `${k} ${m} ${p}`);
  assert.equal((await call("GET", "/body", { actor: "admin:norow@example.test" })).status, 404, "an owner without a person row: nothing");
  assert.deepEqual((await call("GET", "/body")).json, { on: false, today: TODAY }, "the owner with their own adult row has their OWN log — nobody else's");
});

test("an adult opts in, logs, sets a goal; sealed at rest; every read logged; a missed day means nothing", async () => {
  assert.deepEqual((await call("GET", "/body", { actor: as("a") })).json, { on: false, today: TODAY });
  assert.equal((await call("PUT", `/body/log/${TODAY}`, { actor: as("a"), body: { weight_kg: 80 } })).status, 409, "off until they choose");
  assert.equal((await call("PUT", "/body/prefs", { actor: as("a"), body: { on: true } })).json.on, true);
  for (const [d, w] of [["2026-10-27", 85], ["2026-11-03", 83.8], ["2026-11-10", 82.6], ["2026-11-17", 81.4]])
    assert.equal((await call("PUT", `/body/log/${d}`, { actor: as("a"), body: { weight_kg: w } })).status, 200);
  assert.equal((await call("PUT", `/body/log/${TODAY}`, { actor: as("a"), body: { kcal: 2100 } })).status, 200);
  assert.equal((await call("PUT", "/body/goal", { actor: as("a"), body: { weight_kg: 78, by_date: "2027-02-01", kcal_day: 2000 } })).status, 200);
  for (const [p, b] of [[`/body/log/2026-11-20`, { weight_kg: 80 }], [`/body/log/${TODAY}`, { weight_kg: 900 }], [`/body/log/${TODAY}`, { weight: 80 }], [`/body/log/${TODAY}`, { kcal: 2000, photo: "x" }], ["/body/goal", { weight_kg: 70, bmi: 22 }]])
    assert.equal((await call("PUT", p, { actor: as("a"), body: b })).status, 400, `${p} ${JSON.stringify(b)}`);
  const logBefore = (await store.accessLog()).length;
  const g = (await call("GET", "/body", { actor: as("a") })).json;
  assert.equal((await store.accessLog()).length, logBefore + 1, "the read is logged");
  assert.deepEqual(g.goal, { weight_kg: 78, by_date: "2027-02-01", kcal_day: 2000 });
  assert.deepEqual(g.entries.map((e) => [e.on_date, e.weight_kg ?? null, e.kcal ?? null]), [["2026-10-27", 85, null], ["2026-11-03", 83.8, null], ["2026-11-10", 82.6, null], ["2026-11-17", 81.4, null], [TODAY, null, 2100]]);
  assert.equal(g.gp, true, "three weeks of > 1 kg down → the GP line");
  assert.ok(!("delta" in g) && !JSON.stringify(g).includes("bmi"), "no deltas, no BMI");
  const rows = await store.bodyLog(P.a);
  assert.ok(rows.length === 5 && rows.every((r) => !/weight_kg|kcal|\{/.test(String(r.value_ct))), "values sealed at rest (no plaintext JSON; digits alone prove nothing in base64)");
  // Clearing a field; clearing both deletes the day.
  assert.equal((await call("PUT", `/body/log/${TODAY}`, { actor: as("a"), body: { kcal: null } })).json.deleted, true);
});

test("owner-only: a spouse, a parent and the family's owner read nothing; no other route carries it", async () => {
  await call("PUT", "/body/prefs", { actor: as("sp"), body: { on: true } });
  const sp = (await call("GET", "/body", { actor: as("sp") })).json;
  assert.deepEqual(sp.entries, [], "the spouse sees only their own (empty) log");
  assert.ok(!JSON.stringify(sp).includes("81.4"));
  for (const path of ["/health", `/people/${P.a}`, "/adoption", "/people", "/board", "/me"]) {
    const r = await call("GET", path, { actor: path === "/adoption" ? ADMIN : as("sp") });
    assert.ok(!/81\.4|weight_kg|kcal/.test(r.txt), `${path} carries no body data`);
  }
});

test("export and delete by the person; the GP line also for a low calorie target; logs carry no dates", async () => {
  const ex = await call("GET", "/body/export", { actor: as("a") });
  assert.equal(ex.status, 200); assert.match(ex.headers.get("content-disposition"), /attachment; filename="kartel-body-2026-11-19\.json"/);
  assert.equal(ex.json.entries.length, 4); assert.equal(ex.json.goal.weight_kg, 78);
  await call("PUT", "/body/prefs", { actor: as("sp"), body: { on: true } });
  await call("PUT", "/body/goal", { actor: as("sp"), body: { kcal_day: 1100 } });
  assert.equal((await call("GET", "/body", { actor: as("sp") })).json.gp, true, "target under 1200 → the GP line, nothing else");
  assert.equal((await call("DELETE", "/body", { actor: as("a") })).status, 200);
  assert.deepEqual((await call("GET", "/body", { actor: as("a") })).json, { on: false, today: TODAY }, "everything gone, the switch too");
  assert.equal((await store.bodyLog(P.a)).length, 0);
  assert.equal(routeClass(`/body/log/${TODAY}`), "/body/log/:date");
});

test("schema + privileges: no body columns outside the sealed tables; the person may delete their own data", () => {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8"), roles = readFileSync(new URL("./roles.sql", import.meta.url), "utf8");
  const sql = schema.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(sql, /\b(weight|kcal|calori|bmi)\w*\s+(numeric|int|real|double|text)/i, "values live only inside value_ct / goal_ct");
  assert.match(roles, /GRANT SELECT, INSERT, UPDATE \(wrapped_key, value_ct\), DELETE ON body_log TO kfo_app;/);
  assert.match(readFileSync(new URL("./Dockerfile", import.meta.url), "utf8"), /\bbody\.mjs\b/);
});

test("the memory store's log actions are exactly the access_log CHECK in schema.sql, defined once (QA-156 C1)", async () => {
  const { LOG_ACTIONS } = await import("./store.mjs");
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  const all = [...schema.matchAll(/ADD CONSTRAINT access_log_action_check CHECK \(action IN \(([^)]*)\)\)/g)];
  // A second, narrower ADD CONSTRAINT fails on every start once a wider action is in the table.
  assert.equal(all.length, 1, "access_log_action_check must be added exactly once");
  assert.deepEqual(all[0][1].split(",").map((x) => x.trim().replace(/'/g, "")), LOG_ACTIONS);
});
