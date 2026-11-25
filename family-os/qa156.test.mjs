// QA-156 fixes in the Family OS service (R0 25.11, bus 157): H1 (ICS on end-sessions), M2, M3, M4, M5, L5, L11.
// Synthetic people only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createApp } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { pkConfig } from "./passkeys.mjs";
import { PK_PREFIX, newBodyKey, openBodyKey, rowKey } from "./body-keys.mjs";
import { open } from "./crypto.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";
import { readFileSync } from "node:fs";

const SECRET = "os-qa156-secret-at-least-32-characters!!", KEK = randomBytes(32);
const ADMIN = "admin:owner@example.test", as = (k) => `member:${E[k]}`;
const E = { a: "adult@example.test", nb: "nobirth@example.test", b: "second@example.test" };
const P = {};
let server, base, store, nowIso = "2026-11-25T10:00:00Z";
const nowS = () => Math.floor(new Date(nowIso).getTime() / 1000);
async function call(method, path, { body, actor = ADMIN, sat } = {}) {
  const full = sat === undefined ? path : `${path}${path.includes("?") ? "&" : "?"}sat=${sat}`;
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path: full, actor, body: raw });
  const r = await fetch(base + full, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* none */ }
  return { status: r.status, json, txt };
}
before(async () => {
  // QA-158 N1: the store's cut-off and the app's `sat` checks run on one fake clock, so the file passes at any hour.
  const clock = () => new Date(nowIso);
  store = memoryStore({ clock });
  const passkeys = { rpID: "localhost", origins: ["http://localhost:3999"], rpName: "KARTEL" };
  server = createServer(createApp({ store, secret: SECRET, masterKey: KEK, clock, passkeys })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const k of ["a", "nb", "b"]) P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind: "adult" } })).json.id;
  for (const k of ["a", "b"]) await call("PATCH", `/people/${P[k]}`, { body: { birth_date: "1985-06-01" } });
});
after(() => server.close());

test("M2: an adult without a birth date has no /body until the owner confirms adulthood; only the owner confirms", async () => {
  assert.equal((await call("GET", "/body", { actor: as("nb") })).status, 404, "unknown age → the routes do not exist");
  const prof = await call("GET", `/people/${P.nb}`);
  assert.equal(prof.json.person.adult_confirmed, false, "the owner sees the switch");
  assert.equal((await call("GET", `/people/${P.nb}`, { actor: as("nb") })).json.person.adult_confirmed, undefined, "nobody else does");
  assert.equal((await call("PATCH", `/people/${P.nb}`, { actor: as("nb"), body: { adult_confirmed: true } })).status, 403);
  assert.equal((await call("PATCH", `/people/${P.nb}`, { body: { adult_confirmed: "yes" } })).status, 400);
  assert.equal((await call("PATCH", `/people/${P.nb}`, { body: { adult_confirmed: true } })).status, 200);
  assert.equal((await call("GET", "/body", { actor: as("nb") })).status, 200);
  assert.equal((await call("PATCH", `/people/${P.nb}`, { body: { adult_confirmed: false } })).status, 200);
  assert.equal((await call("GET", "/body", { actor: as("nb") })).status, 404, "withdrawn again");
});

test("M3 + L11: rows are wrapped by the person's /body key; writes and on/off are logged; delete destroys the key", async () => {
  const before = store._raw.log.length;
  assert.equal((await call("PUT", "/body/prefs", { actor: as("a"), body: { on: true } })).status, 200);
  assert.equal((await call("PUT", "/body/log/2026-11-24", { actor: as("a"), body: { weight_kg: 71.4 } })).status, 200);
  assert.equal((await call("PUT", "/body/goal", { actor: as("a"), body: { weight_kg: 70 } })).status, 200);
  const logs = store._raw.log.slice(before).map((l) => `${l.action}|${l.entity}`);
  assert.deepEqual(logs, ["write|body:prefs", "write|body:log", "write|body:goal"], "L11: every write and the switch are logged, values never");
  assert.ok(!JSON.stringify(store._raw.log.slice(before)).includes("71.4"));
  const wrappedKey = await store.bodyKey(P.a);
  assert.ok(wrappedKey, "one person key");
  const row = (await store.bodyLog(P.a))[0];
  assert.ok(row.wrapped_key.startsWith(PK_PREFIX), "the row key is wrapped by the person key, not the master key");
  // With the person key the row opens; this is what a stolen copy of the row needs.
  const pk = openBodyKey(KEK, wrappedKey, P.a);
  assert.deepEqual(JSON.parse(open(rowKey(KEK, pk, row.wrapped_key, "body", row.id), row.value_ct, `body:${row.id}`).toString()), { weight_kg: 71.4 });
  assert.equal((await call("GET", "/body", { actor: as("a") })).json.entries[0].weight_kg, 71.4);
  assert.equal((await call("DELETE", "/body", { actor: as("a") })).status, 200);
  assert.equal(await store.bodyKey(P.a), null, "«Удалить все записи» destroys the key");
  // A copy of the old row (WAL, a dead tuple, a dump) no longer opens with the master key alone.
  assert.throws(() => rowKey(KEK, null, row.wrapped_key, "body", row.id), /body key destroyed/);
  assert.throws(() => rowKey(KEK, newBodyKey(KEK, P.a).key, row.wrapped_key, "body", row.id), "a new key for the same person does not open it");
  // Starting again makes a new key; nothing of the old log is visible.
  await call("PUT", "/body/prefs", { actor: as("a"), body: { on: true } });
  assert.deepEqual((await call("GET", "/body", { actor: as("a") })).json.entries, []);
});

