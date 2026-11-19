// Passkeys (bus 98 design; bus 100 security review C1–C4). Synthetic people only; a software authenticator.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { pkConfig, deviceKind, defaultLabel, REG_OPTIONS_PER_HOUR, MAX_ACTIVE } from "./passkeys.mjs";
import { softAuthenticator } from "./test-authenticator.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-passkeys-secret-at-least-32-chars!!!";
const ORIGIN = "https://kartel.org.uk", RP = "kartel.org.uk";
const cfg = { rpID: RP, origins: [ORIGIN], rpName: "KARTEL" };
let server, base, store, clockAt = new Date("2026-11-18T10:00:00Z");
const ADMIN = "admin:admin@example.test", AUTH = "auth:passkey", as = (k) => `member:${E[k]}`;
const E = { p1: "parent1@example.test", p2: "parent2@example.test", c: "child@example.test", e: "adult@example.test", g: "relative@example.test" };
const P = {};
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* none */ }
  return { status: r.status, json, text: txt };
}
before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => clockAt, passkeys: cfg })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["p2", "adult"], ["c", "child"], ["e", "adult"], ["g", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  for (const k of ["p1", "p2"]) await call("POST", "/grants", { body: { guardian_id: P[k], child_id: P.c, relation: "parent", scopes: ["routines"] } });
  await call("POST", "/grants", { body: { guardian_id: P.g, child_id: P.c, relation: "relative", scopes: ["routines"] } });
});
after(() => server.close());

/** Register a fresh soft key for `who`; returns the authenticator. */
async function enrol(who, opts = {}) {
  const a = softAuthenticator({ origin: ORIGIN, rpID: RP, ...opts });
  const o = await call("POST", "/passkeys/register/options", { actor: who, body: {} });
  assert.equal(o.status, 200, JSON.stringify(o.json));
  const v = await call("POST", "/passkeys/register/verify", { actor: who, body: { challenge_id: o.json.challenge_id, response: a.register(o.json.options), ua: UA } });
  assert.equal(v.status, 201, JSON.stringify(v.json));
  return Object.assign(a, { id: v.json.id });
}
async function signIn(a, opts = {}) {
  const o = await call("POST", "/passkeys/auth/options", { actor: AUTH, body: {} });
  return call("POST", "/passkeys/auth/verify", { actor: AUTH, body: { challenge_id: o.json.challenge_id, response: a.assert(o.json.options, opts) } });
}

test("config is fail-closed; device kind and label are coarse", () => {
  assert.equal(pkConfig({}), null);
  assert.equal(pkConfig({ FAMILY_PASSKEY_RP_ID: "kartel.org.uk" }), null);
  assert.equal(pkConfig({ FAMILY_PASSKEY_RP_ID: "kartel.org.uk", FAMILY_PASSKEY_ORIGINS: "http://evil.example" }), null, "only https origins (or http://localhost)");
  assert.deepEqual(pkConfig({ FAMILY_PASSKEY_RP_ID: "kartel.org.uk", FAMILY_PASSKEY_ORIGINS: "https://kartel.org.uk" }), { rpID: "kartel.org.uk", origins: ["https://kartel.org.uk"], rpName: "KARTEL" });
  assert.equal(deviceKind(UA), "iphone"); assert.equal(deviceKind("x", ["usb"]), "key"); assert.equal(deviceKind("Mozilla/5.0 (Windows NT 10.0)"), "windows");
  assert.equal(defaultLabel("iphone", "fbfc3007-154e-4ecc-8c0b-6e020557d7bd"), "iPhone · Связка ключей iCloud");
  assert.equal(defaultLabel("mac", null), "Ключ · Mac");
});

test("register + sign in: options carry UV required + discoverable; sign-in returns the email; options are the same for everyone", async () => {
  const o = await call("POST", "/passkeys/register/options", { actor: as("e"), body: {} });
  assert.equal(o.json.options.authenticatorSelection.userVerification, "required");
  assert.equal(o.json.options.authenticatorSelection.residentKey, "required");
  assert.equal(o.json.options.attestation, "none");
  assert.notEqual(o.json.options.user.id, Buffer.from(E.e).toString("base64url"), "the user handle is not the email");
  const a = await enrol(as("e"));
  const r = await signIn(a);
  assert.equal(r.status, 200); assert.deepEqual(r.json, { email: E.e });
  const ao = await call("POST", "/passkeys/auth/options", { actor: AUTH, body: {} });
  assert.deepEqual(ao.json.options.allowCredentials ?? [], [], "no credential list — nothing to enumerate");
  assert.equal(ao.json.options.userVerification, "required");
  const mine = (await call("GET", "/passkeys/mine", { actor: as("e") })).json.keys;
  assert.equal(mine.length, 1);
  assert.deepEqual(Object.keys(mine[0]).sort(), ["created_on", "flagged", "id", "kind", "label", "last_used_on", "synced"], "no credential id, no public key");
  assert.equal(mine[0].kind, "iphone");
  // last_used_at is the database's now() (the memory store mirrors it with real time), not the test clock.
  assert.equal(mine[0].last_used_on, new Date().toISOString().slice(0, 10));
});

