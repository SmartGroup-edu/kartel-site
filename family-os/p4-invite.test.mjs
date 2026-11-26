// Family OS bus 172 P4 — invite cancel, the owner's daily invite cap, and the first-login onboarding mark
// (synthetic people only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { planInvites } from "./engine.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-p4-invite-secret-at-least-32-chars!!!";
const TODAY = "2026-11-26";
let server, base, store, clockAt = `${TODAY}T10:00:00Z`;
const ADMIN = "admin:admin@example.test", as = (k) => `member:${E[k]}`;
const E = { a: "anna@example.test", b: "boris@example.test", c: "vera@example.test" };
const P = {};
async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* none */ }
  return { status: r.status, json };
}
const invite = async (id) => (await call("GET", "/adoption")).json.people.find((x) => x.id === id).invite;
before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date(clockAt) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["a", "adult"], ["b", "adult"], ["c", "child"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
});
after(() => server.close());

test("cancel: owner only; an unsent letter is never planned; cancel twice → 404; the person stays", async () => {
  assert.equal((await call("POST", `/people/${P.a}/invite`, { body: {} })).status, 202);
  assert.equal((await call("DELETE", `/people/${P.a}/invite`, { actor: as("b") })).status, 403);
  assert.equal((await call("DELETE", `/people/00000000-0000-4000-8000-000000000000/invite`)).status, 404);
  assert.equal((await call("DELETE", `/people/${P.a}/invite`)).status, 200);
  assert.deepEqual(await invite(P.a), { on_date: TODAY, sent: false, sent_at: null, cancelled: true });
  assert.equal((await store.pendingInvites("2026-11-20")).length, 0, "the runner's queue no longer holds it");
  assert.equal((await call("DELETE", `/people/${P.a}/invite`)).status, 404, "nothing left to cancel");
  assert.ok((await call("GET", "/people")).json.people.some((p) => p.id === P.a), "cancelling never removes the person");
  assert.equal(routeClass(`/people/${P.a}/invite`), "/people/:id/invite");
});

test("re-invite on the day of a cancel re-opens it; a second request is 409; an already-sent letter is never sent twice a day", async () => {
  assert.equal((await call("POST", `/people/${P.a}/invite`, { body: {} })).status, 202);
  assert.deepEqual(await invite(P.a), { on_date: TODAY, sent: false, sent_at: null, cancelled: false });
  assert.equal((await call("POST", `/people/${P.a}/invite`, { body: {} })).status, 409);
  const people = [{ id: P.a, email: E.a, name_ru: "Анна QA", name_en: "Anna QA" }];
  assert.equal(planInvites(await store.pendingInvites("2026-11-20"), people, new Map(), new Date(clockAt)).length, 1, "never sent: it goes");
  await store.markInviteSent((await store.pendingInvites("2026-11-20"))[0].id);
  assert.equal((await call("DELETE", `/people/${P.a}/invite`)).status, 200);
  assert.equal((await call("POST", `/people/${P.a}/invite`, { body: {} })).status, 202);
  assert.equal((await store.pendingInvites("2026-11-20")).length, 0, "already sent today: cancel → invite sends no second letter");
});

test("the owner's daily cap: at most 10 invitation requests a day → 429", async () => {
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push((await call("POST", "/people", { body: { email: `qa${i}@example.test`, name_en: `QA${i}`, name_ru: `QA${i}`, kind: "adult" } })).json.id);
  let ok = 0, capped = 0;
  for (const id of ids) { const s = (await call("POST", `/people/${id}/invite`, { body: {} })).status; if (s === 202) ok++; if (s === 429) capped++; }
  assert.equal(ok + 1, 10, "the one sent above counts towards today's 10"); assert.equal(capped, 1);
  clockAt = "2026-11-27T10:00:00Z";
  assert.equal((await call("POST", `/people/${ids.at(-1)}/invite`, { body: {} })).status, 202, "a new family day, a new budget");
  clockAt = `${TODAY}T10:00:00Z`;
});

test("onboarding: /me says false until POST /onboarding (with or without a noted sign-in), then true — own address only", async () => {
  assert.equal((await call("GET", "/me", { actor: as("a") })).json.onboarded, false, "no sign-in noted yet: not onboarded");
  assert.equal((await call("POST", "/onboarding", { actor: as("a") })).status, 200);
  assert.equal((await call("GET", "/me", { actor: as("a") })).json.onboarded, true, "the mark creates the row when the sign-in note is late");
  await call("POST", "/signins", { actor: as("a") });
  assert.equal((await call("GET", "/me", { actor: as("a") })).json.onboarded, true, "a later sign-in note keeps it");
  await call("POST", "/signins", { actor: as("c") });
  assert.equal((await call("GET", "/me", { actor: as("c") })).json.onboarded, false);
  assert.equal((await call("POST", "/onboarding", { actor: as("c"), body: { email: E.b } })).status, 200);
  assert.equal((await call("GET", "/me", { actor: as("c") })).json.onboarded, true);
  await call("POST", "/signins", { actor: as("b") });
  assert.equal((await call("GET", "/me", { actor: as("b") })).json.onboarded, false, "a body never marks someone else");
  assert.equal((await call("POST", "/onboarding", { actor: as("c") })).status, 200, "idempotent");
  assert.equal((await call("POST", "/onboarding")).status, 403, "the owner who is not a person has no tour");
  assert.ok(!("onboarded" in (await call("GET", "/me")).json), "not sent for a non-member");
  assert.equal(routeClass("/onboarding"), "/onboarding");
});

test("schema: the backfill runs once (schema_migration) and marks only people who had already signed in", () => {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  const tail = schema.slice(schema.indexOf("bus 172 P4"));
  assert.match(tail, /IF NOT EXISTS \(SELECT 1 FROM schema_migration WHERE name = '2026-11-26-onboarded-backfill'\)/);
  assert.match(tail, /UPDATE signin_seen SET onboarded_on = first_on WHERE onboarded_on IS NULL;/);
  assert.match(tail, /ADD COLUMN IF NOT EXISTS onboarded_on date;/, "a date, not a time");
});
