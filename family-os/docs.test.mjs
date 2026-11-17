// Family OS Stage 2a — document vault (synthetic people and files only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createApp, sniffDoc } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-docs-secret-at-least-32-characters!!";
let server, base, store, dir;
const ADMIN = "admin:admin@example.test", as = (e) => `member:${e}`;
const P = {};

async function call(method, path, { body, actor = ADMIN, raw, headers = {} } = {}) {
  const payload = raw ?? (body === undefined ? "" : JSON.stringify(body));
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: payload });
  const r = await fetch(base + path, { method, headers: { ...h, ...headers, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : payload });
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null; try { json = JSON.parse(buf.toString("utf8")); } catch { /* binary */ }
  return { status: r.status, json, buf, type: r.headers.get("content-type") };
}
const upload = (docId, bytes, actor = ADMIN, name = "scan.jpg") => call("POST", `/documents/${docId}/files`, { raw: bytes, actor, headers: { "x-file-name": Buffer.from(name).toString("base64url") } });
const soon = (days) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "kfo-docs-"));
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), filesDir: dir })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, email, kind] of [["p1", "parent1@example.test", "adult"], ["p2", "parent2@example.test", "adult"], ["c", "child@example.test", "child"], ["e", "eldest@example.test", "adult"], ["g", "grandma@example.test", "adult"]]) {
    P[k] = (await call("POST", "/people", { body: { email, name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  }
  for (const k of ["p1", "p2"]) await call("POST", "/grants", { body: { guardian_id: P[k], child_id: P.c, relation: "parent", scopes: ["routines", "health", "education", "documents"] } });
  await call("PATCH", `/people/${P.c}`, { body: { birth_date: "2015-03-04" } });
});
after(async () => { server.close(); await rm(dir, { recursive: true, force: true }); });

test("sniffing: PDF/JPEG/PNG/HEIC accepted, everything else refused", () => {
  assert.equal(sniffDoc(Buffer.from("%PDF-1.7\n....")), "application/pdf");
  assert.equal(sniffDoc(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), "image/jpeg");
  assert.equal(sniffDoc(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(8)])), "image/heic");
  assert.equal(sniffDoc(Buffer.from("PK\u0003\u0004 a zip file....")), null);
  assert.equal(sniffDoc(Buffer.from("<html><script>alert(1)</script>")), null);
});

let childPassport;
test("documents: admin adds for anyone; numbers stored encrypted; residence keeps type + file only", async () => {
  const r = await call("POST", `/people/${P.c}/documents`, { body: { type: "passport", country: "QA", number: "QA1234567", personal_code: "999999-99999", holder: "QA Child", birth_date: "2015-03-04", issue_date: "2020-01-01", expiry_date: soon(60), authority: "QA authority" } });
  assert.equal(r.status, 201); childPassport = r.json.id;
  const row = store._raw.docs().get(childPassport);
  assert.equal(row.number_hint, "567");
  for (const col of ["number_ct", "pcode_ct", "fields_ct"]) assert.ok(!row[col].includes("QA1234567") && !row[col].includes("999999") && !row[col].includes("QA Child"), `${col} is ciphertext`);
  const res = await call("POST", `/people/${P.e}/documents`, { body: { type: "residence", country: "GB", number: "IGNORED", holder: "ignored", expiry_date: soon(400) } });
  assert.equal(res.status, 201);
  const rr = store._raw.docs().get(res.json.id);
  assert.equal(rr.number_ct, null); assert.equal(rr.issue_date, null);
  assert.equal((await call("POST", `/people/${P.c}/documents`, { body: { type: "visa" } })).json.error, "bad_type");
});

test("IDOR: who can list a child's documents — holder, both parents; not grandma, eldest, admin, outsider", async () => {
  const expect = { "child@example.test": 200, "parent1@example.test": 200, "parent2@example.test": 200, "grandma@example.test": 403, "eldest@example.test": 403, "stranger@example.test": 403 };
  for (const [e, code] of Object.entries(expect)) assert.equal((await call("GET", `/people/${P.c}/documents`, { actor: as(e) })).status, code, e);
  assert.equal((await call("GET", `/people/${P.c}/documents`)).status, 403, "admin is not an implicit reader");
  const l = await call("GET", `/people/${P.c}/documents`, { actor: as("parent1@example.test") });
  assert.equal(l.json.documents[0].number_hint, "567"); assert.equal(l.json.documents[0].number, undefined, "list never carries the number");
});

test("IDOR: an adult's documents are hers alone — not even a parent", async () => {
  assert.equal((await call("GET", `/people/${P.e}/documents`, { actor: as("eldest@example.test") })).status, 200);
  for (const e of ["parent1@example.test", "parent2@example.test", "child@example.test", "grandma@example.test"]) assert.equal((await call("GET", `/people/${P.e}/documents`, { actor: as(e) })).status, 403, e);
});