test("refusals: no UV, wrong origin, reused challenge, forged signature, wrong user handle, revoked key — all one 401", async () => {
  const a = await enrol(as("p2"));
  const noUv = softAuthenticator({ origin: ORIGIN, rpID: RP, uv: false });
  const o1 = await call("POST", "/passkeys/register/options", { actor: as("p2"), body: {} });
  assert.equal((await call("POST", "/passkeys/register/verify", { actor: as("p2"), body: { challenge_id: o1.json.challenge_id, response: noUv.register(o1.json.options), ua: UA } })).status, 400, "UV required at registration");
  assert.equal((await signIn(a, { originOverride: "https://evil.example" })).status, 401);
  const o = await call("POST", "/passkeys/auth/options", { actor: AUTH, body: {} });
  assert.equal((await call("POST", "/passkeys/auth/verify", { actor: AUTH, body: { challenge_id: o.json.challenge_id, response: a.assert(o.json.options) } })).status, 200);
  assert.equal((await call("POST", "/passkeys/auth/verify", { actor: AUTH, body: { challenge_id: o.json.challenge_id, response: a.assert(o.json.options) } })).status, 401, "a challenge is single-use");
  assert.equal((await signIn(a, { forgeSignature: true })).status, 401);
  assert.equal((await signIn(a, { userHandle: randomBytes(32) })).status, 401, "the user handle must match");
  clockAt = new Date("2026-11-18T10:10:00Z");
  const exp = await call("POST", "/passkeys/auth/options", { actor: AUTH, body: {} });
  clockAt = new Date("2026-11-18T10:16:00Z");
  assert.equal((await call("POST", "/passkeys/auth/verify", { actor: AUTH, body: { challenge_id: exp.json.challenge_id, response: a.assert(exp.json.options) } })).status, 401, "an expired challenge fails");
  clockAt = new Date("2026-11-18T10:00:00Z");
  assert.equal((await call("POST", `/passkeys/${a.id}/revoke`, { actor: as("p2"), body: {} })).status, 200);
  assert.equal((await signIn(a)).status, 401, "a revoked key cannot sign in");
});

test("clone check AFTER the signature: a forged low counter flags nothing; a signed regression flags (refused, not revoked) + notice", async () => {
  const a = await enrol(as("g"));
  assert.equal((await signIn(a, { bump: 5 })).status, 200);
  assert.equal((await signIn(a, { bump: -3, forgeSignature: true })).status, 401);
  assert.equal(store._raw.pk.keys.find((k) => k.id === a.id).flagged_at, null, "an unsigned forged response cannot flag someone's key");
  const before = store._raw.pk.notices.length;
  assert.equal((await signIn(a, { bump: 0 })).status, 401, "a signed counter that did not move forward is refused (2 ≤ 5)");
  const k = store._raw.pk.keys.find((x) => x.id === a.id);
  assert.ok(k.flagged_at && !k.revoked_at, "flagged, not revoked");
  assert.equal(store._raw.pk.notices.slice(before).filter((n) => n.kind === "flagged" && n.email === E.g).length, 1, "«ключ помечен» notice queued");
  assert.equal((await signIn(a, { bump: 10 })).status, 401, "refused while flagged");
  assert.equal((await call("POST", `/passkeys/${a.id}/clear-flag`, { actor: as("p1"), body: {} })).status, 403, "a stranger cannot clear it");
  assert.equal((await call("POST", `/passkeys/${a.id}/clear-flag`, { body: {} })).status, 200, "the owner can");
  assert.equal((await signIn(a, { bump: 10 })).status, 200);
});

