// bus 165: pending sign-ins — the one-time code beside the email link. Synthetic hashes only; no address is real.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { CODE_ATTEMPTS, signinState } from "./signin.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-signin-secret-at-least-32-characters!!";
const AUTH = "auth:signin";
let server, base, store, clockAt = new Date("2026-11-26T10:00:00Z");
const h = (s) => createHash("sha256").update(s).digest("hex");
async function call(path, body, { actor = AUTH, method = "POST" } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const hd = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...hd, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  return { status: r.status, json: await r.json().catch(() => null) };
}
const pending = (n, { key = "k1", email = "member@example.test", code = "123456", ttl = 600 } = {}) =>
  call("/signin/pending", { nonce_hash: h(n), email_key: h(key), email, code_hash: h(`code:${code}`), ttl_s: ttl });
const code = (n, c, client) => call("/signin/code", { nonce_hash: h(n), code_hash: h(`code:${c}`), ...(client ? { client } : {}) });

before(async () => {
  store = memoryStore({ clock: () => clockAt });
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => clockAt, passkeys: null })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test("the auth:signin actor works on exactly four routes; nothing else", async () => {
  assert.equal((await call("/me", undefined, { method: "GET" })).status, 403);
  assert.equal((await call("/people", {})).status, 403);
  assert.equal((await call("/passkeys/auth/options", {})).status, 403);
  assert.equal((await call("/signin/code", {}, { method: "PUT" })).status, 403);
  // And a member actor cannot reach the sign-in routes as if it were the site's pre-session call.
  const asMember = await call("/signin/status", { nonce_hash: h("x") }, { actor: "member:someone@example.test" });
  assert.notEqual(asMember.status, 200); assert.equal(asMember.json?.state, undefined);
});

test("input is validated; nothing malformed is stored", async () => {
  assert.equal((await call("/signin/pending", { nonce_hash: "nope", email_key: h("k"), email: null, code_hash: h("c"), ttl_s: 600 })).status, 400);
  assert.equal((await call("/signin/pending", { nonce_hash: h("v1"), email_key: h("k"), email: "Upper@Example.test", code_hash: h("c"), ttl_s: 600 })).status, 400);
  assert.equal((await call("/signin/pending", { nonce_hash: h("v1"), email_key: h("k"), email: null, code_hash: h("c"), ttl_s: 99999 })).status, 400);
  assert.equal((await call("/signin/code", { nonce_hash: h("v1"), code_hash: "123456" })).status, 400, "a raw code is refused: only an HMAC is accepted");
  assert.equal(await store.signinGet(h("v1")), null);
});

test("code in the original tab → ok once; a second use and the link after it → used", async () => {
  assert.equal((await pending("a1", { key: "ka" })).status, 201);
  const ok = await code("a1", "123456");
  assert.deepEqual(ok.json, { state: "ok", email: "member@example.test" });
  assert.equal((await code("a1", "123456")).json.state, "used");
  assert.equal((await call("/signin/consume", { nonce_hash: h("a1") })).json.state, "used");
  assert.deepEqual(store._signinAudit().at(-1), { actor: "auth:signin", action: "signin.code", entity: `signin:${h("ka").slice(0, 12)}` });
  assert.doesNotMatch(JSON.stringify(store._signinAudit()), /123456|member@/, "the audit never carries the code or the address");
});

test("wrong code ×5 → locked, and then even the right code is refused; the link still works", async () => {
  await pending("b1", { key: "kb" });
  for (let i = 1; i < CODE_ATTEMPTS; i++) assert.deepEqual((await code("b1", "000000")).json, { state: "wrong", left: CODE_ATTEMPTS - i });
  assert.deepEqual((await code("b1", "000000")).json, { state: "locked" });
  assert.equal((await code("b1", "123456")).json.state, "locked");
  assert.equal(store._signinAudit().filter((a) => a.action === "signin.code.locked").length, 1);
  // The lock is about guessing; the link proves the cookie and the letter — it is not blocked.
  assert.equal((await call("/signin/consume", { nonce_hash: h("b1") })).json.state, "ok");
});