test("files: upload stripped of EXIF, stored encrypted on disk, served only through the read path", async () => {
  const jpg = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#888" } }).withMetadata({ exif: { IFD0: { Copyright: "qa-exif-marker" } } }).jpeg().toBuffer();
  assert.ok((await sharp(jpg).metadata()).exif, "fixture has EXIF");
  const u = await upload(childPassport, jpg, as("parent1@example.test"), "QA passport scan.jpg");
  assert.equal(u.status, 201);
  const onDisk = await readFile(join(dir, u.json.id));
  assert.ok(!onDisk.includes(Buffer.from("JFIF")) && !onDisk.includes(Buffer.from("qa-exif-marker")), "disk holds ciphertext only");
  const got = await call("GET", `/documents/${childPassport}/files/${u.json.id}`, { actor: as("parent2@example.test") });
  assert.equal(got.status, 200); assert.equal(got.type, "image/jpeg");
  assert.equal((await sharp(got.buf).metadata()).exif, undefined, "no EXIF in what is served");
  for (const e of ["grandma@example.test", "eldest@example.test"]) assert.equal((await call("GET", `/documents/${childPassport}/files/${u.json.id}`, { actor: as(e) })).status, 403);
  assert.equal((await call("GET", `/documents/${childPassport}/files/${u.json.id}`)).status, 403, "admin uploads but does not read");
  const l = await call("GET", `/people/${P.c}/documents`, { actor: as("child@example.test") });
  assert.equal(l.json.documents[0].files[0].name, "QA passport scan.jpg");
  const names = (await readdir(dir)).join(",");
  assert.ok(!names.includes("passport"), "file names on disk are random ids");
});

test("files: refused types and sizes", async () => {
  assert.equal((await upload(childPassport, Buffer.from("PK\u0003\u0004zip-bytes..........."))).status, 415);
  assert.equal((await upload(childPassport, Buffer.from("<svg onload=alert(1)></svg>........"))).status, 415);
  assert.equal((await upload(childPassport, Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(10 * 1024 * 1024)]))).status, 413);
  assert.equal((await upload(childPassport, Buffer.from("%PDF-1.7 tiny"), as("grandma@example.test"))).status, 403);
});

test("reveal and copy: allowed readers only; every one logged; fail-closed", async () => {
  const before = (await store.accessLog()).length;
  const r = await call("POST", `/documents/${childPassport}/reveal`, { actor: as("parent2@example.test"), body: { field: "number" } });
  assert.equal(r.json.value, "QA1234567");
  assert.equal((await call("POST", `/documents/${childPassport}/reveal`, { actor: as("parent2@example.test"), body: { field: "personal_code" } })).json.value, "999999-99999");
  assert.equal((await call("POST", `/documents/${childPassport}/copied`, { actor: as("parent2@example.test"), body: { field: "number" } })).status, 200);
  const log = (await store.accessLog()).slice(0, 3).map((x) => x.action);
  assert.deepEqual(log.sort(), ["copy", "reveal", "reveal"]);
  assert.equal((await store.accessLog()).length, before + 3);
  assert.equal((await call("POST", `/documents/${childPassport}/reveal`, { actor: as("grandma@example.test"), body: { field: "number" } })).status, 403);
  assert.equal((await call("POST", `/documents/${childPassport}/reveal`, { body: { field: "number" } })).status, 403, "admin cannot reveal");
  store.failLog = true;
  const f = await call("POST", `/documents/${childPassport}/reveal`, { actor: as("parent1@example.test"), body: { field: "number" } });
  assert.equal(f.status, 503); assert.equal(f.json.value, undefined);
  store.failLog = false;
});

test("profile: birth date only for self, guardians, admin", async () => {
  for (const [e, sees] of [["child@example.test", true], ["parent1@example.test", true], ["grandma@example.test", false], ["eldest@example.test", false]]) {
    const r = await call("GET", `/people/${P.c}`, { actor: as(e) });
    assert.equal(r.status, 200); assert.equal("birth_date" in r.json.person, sees, e);
  }
  assert.equal((await call("GET", `/people/${P.c}`)).json.person.birth_date, "2015-03-04");
  assert.equal((await call("GET", `/people/${P.c}`, { actor: as("stranger@example.test") })).status, 403);
});

test("reminders: expiring within ~6 months, only for people I may read", async () => {
  const p = await call("GET", "/reminders", { actor: as("parent1@example.test") });
  assert.deepEqual(p.json.reminders.map((x) => x.id), [childPassport]);
  assert.deepEqual((await call("GET", "/reminders", { actor: as("grandma@example.test") })).json.reminders, []);
  assert.deepEqual((await call("GET", "/reminders", { actor: as("eldest@example.test") })).json.reminders, [], "her residence card expires later than 6 months");
});

test("archive records: admin only", async () => {
  const a = await call("POST", "/archive/documents", { body: { type: "passport", country: "QA", number: "QA0000001", holder: "QA archive" } });
  assert.equal(a.status, 201);
  assert.equal((await call("GET", "/archive/documents")).json.documents.length, 1);
  assert.equal((await call("GET", "/archive/documents", { actor: as("parent1@example.test") })).status, 403);
  assert.equal((await call("POST", `/documents/${a.json.id}/reveal`, { actor: as("parent1@example.test"), body: { field: "number" } })).status, 403);
});