test("access matrix: own / parent of the child / relative / other adult / owner × list, rename, revoke; a parent never enrols for a child", async () => {
  const kc = await enrol(as("c"));
  const list = (who) => call("GET", `/people/${P.c}/passkeys`, { actor: who });
  assert.equal((await list(as("c"))).status, 200);
  assert.equal((await list(as("p1"))).status, 200);
  assert.equal((await list(ADMIN)).status, 200);
  assert.equal((await list(as("g"))).status, 403, "a relative is not a parent");
  assert.equal((await list(as("e"))).status, 403);
  assert.equal((await call("GET", `/people/${P.e}/passkeys`, { actor: as("p1") })).status, 403, "parents never see an adult's keys");
  assert.equal((await list(as("p1"))).json.can.add, false, "a parent cannot add for the child");
  assert.equal((await call("PATCH", `/passkeys/${kc.id}`, { actor: as("p1"), body: { label: "x" } })).status, 403, "only the person renames");
  assert.equal((await call("PATCH", `/passkeys/${kc.id}`, { actor: as("c"), body: { label: "Мой телефон" } })).status, 200);
  assert.equal((await call("PATCH", `/passkeys/${kc.id}`, { actor: as("c"), body: { label: "x".repeat(41) } })).status, 400);
  for (const k of ["g", "e"]) assert.equal((await call("POST", `/passkeys/${kc.id}/revoke`, { actor: as(k), body: {} })).status, 403, k);
  const before = store._raw.pk.notices.length;
  assert.equal((await call("POST", `/passkeys/${kc.id}/revoke`, { actor: as("p1"), body: {} })).status, 200, "a parent may revoke the child's key");
  assert.equal(store._raw.pk.keys.find((k) => k.id === kc.id).revoked_by, E.p1);
  assert.equal(store._raw.pk.notices.slice(before).filter((n) => n.kind === "revoked" && n.email === E.c).length, 1, "«ключ отозван» notice queued");
  const ke = await enrol(as("e"));
  assert.equal((await call("POST", `/passkeys/${ke.id}/revoke`, { body: {} })).status, 200, "the owner may revoke anyone's key (logged with revoked_by)");
  assert.equal(store._raw.pk.keys.find((k) => k.id === ke.id).revoked_by, "admin@example.test");
  // registration is only ever for the actor's own address — there is no way to name another person
  const o = await call("POST", "/passkeys/register/options", { actor: as("p1"), body: { email: E.c, person_id: P.c } });
  assert.equal(o.json.options.user.name, E.p1, "the body cannot redirect registration to someone else");
});

test("C1: a new key queues «добавлен новый ключ» with the device kind; notices carry no credential id", async () => {
  const before = store._raw.pk.notices.length;
  await enrol(as("p1"));
  const n = store._raw.pk.notices.slice(before);
  assert.deepEqual(n.map(({ kind, email, device_kind, on_date }) => ({ kind, email, device_kind, on_date })), [{ kind: "new_key", email: E.p1, device_kind: "iphone", on_date: "2026-11-18" }]);
  assert.deepEqual(Object.keys(n[0]).sort(), ["device_kind", "email", "id", "kind", "on_date", "sent_at"]);
});

test("C3: register options ≤ 10 per person per hour; failed verifies ≤ 10 per hour; ≤ 10 active keys", async () => {
  const who = "member:qa-rate@example.test";
  await call("POST", "/people", { body: { email: "qa-rate@example.test", name_en: "QA r", name_ru: "QA r", kind: "adult" } });
  for (let i = 0; i < REG_OPTIONS_PER_HOUR; i++) assert.equal((await call("POST", "/passkeys/register/options", { actor: who, body: {} })).status, 200);
  assert.equal((await call("POST", "/passkeys/register/options", { actor: who, body: {} })).status, 429);
  clockAt = new Date("2026-11-18T11:01:00Z");
  assert.equal((await call("POST", "/passkeys/register/options", { actor: who, body: {} })).status, 200, "the hour rolls over");
  for (let i = 0; i < 10; i++) await call("POST", "/passkeys/register/verify", { actor: who, body: { challenge_id: "00000000-0000-4000-8000-000000000000", response: {} } });
  assert.equal((await call("POST", "/passkeys/register/verify", { actor: who, body: { challenge_id: "x", response: {} } })).status, 429, "too many failures");
  clockAt = new Date("2026-11-18T10:00:00Z");
  assert.equal(MAX_ACTIVE, 10);
});

test("(e) the auth:passkey actor works on exactly two routes; everything else is 403", async () => {
  for (const [m, p] of [["GET", "/me"], ["GET", "/people"], ["GET", "/passkeys/mine"], ["POST", "/passkeys/register/options"], ["GET", "/adoption"], ["POST", "/signins"], ["GET", "/board"], ["GET", "/passkeys/auth/options"]])
    assert.equal((await call(m, p, { actor: AUTH, body: m === "GET" ? undefined : {} })).status, 403, `${m} ${p}`);
  assert.equal((await call("POST", "/passkeys/auth/options", { actor: AUTH, body: {} })).status, 200);
});

