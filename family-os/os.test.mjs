// Family OS Stage 1 — service tests (synthetic people only, in-memory store).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { seal, open, encryptNote, decryptNote, rewrap, parseMasterKey } from "./crypto.mjs";
import { parseActor, noteKindsFor, checkGrant } from "./policy.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-test-secret-at-least-32-characters!!";
const KEK = randomBytes(32);
let server, base, store;
const ADMIN = "admin:admin@example.test";
const as = (email) => `member:${email}`;

async function call(method, path, { body, actor = ADMIN, secret = SECRET } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" || method === "DELETE" ? undefined : raw });
  return { status: r.status, json: await r.json().catch(() => null) };
}

before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: KEK })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// ---------- crypto
test("envelope encryption: round trip; ciphertext bound to its note and field", () => {
  const a = encryptNote(KEK, "note-a", { title: "Allergy", body: "Synthetic body A" });
  const b = encryptNote(KEK, "note-b", { title: "School", body: "Synthetic body B" });
  assert.deepEqual(decryptNote(KEK, { id: "note-a", ...a }), { title: "Allergy", body: "Synthetic body A" });
  assert.throws(() => decryptNote(KEK, { id: "note-b", ...a }), "a row copied under another id does not decrypt");
  assert.throws(() => decryptNote(KEK, { id: "note-a", ...a, title_ct: a.body_ct }), "fields cannot be swapped");
  assert.throws(() => decryptNote(KEK, { id: "note-a", ...a, wrapped_key: b.wrapped_key }), "another note's key does not open it");
  assert.throws(() => decryptNote(randomBytes(32), { id: "note-a", ...a }), "wrong master key fails");
  const t = a.body_ct.split("."); t[2] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decryptNote(KEK, { id: "note-a", ...a, body_ct: t.join(".") }), "tampering is detected");
  for (const v of Object.values(a)) assert.ok(!String(v).includes("Synthetic") && !String(v).includes("Allergy"), "no plaintext in the stored row");
});

test("rotation re-wraps the data key; fields stay as they are", () => {
  const k2 = randomBytes(32);
  const row = { id: "n1", ...encryptNote(KEK, "n1", { title: "T", body: "B" }) };
  const moved = { ...row, wrapped_key: rewrap(KEK, k2, row) };
  assert.deepEqual(decryptNote(k2, moved), { title: "T", body: "B" });
  assert.throws(() => decryptNote(KEK, moved));
});

test("master key file: 32 raw bytes or 64 hex; anything else refused", () => {
  assert.equal(parseMasterKey(randomBytes(32)).length, 32);
  assert.equal(parseMasterKey("ab".repeat(32) + "\n").length, 32);
  assert.throws(() => parseMasterKey("short"));
  assert.throws(() => open(KEK, "garbage", "x"));
  assert.ok(seal(KEK, Buffer.from("x"), "a").startsWith("v1."));
});

// ---------- policy
test("policy: actor format, note kinds per relation, grant validation", () => {
  assert.deepEqual(parseActor("admin:A@B.test"), { role: "admin", email: "a@b.test" });
  assert.equal(parseActor("a@b.test"), null); assert.equal(parseActor("root:a@b.test"), null);
  const adult = { id: "1", kind: "adult" }, other = { id: "2", kind: "adult" }, child = { id: "3", kind: "child" };
  const g = [{ guardian_id: "1", child_id: "3", scopes: ["routines", "health"], revoked_at: null }];
  assert.deepEqual(noteKindsFor(adult, adult, g), ["health", "education"]);
  assert.deepEqual(noteKindsFor(other, adult, g), []);
  assert.deepEqual(noteKindsFor(adult, child, g), ["health"]);
  assert.deepEqual(noteKindsFor(other, child, g), []);
  assert.deepEqual(noteKindsFor(child, child, g), [], "a child does not read their own care notes");
  assert.deepEqual(noteKindsFor(adult, child, [{ ...g[0], revoked_at: "x" }]), []);
  assert.equal(checkGrant({ guardian: child, child: adult, relation: "parent", scopes: ["health"] }), "guardian_not_adult");
  assert.equal(checkGrant({ guardian: adult, child: other, relation: "parent", scopes: ["health"] }), "subject_not_child");
  assert.equal(checkGrant({ guardian: adult, child, relation: "parent", scopes: ["photos"] }), "bad_scopes");
  assert.equal(checkGrant({ guardian: adult, child, relation: "parent", scopes: ["health"] }), null);
});

// ---------- service: a synthetic family — two parents, a child, a relative without a grant
const P = {};
test("service: signatures and actor are required", async () => {
  assert.equal((await fetch(base + "/healthz")).status, 200);
  assert.equal((await fetch(base + "/me")).status, 401);
  assert.equal((await call("GET", "/me", { secret: "x".repeat(40) })).status, 401);
  assert.equal((await call("GET", "/me", { actor: "someone@example.test" })).status, 403);
});

