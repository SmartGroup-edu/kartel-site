// Run: npm test (includes family-media/*.test.mjs). No database, no network: memory store, temp dir.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createApp, routeClass } from "./server.mjs";
import { processImage, WIDTHS } from "./images.mjs";
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

test("request log route class never carries keys, ids or query values", () => {
  assert.equal(routeClass("/draft/person/somekey"), "/draft/:kind/:key");
  assert.equal(routeClass("/media/11111111-1111-4111-8111-111111111111/640.webp?scope=admin"), "/media/:id/:variant");
  assert.equal(routeClass("/content?state=draft"), "/content");
  assert.equal(routeClass("/publish"), "/publish");
  assert.equal(routeClass("/anything/else/here"), "/:other");
  assert.equal(routeClass("/"), "/");
  for (const p of ["/draft/event/x1y2", "/media/abc/def", "/zzz/secret-looking"]) assert.doesNotMatch(routeClass(p), /x1y2|abc|def|secret/);
});

// R0 2026-11-16 "photo trimmed too much": the service must not crop. Every variant keeps the upload's
// aspect, and a marked region keeps its relative position. Synthetic images only.

async function marked(w, h, { orientation } = {}) {
  // Grey canvas with a red "face" block centred across, 10–25 % from the top.
  const fx = Math.round(w * 0.4), fy = Math.round(h * 0.1), fw = Math.round(w * 0.2), fh = Math.round(h * 0.15);
  const face = await sharp({ create: { width: fw, height: fh, channels: 3, background: { r: 220, g: 20, b: 20 } } }).png().toBuffer();
  let img = sharp({ create: { width: w, height: h, channels: 3, background: { r: 128, g: 128, b: 128 } } }).composite([{ input: face, left: fx, top: fy }]).jpeg({ quality: 92 });
  if (orientation) img = img.withMetadata({ orientation });
  return img.toBuffer();
}
const isRed = ({ r, g, b }) => r > 170 && g < 90 && b < 90;
async function pixel(buf, fx, fy) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const x = Math.min(info.width - 1, Math.round(fx * info.width)), y = Math.min(info.height - 1, Math.round(fy * info.height));
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

for (const [name, w, h] of [["4:5 cropped portrait", 1024, 1280], ["3:4 portrait", 1500, 2000], ["4:3 group", 2000, 1500], ["9:16 phone", 1080, 1920], ["4:1 panorama", 4000, 1000]]) {
  test(`service keeps ${name} whole: aspect and marked region preserved in every variant`, async () => {
    const out = await processImage(await marked(w, h));
    for (const vw of WIDTHS) {
      for (const f of ["webp", "avif"]) {
        const m = await sharp(out.variants[`${vw}.${f}`]).metadata();
        assert.ok(Math.max(m.width, m.height) <= vw, `${vw}.${f} within its box`);
        assert.ok(Math.abs(m.width / m.height - w / h) < 0.02, `${vw}.${f} aspect ${m.width}x${m.height} vs ${w}x${h}`);
      }
      const v = out.variants[`${vw}.webp`];
      assert.ok(isRed(await pixel(v, 0.5, 0.175)), `${vw}: face block still at the top centre`);
      assert.ok(!isRed(await pixel(v, 0.5, 0.6)), `${vw}: nothing shifted down`);
    }
  });
}

test("EXIF orientation is applied before anything else, then stripped", async () => {
  // Stored 400×300 with orientation 6 (rotate 90° clockwise to view) → viewed as 300×400.
  const out = await processImage(await marked(400, 300, { orientation: 6 }));
  const m = await sharp(out.variants["1280.webp"]).metadata();
  assert.equal(m.width, 300); assert.equal(m.height, 400);
  assert.equal(m.exif, undefined); assert.equal(m.orientation, undefined);
});
