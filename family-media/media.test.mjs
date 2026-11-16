// Run: npm test (includes family-media/*.test.mjs). No database, no network: memory store, temp dir.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createApp } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { validateEvent } from "./validate.mjs";
// The SITE's signer — the exact module app/lib/family-media.ts uses.
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "media-test-secret-at-least-32-characters";
const ADMIN = "admin@example.com";
let server, base, dir;

async function call(method, path, { body = "", actor = ADMIN, secret = SECRET, headers = {} } = {}) {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  const h = await signMediaRequest({ secret, method, path, actor, body: bytes });
  return fetch(base + path, { method, headers: { ...h, ...headers }, body: method === "GET" ? undefined : bytes });
}
const jpegWithExif = () => sharp({ create: { width: 1600, height: 1000, channels: 3, background: { r: 120, g: 30, b: 45 } } })
  .withMetadata({ exif: { IFD0: { Copyright: "qa-marker", Artist: "qa-marker" } } }).jpeg().toBuffer();

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "kfm-"));
  server = createServer(createApp({ store: memoryStore(), mediaDir: dir, secret: SECRET })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await rm(dir, { recursive: true, force: true }); });

test("health is open; everything else needs a signature", async () => {
  assert.equal((await fetch(base + "/healthz")).status, 200);
  assert.equal((await fetch(base + "/content?state=published")).status, 401);
  assert.equal((await call("GET", "/content?state=published", { secret: "x".repeat(40) })).status, 401);
});

test("a signature is bound to its path and usable once", async () => {
  const h = await signMediaRequest({ secret: SECRET, method: "GET", path: "/content?state=published", actor: ADMIN });
  assert.equal((await fetch(base + "/content?state=published", { headers: h })).status, 200);
  assert.equal((await fetch(base + "/content?state=published", { headers: h })).status, 401, "replay refused");
  const h2 = await signMediaRequest({ secret: SECRET, method: "GET", path: "/content?state=published", actor: ADMIN });
  assert.equal((await fetch(base + "/content?state=draft", { headers: h2 })).status, 401, "path swap refused");
});

test("upload: EXIF stripped, only re-encoded variants stored, original discarded", async () => {
  const src = await jpegWithExif();
  assert.ok((await sharp(src).metadata()).exif, "fixture carries EXIF");
  const r = await call("POST", "/media", { body: src });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const files = (await readdir(join(dir, id))).sort();
  assert.deepEqual(files, ["1280.avif", "1280.webp", "256.avif", "256.webp", "640.avif", "640.webp"]);
  for (const f of files) {
    const meta = await sharp(join(dir, id, f)).metadata();
    assert.equal(meta.exif, undefined, `${f} has no EXIF`);
    assert.ok(meta.width <= Number(f.split(".")[0]));
  }
});

test("upload refuses non-images and oversize bodies", async () => {
  assert.equal((await call("POST", "/media", { body: new TextEncoder().encode("GIF89a not really an image at all") })).status, 415);
  const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
  assert.equal((await call("POST", "/media", { body: fake })).status, 422, "JPEG magic but undecodable");
  assert.equal((await call("POST", "/media", { body: Buffer.alloc(4 * 1024 * 1024 + 10, 0xff) })).status, 413);
});

test("draft → publish → undo; viewers see only published media", async () => {
  const up = await (await call("POST", "/media", { body: await jpegWithExif() })).json();
  // unknown media ids are refused
  assert.equal((await call("PUT", "/draft/person/root", { body: JSON.stringify({ portrait: "00000000-0000-4000-8000-000000000000" }) })).status, 422);
  assert.equal((await call("PUT", "/draft/person/root", { body: JSON.stringify({ portrait: up.id, altEN: "", altRU: "" }) })).status, 200);
  // not yet published: a viewer cannot fetch it, the admin can
  assert.equal((await call("GET", `/media/${up.id}/256.webp?scope=published`, { actor: "" })).status, 404);
  const adm = await call("GET", `/media/${up.id}/256.webp?scope=admin`);
  assert.equal(adm.status, 200);
  assert.equal(adm.headers.get("cache-control"), "private, no-store");
  // publish → viewer can fetch
  assert.equal((await call("POST", "/publish")).status, 200);
  assert.equal((await call("GET", `/media/${up.id}/640.avif?scope=published`, { actor: "" })).status, 200);
  // a second edit, then undo restores the first
  await call("PUT", "/draft/person/root", { body: JSON.stringify({ portrait: null, altEN: "changed" }) });
  const u = await (await call("POST", "/undo")).json();
  assert.equal(u.undone, "person:root");
  const d = await (await call("GET", "/content?state=draft")).json();
  assert.equal(d.content.persons.root.portrait, up.id);
  const audit = await (await call("GET", "/audit")).json();
  assert.ok(audit.entries.some((e) => e.action === "draft.undo") && audit.entries.every((e) => !("after" in e)), "audit: who/when/what, no bodies");
});

test("writes need an actor; viewers (no actor) cannot write", async () => {
  assert.equal((await call("POST", "/publish", { actor: "" })).status, 403);
  assert.equal((await call("PUT", "/draft/event/x", { actor: "", body: "{}" })).status, 403);
});

test("validation: partial dates, plain text, limits", () => {
  assert.equal(validateEvent({ dateFrom: "1955", dateTo: "2026-01" }).dateTo, "2026-01");
  assert.throws(() => validateEvent({ dateFrom: "55" }), /YYYY/);
  assert.throws(() => validateEvent({ dateFrom: "2000", dateTo: "1999" }), /earlier/);
  assert.throws(() => validateEvent({ storyEN: "x".repeat(6001) }), /longer/);
  assert.throws(() => validateEvent({ photos: Array(9).fill({ id: "00000000-0000-4000-8000-000000000000" }) }), /at most/);
  assert.equal(validateEvent({ storyEN: "a\r\nb\u0007" }).storyEN, "a\nb", "CRLF normalised, control chars dropped");
});
