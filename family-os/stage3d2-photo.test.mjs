// Family OS Stage 3d-2 — optional review photo (bus 84/97 item 4; synthetic people only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { canAddPhoto, canSeePhoto, purgePhotos, PHOTO_DAYS, photoFile } from "./photo.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-stage3d2p-secret-at-least-32-chars!";
const TODAY = "2026-11-18";
let server, base, store, dir, clockAt = new Date(`${TODAY}T10:00:00Z`);
const ADMIN = "admin:admin@example.test", as = (k) => `member:${E[k]}`;
const E = { p1: "parent1@example.test", p2: "parent2@example.test", c: "child@example.test", e: "adult@example.test", g: "relative@example.test" };
const P = {};
async function call(method, path, { body, actor = ADMIN, raw } = {}) {
  const payload = raw ?? (body === undefined ? "" : JSON.stringify(body));
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: payload });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? {} : payload ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : payload });
  const buf = Buffer.from(await r.arrayBuffer()); let json = null; try { json = JSON.parse(buf.toString()); } catch { /* bytes */ }
  return { status: r.status, json, buf, type: r.headers.get("content-type") };
}
let jpeg;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "kfo-photo-"));
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), filesDir: dir, clock: () => clockAt })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["p2", "adult"], ["c", "child"], ["e", "adult"], ["g", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  for (const k of ["p1", "p2"]) await call("POST", "/grants", { body: { guardian_id: P[k], child_id: P.c, relation: "parent", scopes: ["routines"] } });
  await call("POST", "/grants", { body: { guardian_id: P.g, child_id: P.c, relation: "relative", scopes: ["routines"] } });
  jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#7b1e2d" } }).withExif({ IFD0: { Artist: "QA-EXIF-MARKER", Copyright: "QA-EXIF-MARKER" } }).jpeg().toBuffer();
});
after(async () => { server.close(); await rm(dir, { recursive: true, force: true }); });

/** A board task for the child, made through the API, then moved to `state` directly in the store. */
async function task(state, needs_review = true) {
  const id = (await call("POST", `/plan/${TODAY}/tasks`, { actor: as("p1"), body: { title: "QA Убрать комнату", assignee_id: P.c, due_time: "18:00", needs_review } })).json.id;
  assert.ok(id, "task created");
  if (state !== "proposed") assert.ok(await store.moveTask(id, "proposed", state), `moved to ${state}`);
  return id;
}

test("pure: who may add (participant or the child's parent, review tasks, before review) and who may see (parents)", () => {
  const me = (id) => ({ id }), grants = [{ guardian_id: "p", child_id: "c", relation: "parent" }, { guardian_id: "g", child_id: "c", relation: "relative" }];
  const child = { id: "c", kind: "child" }, t = (state, nr = true) => ({ state, needs_review: nr, assignee_id: "c", co_ids: [] });
  assert.equal(canAddPhoto(me("c"), t("in_progress"), child, grants), true);
  assert.equal(canAddPhoto(me("p"), t("done"), child, grants), true);
  assert.equal(canAddPhoto(me("g"), t("done"), child, grants), false, "a relative cannot");
  assert.equal(canAddPhoto(me("c"), t("done", false), child, grants), false, "only review tasks");
  assert.equal(canAddPhoto(me("c"), t("reviewed"), child, grants), false, "not after review");
  assert.equal(canAddPhoto(me("c"), t("approved"), child, grants), false, "not before acceptance");
  assert.equal(canSeePhoto(me("p"), grants), true); assert.equal(canSeePhoto(me("c"), grants), false); assert.equal(canSeePhoto(me("g"), grants), false);
  assert.equal(PHOTO_DAYS, 7);
});

test("upload: EXIF gone, sealed on disk, 7-day date; parents read it (logged); the child, a relative and another adult cannot", async () => {
  const id = await task("in_progress");
  const up = await call("POST", `/tasks/${id}/photo`, { actor: as("c"), raw: jpeg });
  assert.equal(up.status, 201); assert.equal(up.json.delete_after, "2026-11-25");
  const files = await readdir(dir);
  assert.equal(files.length, 1); assert.match(files[0], /^photo-[0-9a-f-]{36}$/);
  const disk = await readFile(join(dir, files[0]));
  assert.ok(!disk.includes(Buffer.from("QA-EXIF-MARKER")) && !disk.includes(Buffer.from([0xff, 0xd8, 0xff])), "sealed: neither the EXIF text nor a JPEG header on disk");
  for (const k of ["c", "g", "e"]) assert.equal((await call("GET", `/tasks/${id}/photo`, { actor: as(k) })).status, 403, k);
  const logBefore = (await store.accessLog()).length;
  const got = await call("GET", `/tasks/${id}/photo`, { actor: as("p2") });
  assert.equal(got.status, 200); assert.equal(got.type, "image/jpeg");
  assert.ok(!got.buf.includes(Buffer.from("QA-EXIF-MARKER")), "no EXIF survives");
  assert.equal((await sharp(got.buf).metadata()).exif, undefined);
  assert.equal((await store.accessLog()).length, logBefore + 1, "the read is logged");
  // drawer: the child may add, but never learns a photo exists; a parent sees the date
  const dc = (await call("GET", `/tasks/${id}`, { actor: as("c") })).json.photo;
  assert.deepEqual(dc, { can_add: true });
  const dp = (await call("GET", `/tasks/${id}`, { actor: as("p1") })).json.photo;
  assert.deepEqual(dp, { can_add: true, has: true, delete_after: "2026-11-25" });
  assert.deepEqual((await call("GET", `/tasks/${id}`, { actor: as("g") })).json?.photo ?? { can_add: false }, { can_add: false });
});

