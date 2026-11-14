// Run: node --test relay/relay.test.mjs   (no network: Brevo is mocked locally)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

const SECRET = "relay-test-secret-at-least-32-characters";
const PREFIX = "https://kartel.org.uk/api/family-auth/verify?token=";
let brevoCalls = [];
let brevo, relay, base;

// Same signing as app/lib/family-mail.ts (WebCrypto), to prove the two sides agree.
async function siteSign(secret, data) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function send(payload, { secret = SECRET, tsOffset = 0 } = {}) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000) + tsOffset);
  const sig = await siteSign(secret, `${ts}.${body}`);
  return fetch(base + "/send", { method: "POST", headers: { "content-type": "application/json", "x-kartel-ts": ts, "x-kartel-sig": sig }, body });
}

before(async () => {
  brevo = createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { brevoCalls.push({ key: req.headers["api-key"], body: JSON.parse(b) }); res.writeHead(201); res.end("{}"); });
  }).listen(0);
  await new Promise((r) => brevo.once("listening", r));
  Object.assign(process.env, {
    RELAY_SECRET: SECRET, BREVO_API_KEY: "test-key", RELAY_NO_LISTEN: "1",
    BREVO_ENDPOINT: `http://127.0.0.1:${brevo.address().port}/`,
  });
  ({ server: relay } = await import("./server.mjs"));
  relay.listen(0);
  await new Promise((r) => relay.once("listening", r));
  base = `http://127.0.0.1:${relay.address().port}`;
});
after(() => { relay.close(); brevo.close(); });

test("valid signed request is sent through Brevo with the house sender", async () => {
  brevoCalls = [];
  const r = await send({ to: "Member@Example.com", link: PREFIX + "abc" });
  assert.equal(r.status, 202);
  assert.equal(brevoCalls.length, 1);
  assert.equal(brevoCalls[0].key, "test-key");
  assert.equal(brevoCalls[0].body.to[0].email, "member@example.com");
  assert.equal(brevoCalls[0].body.sender.email, "no-reply@mail.kartel.org.uk");
  assert.match(brevoCalls[0].body.htmlContent, /verify\?token=abc/);
});
test("wrong secret → 401, nothing sent", async () => {
  brevoCalls = [];
  const r = await send({ to: "a@example.com", link: PREFIX + "x" }, { secret: "x".repeat(40) });
  assert.equal(r.status, 401); assert.equal(brevoCalls.length, 0);
});
test("stale timestamp → 401", async () => {
  const r = await send({ to: "a@example.com", link: PREFIX + "x" }, { tsOffset: -120 });
  assert.equal(r.status, 401);
});
test("foreign link → 400 (not a general relay)", async () => {
  brevoCalls = [];
  const r = await send({ to: "a@example.com", link: "https://evil.example/phish" });
  assert.equal(r.status, 400); assert.equal(brevoCalls.length, 0);
});
test("prefix-lookalike host → 400", async () => {
  const r = await send({ to: "a@example.com", link: "https://kartel.org.uk.evil.example/api/family-auth/verify?token=x" });
  assert.equal(r.status, 400);
});
test("bad recipient → 400", async () => {
  const r = await send({ to: "not-an-email", link: PREFIX + "x" });
  assert.equal(r.status, 400);
});
test("per-recipient limit: 4th within the hour → 429", async () => {
  const to = "limit@example.com";
  for (let i = 0; i < 3; i++) assert.equal((await send({ to, link: PREFIX + i })).status, 202);
  assert.equal((await send({ to, link: PREFIX + "4" })).status, 429);
});
test("unsigned request and other paths are refused", async () => {
  assert.equal((await fetch(base + "/send", { method: "POST", body: "{}" })).status, 401);
  assert.equal((await fetch(base + "/")).status, 404);
  assert.equal((await fetch(base + "/healthz")).status, 200);
});