test("feature off (no RP config) → 404 everywhere; route classes carry no ids; privileges; the image ships the module", async () => {
  const off = createServer(createApp({ store: memoryStore(), secret: SECRET, masterKey: randomBytes(32), passkeys: null })).listen(0);
  await new Promise((r) => off.once("listening", r));
  const b = `http://127.0.0.1:${off.address().port}`;
  for (const [actor, path] of [[AUTH, "/passkeys/auth/options"], [ADMIN, "/passkeys/mine"]]) {
    const h = await signMediaRequest({ secret: SECRET, method: path.endsWith("mine") ? "GET" : "POST", path, actor, body: path.endsWith("mine") ? "" : "{}" });
    const r = await fetch(b + path, { method: path.endsWith("mine") ? "GET" : "POST", headers: { ...h, "content-type": "application/json" }, body: path.endsWith("mine") ? undefined : "{}" });
    assert.equal(r.status, 404, path);
  }
  off.close();
  assert.equal(routeClass("/passkeys/0b5e6b0e-1f2a-4c3d-9e8f-0123456789ab/revoke"), "/passkeys/:id/revoke");
  assert.equal(routeClass("/people/0b5e6b0e-1f2a-4c3d-9e8f-0123456789ab/passkeys"), "/people/:id/passkeys");
  assert.equal(routeClass("/passkeys/auth/verify"), "/passkeys/auth/verify");
  const roles = readFileSync(new URL("./roles.sql", import.meta.url), "utf8");
  assert.match(roles, /GRANT SELECT, INSERT, UPDATE \(counter, last_used_at, backed_up, label, revoked_at, revoked_by, flagged_at\) ON passkey TO kfo_app;/);
  assert.doesNotMatch(roles, /GRANT[^;]*DELETE[^;]* ON [^;]*\b(passkey|passkey_user|passkey_attempt|security_notice)\b(?!_)/, "no DELETE except on single-use challenges");
  assert.match(roles, /GRANT SELECT, INSERT, DELETE ON passkey_challenge TO kfo_app;/);
  assert.match(readFileSync(new URL("./Dockerfile", import.meta.url), "utf8"), /\bpasskeys\.mjs\b/);
});

test("C1 planner: the person always; a child's parents too (their copy names the child); «новый ключ» through quiet hours, others wait", async () => {
  const { planSecurityNotices } = await import("./security-notices.mjs");
  const people = [{ id: "c", email: "c@example.test", name_ru: "Миша QA", name_en: "Misha QA", kind: "child" }, { id: "p", email: "p@example.test", name_ru: "Анна QA", kind: "adult" },
    { id: "g", email: "g@example.test", name_ru: "Дед QA", kind: "adult" }];
  const grants = [{ guardian_id: "p", child_id: "c", relation: "parent" }, { guardian_id: "g", child_id: "c", relation: "relative" }];
  const n = (kind, email = "c@example.test") => ({ id: 1, kind, email, device_kind: "iphone", on_date: "2026-11-18", sent_at: null });
  const day = new Date("2026-11-18T10:00:00Z"), night = new Date("2026-11-18T23:30:00Z");
  const [a] = planSecurityNotices([n("new_key")], people, grants, new Map(), day);
  assert.deepEqual(a.sends, [
    { kind: "new_key", device: "iphone", date: "2026-11-18", lang: "ru", to: "c@example.test", firstName: "Миша" },
    { kind: "new_key", device: "iphone", date: "2026-11-18", lang: "ru", to: "p@example.test", firstName: "Анна", about: "Миша QA" },
  ], "a relative is not told");
  assert.equal(planSecurityNotices([n("new_key")], people, grants, new Map(), night).length, 1, "new key: through quiet hours");
  assert.equal(planSecurityNotices([n("revoked")], people, grants, new Map(), night).length, 0, "revoked: waits for the morning");
  assert.equal(planSecurityNotices([n("flagged")], people, grants, new Map(), night).length, 0);
  assert.deepEqual(planSecurityNotices([n("new_key", "owner@example.test")], people, grants, new Map(), day)[0].sends, [{ kind: "new_key", device: "iphone", date: "2026-11-18", lang: "ru", to: "owner@example.test" }], "an owner with no person row: no name");
  assert.equal(planSecurityNotices([{ ...n("new_key"), sent_at: "x" }], people, grants, new Map(), day).length, 0);
  // bus 105 M1: a two-word name keeps its single inner space; runs of whitespace (incl. NBSP) collapse to one.
  const spaced = [{ ...people[0], name_ru: "  QA\u00a0 Ребёнок  " }, ...people.slice(1)];
  assert.equal(planSecurityNotices([n("new_key")], spaced, grants, new Map(), day)[0].sends[1].about, "QA Ребёнок");
  const runner = readFileSync(new URL("./runner.mjs", import.meta.url), "utf8");
  assert.match(runner, /\/send-security/); assert.match(runner, /DELETE FROM passkey WHERE revoked_at < now\(\) - interval '90 days'/);
});