test("refusals: not a review task, wrong state, wrong person, wrong type, too large; a new photo replaces the old", async () => {
  const plain = await task("accepted", false); // one task «в работе» per person: the upload test holds it
  assert.equal((await call("POST", `/tasks/${plain}/photo`, { actor: as("c"), raw: jpeg })).json.error, "no_review");
  const early = await task("approved");
  assert.equal((await call("POST", `/tasks/${early}/photo`, { actor: as("c"), raw: jpeg })).status, 403);
  const id = await task("done");
  assert.equal((await call("POST", `/tasks/${id}/photo`, { actor: as("g"), raw: jpeg })).status, 403, "a relative cannot add");
  assert.equal((await call("POST", `/tasks/${id}/photo`, { actor: as("e"), raw: jpeg })).status, 403, "another adult cannot add");
  assert.equal((await call("POST", `/tasks/${id}/photo`, { actor: as("c"), raw: Buffer.from("%PDF-1.7 not an image") })).status, 415);
  // Over 10 MB: the body reader answers 413 or cuts the connection mid-upload (as for documents) — refused either way.
  const big = await call("POST", `/tasks/${id}/photo`, { actor: as("c"), raw: Buffer.alloc(10 * 1024 * 1024 + 1, 0xff) }).catch(() => ({ status: "reset" }));
  assert.ok([413, "reset"].includes(big.status), String(big.status));
  assert.equal(store._raw.photos().filter((p) => p.task_id === id).length, 0, "nothing stored");
  assert.equal((await call("POST", `/tasks/${id}/photo`, { actor: as("p1"), raw: jpeg })).status, 201, "a parent may add for the child");
  const before = (await readdir(dir)).length;
  assert.equal((await call("POST", `/tasks/${id}/photo`, { actor: as("c"), raw: jpeg })).status, 201);
  assert.equal((await readdir(dir)).length, before, "the old file is removed when replaced");
  assert.equal(store._raw.photos().filter((p) => p.task_id === id && !p.deleted_at).length, 1);
  assert.equal(routeClass(`/tasks/${id}/photo`), "/tasks/:id/photo");
});

test("7-day deletion: purgePhotos removes the file and marks the row; nothing younger is touched; the read then 404s", async () => {
  const id = await task("done");
  await call("POST", `/tasks/${id}/photo`, { actor: as("c"), raw: jpeg });
  const mine = store._raw.photos().find((p) => p.task_id === id && !p.deleted_at);
  assert.equal(await purgePhotos({ store, filesDir: dir, now: new Date("2026-11-25T09:59:00Z") }), 0, "not before seven days");
  const n = await purgePhotos({ store, filesDir: dir, now: new Date("2026-11-25T10:00:00Z") });
  assert.ok(n >= 1);
  assert.ok(mine.deleted_at, "row marked");
  assert.ok(!(await readdir(dir)).includes(photoFile(mine.id)), "file gone");
  assert.equal((await call("GET", `/tasks/${id}/photo`, { actor: as("p1") })).status, 404);
  assert.equal(await purgePhotos({ store, filesDir: dir, now: new Date("2026-12-31T10:00:00Z") }), 0, "already-deleted rows are not redone");
});

test("schema + privileges: the 7-day limit is a DB check; one active photo per task; kfo_app has no DELETE", async () => {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8"), roles = await readFile(new URL("./roles.sql", import.meta.url), "utf8");
  assert.match(schema, /CHECK \(delete_after <= uploaded_at \+ interval '7 days'\)/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS task_photo_one_active ON task_photo \(task_id\) WHERE deleted_at IS NULL;/);
  assert.match(roles, /GRANT SELECT, INSERT, UPDATE \(deleted_at\) ON task_photo TO kfo_app;/);
  assert.doesNotMatch(roles, /GRANT[^;]*DELETE[^;]* ON [^;]*\btask_photo\b/);
  const runner = await readFile(new URL("./runner.mjs", import.meta.url), "utf8");
  assert.match(runner, /await purgePhotos\(\{ store: pgStore\(pool\)/, "the runner deletes on every tick");
});