test("parallel guesses never compare more than five times", async () => {
  await pending("p1", { key: "kp" });
  const rs = await Promise.all(Array.from({ length: 30 }, () => code("p1", "999999")));
  assert.equal(rs.filter((r) => r.json.state === "wrong").length, CODE_ATTEMPTS - 1);
  assert.equal(rs.filter((r) => r.json.state === "locked").length, 30 - (CODE_ATTEMPTS - 1));
  assert.equal((await store.signinGet(h("p1"))).attempts, CODE_ATTEMPTS);
});

test("a newer request supersedes the older one: the old link and the old code are refused with «superseded»", async () => {
  await pending("s1", { key: "ks", code: "111111" });
  clockAt = new Date(clockAt.getTime() + 60_000);
  await pending("s2", { key: "ks", code: "222222" });
  assert.equal((await call("/signin/status", { nonce_hash: h("s1") })).json.state, "superseded");
  assert.equal((await call("/signin/consume", { nonce_hash: h("s1") })).json.state, "superseded");
  assert.equal((await code("s1", "111111")).json.state, "superseded");
  // The newest tab typed the older letter's code: told so, and it costs an attempt.
  assert.deepEqual((await code("s2", "111111")).json, { state: "superseded", left: CODE_ATTEMPTS - 1 });
  assert.equal((await code("s2", "222222")).json.state, "ok");
});

test("a request for another address does not supersede", async () => {
  await pending("o1", { key: "ko1" });
  await pending("o2", { key: "ko2" });
  assert.equal((await call("/signin/status", { nonce_hash: h("o1") })).json.state, "open");
});

test("expired → refused (link and code)", async () => {
  await pending("e1", { key: "ke", ttl: 600 });
  clockAt = new Date(clockAt.getTime() + 601_000);
  assert.equal((await code("e1", "123456")).json.state, "expired");
  assert.equal((await call("/signin/consume", { nonce_hash: h("e1") })).json.state, "expired");
});

test("a stranger's request behaves like a member's: same statuses, and its code never matches", async () => {
  assert.equal((await pending("x1", { key: "kx", email: null, code: "random" })).status, 201);
  assert.deepEqual((await code("x1", "123456")).json, { state: "wrong", left: CODE_ATTEMPTS - 1 });
  assert.equal((await call("/signin/status", { nonce_hash: h("x1") })).json.state, "open");
  assert.equal((await code("never-requested", "123456")).json.state, "unknown");
});

test("per-client cap: 20 guesses per 10 minutes from one client", async () => {
  const client = "c".repeat(32);
  for (let i = 0; i < 20; i++) { await pending(`cl${i}`, { key: `kcl${i}` }); assert.equal((await code(`cl${i}`, "000000", client)).status, 200); }
  await pending("cl-last", { key: "kcl-last" });
  assert.equal((await code("cl-last", "123456", client)).status, 429);
});

test("state precedence and the route class carry no ids", () => {
  const now = new Date("2026-11-26T12:00:00Z"), later = new Date("2026-11-26T12:10:00Z");
  assert.equal(signinState(null, now), "unknown");
  assert.equal(signinState({ consumed_at: now, superseded_at: now, expires_at: later, attempts: 9 }, now), "used");
  assert.equal(signinState({ superseded_at: now, expires_at: later, attempts: 9 }, now), "superseded");
  assert.equal(signinState({ expires_at: now, attempts: 9 }, now), "expired");
  assert.equal(signinState({ expires_at: later, attempts: 5 }, now), "locked");
  assert.equal(signinState({ expires_at: later, attempts: 4 }, now), "open");
  assert.equal(routeClass("/signin/code"), "/signin/code");
});

test("schema and grants: hashes only, never deleted by the app, purged by the runner", () => {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  const roles = readFileSync(new URL("./roles.sql", import.meta.url), "utf8");
  const runner = readFileSync(new URL("./runner.mjs", import.meta.url), "utf8");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS signin_pending/);
  assert.doesNotMatch(schema.slice(schema.indexOf("signin_pending (")), /^\s+code\s+text/m, "no plain code column");
  assert.match(roles, /GRANT SELECT, INSERT, UPDATE \(attempts, superseded_at, consumed_at\) ON signin_pending TO kfo_app;/);
  assert.doesNotMatch(roles, /DELETE[^;]* ON signin_pending/);
  assert.match(runner, /DELETE FROM signin_pending WHERE expires_at < now\(\) - interval '1 day'/);
});