test("service: admin creates people and grants; members cannot", async () => {
  for (const [k, email, kind] of [["p1", "parent1@example.test", "adult"], ["p2", "parent2@example.test", "adult"], ["c", "child@example.test", "child"], ["r", "relative@example.test", "adult"]]) {
    const r = await call("POST", "/people", { body: { email, name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } });
    assert.equal(r.status, 201); P[k] = r.json.id;
  }
  assert.equal((await call("POST", "/people", { body: { email: "parent1@example.test", name_en: "x", name_ru: "x", kind: "adult" } })).status, 409);
  assert.equal((await call("POST", "/people", { actor: as("parent1@example.test"), body: { email: "z@example.test", name_en: "x", name_ru: "x", kind: "adult" } })).status, 403);
  for (const k of ["p1", "p2"]) assert.equal((await call("POST", "/grants", { body: { guardian_id: P[k], child_id: P.c, relation: "parent", scopes: ["routines", "health", "education"] } })).status, 201);
  assert.equal((await call("POST", "/grants", { body: { guardian_id: P.c, child_id: P.p1, relation: "parent", scopes: ["health"] } })).json.error, "guardian_not_adult");
  assert.equal((await call("POST", "/grants", { actor: as("parent1@example.test"), body: { guardian_id: P.r, child_id: P.c, relation: "relative", scopes: ["health"] } })).status, 403);
});

test("service: people list — emails only for the admin", async () => {
  const m = await call("GET", "/people", { actor: as("relative@example.test") });
  assert.equal(m.status, 200); assert.equal(m.json.people.length, 4); assert.ok(m.json.people.every((p) => !("email" in p)));
  assert.ok((await call("GET", "/people")).json.people.every((p) => p.email));
  assert.equal((await call("GET", "/people", { actor: as("stranger@example.test") })).status, 403);
  assert.equal((await call("GET", "/me", { actor: as("stranger@example.test") })).json.me, null);
});

test("service: both parents read and write the child's health notes; relative without a grant cannot; child cannot", async () => {
  const w = await call("POST", `/people/${P.c}/notes`, { actor: as("parent1@example.test"), body: { kind: "health", title: "QA allergy", body: "QA synthetic note" } });
  assert.equal(w.status, 201);
  for (const e of ["parent1@example.test", "parent2@example.test"]) {
    const r = await call("GET", `/people/${P.c}/notes`, { actor: as(e) });
    assert.equal(r.status, 200); assert.equal(r.json.notes[0].title, "QA allergy");
  }
  assert.equal((await call("GET", `/people/${P.c}/notes`, { actor: as("relative@example.test") })).status, 403);
  assert.equal((await call("GET", `/people/${P.c}/notes`, { actor: as("child@example.test") })).status, 403);
  assert.equal((await call("GET", `/people/${P.c}/notes`)).status, 403, "admin is not an implicit reader");
  assert.equal((await call("POST", `/people/${P.c}/notes`, { actor: as("relative@example.test"), body: { kind: "health", title: "x", body: "y" } })).status, 403);
  for (const row of store._raw.notes.values()) assert.ok(!JSON.stringify(row).includes("QA synthetic note"), "stored row holds ciphertext only");
});

test("service: an explicit relative grant opens exactly its scopes; revocation applies on the next request", async () => {
  const g = await call("POST", "/grants", { body: { guardian_id: P.r, child_id: P.c, relation: "relative", scopes: ["education"] } });
  assert.equal(g.status, 201);
  const r = await call("GET", `/people/${P.c}/notes`, { actor: as("relative@example.test") });
  assert.equal(r.status, 200); assert.deepEqual(r.json.kinds, ["education"]); assert.equal(r.json.notes.length, 0, "health stays closed");
  assert.equal((await call("DELETE", `/grants/${g.json.id}`)).status, 200);
  assert.equal((await call("GET", `/people/${P.c}/notes`, { actor: as("relative@example.test") })).status, 403);
});

test("service: an adult's notes are theirs alone", async () => {
  assert.equal((await call("POST", `/people/${P.p2}/notes`, { actor: as("parent2@example.test"), body: { kind: "health", title: "QA own", body: "QA" } })).status, 201);
  assert.equal((await call("GET", `/people/${P.p2}/notes`, { actor: as("parent1@example.test") })).status, 403);
  assert.equal((await call("GET", `/people/${P.p2}/notes`, { actor: as("parent2@example.test") })).json.notes.length, 1);
});

test("service: every read is logged first; if the log fails the read fails (no data leaves)", async () => {
  const before = (await store.accessLog()).length;
  await call("GET", `/people/${P.c}/notes`, { actor: as("parent2@example.test") });
  const after1 = await store.accessLog();
  assert.equal(after1.length, before + 1);
  assert.deepEqual({ actor: after1[0].actor, subject: after1[0].subject, action: after1[0].action }, { actor: "parent2@example.test", subject: P.c, action: "read" });
  store.failLog = true;
  const r = await call("GET", `/people/${P.c}/notes`, { actor: as("parent1@example.test") });
  assert.equal(r.status, 503); assert.equal(r.json.notes, undefined);
  const w = await call("POST", `/people/${P.c}/notes`, { actor: as("parent1@example.test"), body: { kind: "health", title: "x", body: "y" } });
  assert.equal(w.status, 503);
  store.failLog = false;
  assert.equal((await store.accessLog()).length, before + 1, "nothing else was logged or written");
});

test("log lines carry route classes only", () => {
  assert.equal(routeClass(`/people/${"1".repeat(8)}-aaaa-4aaa-8aaa-${"1".repeat(12)}/notes`), "/people/:id/notes");
  assert.equal(routeClass("/grants/abc"), "/grants/:id");
  assert.equal(routeClass("/secret/path?x=1"), "/:other");
});