test("H1: «Завершить сеансы» revokes the person's calendar link; «все сеансы» revokes everyone's", async () => {
  const issue = async (k) => (await call("POST", `/people/${P[k]}/ics`, { actor: as(k), sat: nowS() })).json.token;
  const feed = async (t) => (await call("GET", `/ics/${t}`, { actor: "system:ics" })).status;
  const ta = await issue("a"), tb = await issue("b");
  assert.equal(await feed(ta), 200); assert.equal(await feed(tb), 200);
  assert.equal((await call("POST", `/people/${P.a}/end-sessions`)).status, 200);
  assert.equal(await feed(ta), 404, "a's link is revoked"); assert.equal(await feed(tb), 200, "b's is not");
  nowIso = "2026-11-25T10:05:00Z";
  assert.equal((await call("POST", "/sessions/end-all", { sat: nowS() })).status, 200);
  assert.equal(await feed(tb), 404, "everyone's link is revoked");
  nowIso = "2026-11-25T10:10:00Z";
});

test("QA-158 N1: the memory store cuts sessions off on the clock it was given, not the wall clock", async () => {
  const past = memoryStore({ clock: () => new Date("2001-02-03T04:05:06Z") });
  await past.endSessions("*", "admin:owner@example.test");
  assert.equal((await past.sessionCutoff("anyone@example.test")).toISOString(), "2001-02-03T04:05:06.000Z");
  const real = memoryStore(), t0 = Date.now();
  await real.endSessions("*", "admin:owner@example.test");
  assert.ok(Math.abs((await real.sessionCutoff("anyone@example.test")).getTime() - t0) < 5000, "without a clock: now");
});

test("M4: unknown calendar tokens do not spend the family's feed budget", async () => {
  const t = (await call("POST", `/people/${P.b}/ics`, { actor: as("b"), sat: nowS() })).json.token;
  for (let i = 0; i < 650; i++) await call("GET", `/ics/${randomBytes(32).toString("base64url")}`, { actor: "system:ics" });
  assert.equal((await call("GET", `/ics/${t}`, { actor: "system:ics" })).status, 200, "a real link still works after 650 misses");
  assert.equal((await call("GET", `/ics/${randomBytes(32).toString("base64url")}`, { actor: "system:ics" })).status, 429, "misses have their own cap");
});

test("M5: one client may hold 20 sign-in challenges per 10 minutes; others are not pushed out", async () => {
  const opts = (client) => call("POST", "/passkeys/auth/options", { actor: "auth:passkey", body: client ? { client } : {} });
  const c1 = "a".repeat(32), c2 = "b".repeat(32);
  for (let i = 0; i < 20; i++) assert.equal((await opts(c1)).status, 200, `#${i + 1}`);
  assert.equal((await opts(c1)).status, 429, "the 21st from the same client");
  assert.equal((await opts(c2)).status, 200, "another client is unaffected");
  assert.equal((await opts("not-hex")).status, 200, "a malformed client key falls back to the family-wide ceiling");
});

test("L5: in production a passkey origin must be https — localhost only outside production or on a QA stand that says so", () => {
  const env = { FAMILY_PASSKEY_RP_ID: "localhost", FAMILY_PASSKEY_ORIGINS: "http://localhost:3999" };
  assert.equal(pkConfig({ ...env, NODE_ENV: "production" }), null);
  assert.ok(pkConfig({ ...env, NODE_ENV: "development" }));
  assert.ok(pkConfig({ ...env, NODE_ENV: "production", FAMILY_PASSKEY_ALLOW_LOCALHOST: "1" }));
  assert.ok(pkConfig({ FAMILY_PASSKEY_RP_ID: "kartel.org.uk", FAMILY_PASSKEY_ORIGINS: "https://kartel.org.uk", NODE_ENV: "production" }));
  assert.equal(pkConfig({ FAMILY_PASSKEY_RP_ID: "kartel.org.uk", FAMILY_PASSKEY_ORIGINS: "https://kartel.org.uk,http://localhost:3000", NODE_ENV: "production" }), null, "one http origin spoils the list");
});

test("157b: restore-drill casts contype to text, ends every FK statement with ';', re-adds every FK and fails loudly", () => {
  const d = readFileSync(new URL("./restore-drill.sh", import.meta.url), "utf8");
  const code = d.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
  assert.doesNotMatch(code.replace(/contype::text/g, ""), /contype/, "contype is always cast");
  assert.match(d, /' ADD CONSTRAINT ' \|\| quote_ident\(conname\) \|\| ' ' \|\| pg_get_constraintdef\(oid\) \|\| ';'/);
  assert.match(d, /' DROP CONSTRAINT ' \|\| quote_ident\(conname\) \|\| '; ALTER TABLE '/);
  assert.match(d, /echo "BEGIN;"; cat "\$WORK\/fk\.sql"; echo "ROLLBACK;"/, "inside one rolled-back transaction");
  assert.match(d, /ON_ERROR_STOP=1 -q -f \/tmp\/fk\.sql >\/dev\/null; then echo "foreign keys re-added against all rows/);
  for (const k of ["COLS", "CONS", "IDX", "TRG"]) assert.match(d, new RegExp(`"${k}\\|SELECT`));
  assert.match(d, /schema\.sql on restored db: FAILED"; exit 1;/);
});
