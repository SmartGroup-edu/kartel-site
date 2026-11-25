// Go-live bundle R1 (bus 100/105): «Завершить сеансы» — a session cut-off on the sensitive routes (synthetic people only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createApp, routeClass, sessionGuarded } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-golive-secret-at-least-32-characters!!";
let server, base, store;
const ADMIN = "admin:admin@example.test", as = (k) => `member:${E[k]}`;
const E = { p1: "parent1@example.test", c: "child@example.test", e: "adult@example.test" };
const P = {};
const nowS = () => Math.floor(Date.now() / 1000);
async function call(method, path, { body, actor = ADMIN, sat } = {}) {
  const full = sat === undefined ? path : `${path}${path.includes("?") ? "&" : "?"}sat=${sat}`;
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path: full, actor, body: raw });
  const r = await fetch(base + full, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* none */ }
  return { status: r.status, json };
}
before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date() })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["c", "child"], ["e", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
});
after(() => server.close());

test("pure: since QA-156 H1 the cut-off guards every actor route; only the sign-in note is outside it", () => {
  const id = randomUUID();
  for (const [m, p] of [["GET", `/documents/${id}/files/${id}`], ["POST", "/grants"], ["GET", "/people"], ["GET", "/me"], ["GET", "/body"], ["GET", "/body/export"],
    ["DELETE", "/body"], ["PUT", "/body/log/2026-11-25"], ["GET", `/people/${id}/notes`], ["GET", `/people/${id}/goals`], ["POST", `/people/${id}/ics`], ["GET", "/health"],
    ["GET", "/board"], ["POST", `/people/${id}/end-sessions`], ["POST", "/sessions/end-all"]]) assert.equal(sessionGuarded(m, p), true, `${m} ${p}`);
  assert.equal(sessionGuarded("POST", "/signins"), false);
  assert.equal(routeClass(`/people/${id}/end-sessions`), "/people/:id/end-sessions", "no ids in logs");
  assert.equal(routeClass("/sessions/end-all"), "/sessions/end-all");
});

test("no cut-off: the guarded routes work with or without `sat` (nothing changes until the owner acts)", async () => {
  const g = await call("POST", "/grants", { body: { guardian_id: P.p1, child_id: P.c, relation: "parent", scopes: ["routines"] } });
  assert.equal(g.status, 201);
  assert.equal((await call("PATCH", `/grants/${g.json.id}`, { body: { scopes: ["routines", "health"] }, sat: nowS() })).status, 200);
});

test("only the owner ends sessions; a person's cut-off refuses their older session on every route", async () => {
  for (const k of ["p1", "c", "e"]) {
    assert.equal((await call("POST", `/people/${P.e}/end-sessions`, { actor: as(k) })).status, 403, k);
    assert.equal((await call("POST", "/sessions/end-all", { actor: as(k) })).status, 403, k);
  }
  assert.equal((await call("POST", `/people/${randomUUID()}/end-sessions`)).status, 404);
  const before = nowS() - 60;
  assert.equal((await call("POST", `/people/${P.e}/end-sessions`)).status, 200);
  const doc = randomUUID();
  // e's session issued a minute ago → refused on a guarded route; a missing sat counts as 0 → refused too.
  const r = await call("POST", `/documents/${doc}/reveal`, { actor: as("e"), sat: before });
  assert.equal(r.status, 401); assert.equal(r.json.error, "session_ended");
  assert.equal((await call("POST", `/documents/${doc}/reveal`, { actor: as("e") })).status, 401, "no sat → refused once a cut-off exists");
  assert.equal((await call("GET", `/documents/${doc}/files/${doc}`, { actor: as("e"), sat: before })).status, 401);
  assert.equal((await call("POST", "/passkeys/register/options", { actor: as("e"), sat: before })).status, 401);
  // QA-156 H1: ordinary routes too — nothing of the 8 h session keeps working.
  for (const [m, p] of [["GET", "/me"], ["GET", "/people"], ["GET", "/body"], ["GET", "/body/export"], ["DELETE", "/body"], ["GET", "/health"], ["GET", `/people/${P.e}/goals`], ["POST", `/people/${P.e}/ics`]]) {
    const r = await call(m, p, { actor: as("e"), sat: before });
    assert.equal(r.status, 401, `${m} ${p}`); assert.equal(r.json.error, "session_ended", `${m} ${p}`);
  }
  assert.notEqual((await call("POST", "/signins", { actor: as("e"), sat: before })).status, 401, "the sign-in note is outside the cut-off");
  // A session issued after the cut-off (rounded up to the second) passes the guard (then 404: no such document).
  const fresh = nowS() + 1;
  assert.equal((await call("POST", `/documents/${doc}/reveal`, { actor: as("e"), sat: fresh })).status, 404);
  // Other people are not affected.
  assert.equal((await call("POST", `/documents/${doc}/reveal`, { actor: as("p1"), sat: before })).status, 404);
});

test("«Завершить все сеансы» cuts everyone, the owner included; the later cut-off wins", async () => {
  const old = nowS() - 60;
  assert.equal((await call("POST", "/sessions/end-all")).status, 200);
  for (const k of ["p1", "c"]) assert.equal((await call("POST", `/documents/${randomUUID()}/reveal`, { actor: as(k), sat: old })).status, 401, k);
  const g = await call("POST", "/grants", { body: { guardian_id: P.e, child_id: P.c, relation: "relative", scopes: ["routines"] }, sat: old });
  assert.equal(g.status, 401, "the owner's own older session is cut too — «Доступы» writes need a fresh sign-in");
  assert.equal((await call("POST", "/grants", { body: { guardian_id: P.e, child_id: P.c, relation: "relative", scopes: ["routines"] }, sat: nowS() + 1 })).status, 201);
  assert.ok((await store.sessionCutoff(E.c)) instanceof Date);
});

test("schema + privileges: cut-offs are upserted, never deleted by the app", () => {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8"), roles = readFileSync(new URL("./roles.sql", import.meta.url), "utf8");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS session_cutoff \(\s*email\s+text PRIMARY KEY,\s*cut_at\s+timestamptz NOT NULL,\s*cut_by\s+text NOT NULL/);
  assert.match(roles, /GRANT SELECT, INSERT, UPDATE \(cut_at, cut_by\) ON session_cutoff TO kfo_app;/);
  assert.doesNotMatch(roles, /GRANT[^;]*DELETE[^;]* ON session_cutoff/);
});
