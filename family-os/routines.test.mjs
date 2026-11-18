// Family OS Stage 2 — routines and chores, guardians, admin edits, document retype, HEIC metadata
// (synthetic people and files only).
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { routineAccess, canSeeGuardians } from "./policy.mjs";
import { parseRule, occursOn, occurrences, streak, localDate, addDays } from "./recur.mjs";
import { stripHeifMetadata } from "./heif.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-routines-secret-at-least-32-chars!!";
const TODAY = "2026-11-18"; // a Wednesday; the service clock is pinned to it
let server, base, store, dir;
const ADMIN = "admin:admin@example.test", as = (e) => `member:${e}`;
const E = { p1: "parent1@example.test", p2: "parent2@example.test", c: "child@example.test", e: "adult@example.test", g: "relative@example.test", x: "outsider@example.test" };
const P = {};

async function call(method, path, { body, actor = ADMIN, raw, headers = {} } = {}) {
  const payload = raw ?? (body === undefined ? "" : JSON.stringify(body));
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: payload });
  const r = await fetch(base + path, { method, headers: { ...h, ...headers, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : payload });
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null; try { json = JSON.parse(buf.toString("utf8")); } catch { /* binary */ }
  return { status: r.status, json, buf };
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "kfo-rt-"));
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), filesDir: dir, clock: () => new Date(`${TODAY}T10:00:00Z`) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["p2", "adult"], ["c", "child"], ["e", "adult"], ["g", "adult"]]) {
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  }
  for (const k of ["p1", "p2"]) await call("POST", "/grants", { body: { guardian_id: P[k], child_id: P.c, relation: "parent", scopes: ["routines", "health", "education", "documents"] } });
  P.gGrant = (await call("POST", "/grants", { body: { guardian_id: P.g, child_id: P.c, relation: "relative", scopes: ["health"] } })).json.id;
});
after(async () => { server.close(); await rm(dir, { recursive: true, force: true }); });

// ---------- recurrence
test("recur: supported RRULE subset; everything else refused", () => {
  assert.deepEqual(parseRule("FREQ=DAILY"), { freq: "DAILY", interval: 1 });
  assert.deepEqual(parseRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=SU"), { freq: "WEEKLY", interval: 2, byday: [6] });
  assert.deepEqual(parseRule("FREQ=MONTHLY;BYMONTHDAY=15"), { freq: "MONTHLY", interval: 1, bymonthday: 15 });
  for (const bad of ["", "FREQ=HOURLY", "FREQ=WEEKLY", "FREQ=WEEKLY;BYDAY=XX", "FREQ=DAILY;COUNT=3", "FREQ=DAILY;INTERVAL=0", "FREQ=MONTHLY;BYMONTHDAY=32", "FREQ=WEEKLY;BYDAY=MO,MO", null])
    assert.equal(parseRule(bad), null, String(bad));
});

test("recur: occurrences — weekdays, every second week, month without the day, never before the start", () => {
  const weekdays = parseRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  assert.deepEqual(occurrences(weekdays, "2026-11-16", "2026-11-16", "2026-11-23"), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-23"]);
  const fortnight = parseRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=SU");
  assert.deepEqual(occurrences(fortnight, "2026-11-15", "2026-11-01", "2026-12-14"), ["2026-11-15", "2026-11-29", "2026-12-13"]);
  const day31 = parseRule("FREQ=MONTHLY;BYMONTHDAY=31");
  assert.deepEqual(occurrences(day31, "2026-10-01", "2026-10-01", "2027-01-31"), ["2026-10-31", "2026-12-31", "2027-01-31"]);
  assert.equal(occursOn(parseRule("FREQ=DAILY;INTERVAL=3"), "2026-11-10", "2026-11-13"), true);
  assert.equal(occursOn(parseRule("FREQ=DAILY;INTERVAL=3"), "2026-11-10", "2026-11-14"), false);
  assert.equal(occursOn(parseRule("FREQ=DAILY"), "2026-11-10", "2026-11-09"), false);
});

test("recur: gentle streak — today counts only when done, a miss simply ends it", () => {
  const daily = parseRule("FREQ=DAILY");
  assert.equal(streak(daily, "2026-11-01", new Set(["2026-11-16", "2026-11-17"]), TODAY), 2, "today not done yet: yesterday's run still stands");
  assert.equal(streak(daily, "2026-11-01", new Set(["2026-11-16", "2026-11-17", TODAY]), TODAY), 3);
  assert.equal(streak(daily, "2026-11-01", new Set(["2026-11-15", "2026-11-17"]), TODAY), 1, "a miss on the 16th ends it");
  const weekly = parseRule("FREQ=WEEKLY;BYDAY=MO");
  assert.equal(streak(weekly, "2026-11-01", new Set(["2026-11-02", "2026-11-09", "2026-11-16"]), TODAY), 3, "unscheduled days do not break a weekly run");
});

test("recur: the family day follows Europe/London (BST and GMT)", () => {
  assert.equal(localDate(new Date("2026-06-30T23:30:00Z")), "2026-07-01");
  assert.equal(localDate(new Date("2026-12-31T23:30:00Z")), "2026-12-31");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

// ---------- policy (pure)
test("policy: routine access matrix with refusal reasons", () => {
  const p1 = { id: "p1", kind: "adult" }, p2 = { id: "p2", kind: "adult" }, c = { id: "c", kind: "child" }, e = { id: "e", kind: "adult" }, g = { id: "g", kind: "adult" };
  const grants = [
    { guardian_id: "p1", child_id: "c", scopes: ["routines"], revoked_at: null },
    { guardian_id: "p2", child_id: "c", scopes: ["routines", "health"], revoked_at: null },
    { guardian_id: "g", child_id: "c", scopes: ["health"], revoked_at: null },
  ];
  const pick = (a) => [a.read, a.manage, a.check, a.reason];
  assert.deepEqual(pick(routineAccess(p1, c, grants)), [true, true, true, null], "parent");
  assert.deepEqual(pick(routineAccess(p2, c, grants)), [true, true, true, null], "parent2");
  assert.deepEqual(pick(routineAccess(c, c, grants)), [true, false, true, null], "child: reads and ticks, does not manage");
  assert.deepEqual(pick(routineAccess(e, c, grants)), [false, false, false, "no_relation"], "unrelated adult");
  assert.deepEqual(pick(routineAccess(g, c, grants)), [false, false, false, "no_scope"], "relative without routines");
  assert.deepEqual(pick(routineAccess(null, c, grants)), [false, false, false, "not_a_member"], "admin who is not a member / outsider");
  assert.deepEqual(pick(routineAccess(e, e, grants)), [true, true, true, null], "an adult owns their own");
  assert.deepEqual(pick(routineAccess(p1, e, grants)), [false, false, false, "adult_private"], "another adult's are private");
  assert.deepEqual(pick(routineAccess(p1, c, [{ ...grants[0], revoked_at: "x" }])), [false, false, false, "no_relation"], "revoked grant");
  assert.equal(canSeeGuardians(g, c, grants, false), true);
  assert.equal(canSeeGuardians(e, c, grants, false), false);
  assert.equal(canSeeGuardians(null, c, grants, true), true);
});

// ---------- service: routines
const R = {};
test("service: who may create routines (parents for a child; an adult for themselves)", async () => {
  const daily = { kind: "routine", title: "Brush teeth", rrule: "FREQ=DAILY", dtstart: "2026-11-01", at_time: "20:00" };
  let r = await call("POST", `/people/${P.c}/routines`, { actor: as(E.p1), body: daily });
  assert.equal(r.status, 201); R.child = r.json.id;
  // bus 85: a chore is a task template now — the API refuses new ones; a legacy row (written straight to the
  // store, as prod data from before 3c would be) is still read, ticked and archived as below.
  assert.equal((await call("POST", `/people/${P.c}/routines`, { actor: as(E.p2), body: { kind: "chore", title: "Feed the cat", rrule: "FREQ=WEEKLY;BYDAY=MO,TH", dtstart: "2026-11-01" } })).json.error, "use_templates");
  R.chore = randomUUID(); await store.createRoutine({ id: R.chore, person_id: P.c, kind: "chore", title: "Feed the cat", rrule: "FREQ=WEEKLY;BYDAY=MO,TH", dtstart: "2026-11-01", at_time: null }, E.p2);
  r = await call("POST", `/people/${P.e}/routines`, { actor: as(E.e), body: { kind: "routine", title: "Run", rrule: "FREQ=DAILY" } });
  assert.equal(r.status, 201); R.adult = r.json.id;
  const refused = [[E.c, P.c, "child_cannot_manage"], [E.g, P.c, "no_scope"], [E.e, P.c, "no_relation"], [E.p1, P.e, "adult_private"], [E.x, P.c, "not_a_member"]];
  for (const [who, pid, reason] of refused) {
    const x = await call("POST", `/people/${pid}/routines`, { actor: as(who), body: daily });
    assert.equal(x.status, 403, who); assert.equal(x.json.reason, reason, who);
  }
  assert.equal((await call("POST", `/people/${P.c}/routines`, { body: daily })).status, 403, "admin is not an implicit manager");
  for (const bad of [{ ...daily, rrule: "FREQ=HOURLY" }, { ...daily, kind: "task" }, { ...daily, title: "" }, { ...daily, at_time: "25:00" }, { ...daily, dtstart: "tomorrow" }])
    assert.equal((await call("POST", `/people/${P.c}/routines`, { actor: as(E.p1), body: bad })).json?.error, "bad_routine");
});

test("service: reading a child's routines — matrix of seven roles", async () => {
  const expect = { [E.p1]: 200, [E.p2]: 200, [E.c]: 200, [E.e]: 403, [E.g]: 403, [E.x]: 403 };
  for (const [who, code] of Object.entries(expect)) assert.equal((await call("GET", `/people/${P.c}/routines`, { actor: as(who) })).status, code, who);
  assert.equal((await call("GET", `/people/${P.c}/routines`)).status, 403, "admin");
  const mine = await call("GET", `/people/${P.c}/routines`, { actor: as(E.c) });
  assert.equal(mine.json.today, TODAY);
  assert.deepEqual(mine.json.routines.map((r) => r.title).sort(), ["Brush teeth", "Feed the cat"]);
  const brush = mine.json.routines.find((r) => r.id === R.child);
  assert.equal(brush.due_today, true); assert.equal(brush.done_today, false); assert.equal(brush.next.length, 7);
  assert.equal(mine.json.routines.find((r) => r.id === R.chore).due_today, false, "Wednesday: no cat chore");
  assert.equal((await call("GET", `/people/${P.e}/routines`, { actor: as(E.p1) })).json.reason, "adult_private");
});

test("service: ticking off — child and parents; history kept; only today and two days back; only scheduled days", async () => {
  assert.equal((await call("POST", `/routines/${R.child}/check`, { actor: as(E.c), body: { date: TODAY, done: true } })).status, 200);
  assert.equal((await call("POST", `/routines/${R.child}/check`, { actor: as(E.p1), body: { date: "2026-11-17", done: true } })).status, 200);
  assert.equal((await call("POST", `/routines/${R.child}/check`, { actor: as(E.p2), body: { date: "2026-11-16", done: true } })).status, 200);
  let v = (await call("GET", `/people/${P.c}/routines`, { actor: as(E.c) })).json.routines.find((r) => r.id === R.child);
  assert.equal(v.done_today, true); assert.deepEqual(v.week, { done: 3, of: 7 }); assert.ok(!("streak" in v), "a child: weekly count only (bus 86)");
  assert.equal((await call("POST", `/routines/${R.child}/check`, { actor: as(E.c), body: { date: TODAY, done: false } })).status, 200, "untick");
  v = (await call("GET", `/people/${P.c}/routines`, { actor: as(E.c) })).json.routines.find((r) => r.id === R.child);
  assert.equal(v.done_today, false); assert.deepEqual(v.week, { done: 2, of: 7 }, "unticking today leaves the earlier days");
  assert.equal(store._raw.checks.filter((c) => c.routine_id === R.child).length, 4, "untick is a new row; history kept");
  assert.equal((await call("POST", `/routines/${R.child}/check`, { actor: as(E.c), body: { date: "2026-11-15", done: true } })).json.error, "bad_check", "three days back");
  assert.equal((await call("POST", `/routines/${R.child}/check`, { actor: as(E.c), body: { date: "2026-11-19", done: true } })).json.error, "bad_check", "future");
  assert.equal((await call("POST", `/routines/${R.chore}/check`, { actor: as(E.c), body: { date: TODAY, done: true } })).json.error, "not_scheduled");
  for (const who of [E.g, E.e, E.x]) assert.equal((await call("POST", `/routines/${R.child}/check`, { actor: as(who), body: { date: TODAY, done: true } })).status, 403, who);
  assert.equal((await call("POST", `/routines/${R.adult}/check`, { actor: as(E.p1), body: { date: TODAY, done: true } })).status, 403, "another adult's");
});

test("service: someone else's routines are logged; your own are not; the log fails closed", async () => {
  const before = store._raw.log.length;
  await call("GET", `/people/${P.c}/routines`, { actor: as(E.c) });
  assert.equal(store._raw.log.length, before, "own read: no log row");
  await call("GET", `/people/${P.c}/routines`, { actor: as(E.p1) });
  assert.equal(store._raw.log.at(-1).entity, "routines:list"); assert.equal(store._raw.log.at(-1).action, "read");
  store.failLog = true;
  try {
    assert.equal((await call("GET", `/people/${P.c}/routines`, { actor: as(E.p1) })).status, 503);
    assert.equal((await call("POST", `/routines/${R.child}/check`, { actor: as(E.p1), body: { date: TODAY, done: true } })).status, 503);
  } finally { store.failLog = false; }
  assert.ok(store._raw.log.every((l) => !JSON.stringify(l).includes("Brush")), "titles never enter the log");
});

test("service: edit and archive — managers only", async () => {
  assert.equal((await call("PATCH", `/routines/${R.child}`, { actor: as(E.c), body: { title: "x" } })).json.reason, "child_cannot_manage");
  assert.equal((await call("PATCH", `/routines/${R.child}`, { actor: as(E.p2), body: { title: "Brush teeth (2 min)", at_time: null } })).status, 200);
  assert.equal((await call("PATCH", `/routines/${R.child}`, { actor: as(E.p2), body: { rrule: "FREQ=YEARLY" } })).json.error, "bad_routine");
  assert.equal((await call("PATCH", `/routines/${R.chore}`, { actor: as(E.p1), body: { archived: true } })).status, 200);
  const list = (await call("GET", `/people/${P.c}/routines`, { actor: as(E.p1) })).json.routines;
  assert.deepEqual(list.map((r) => r.title), ["Brush teeth (2 min)"]);
  assert.equal((await call("POST", `/routines/${R.chore}/check`, { actor: as(E.c), body: { date: "2026-11-16", done: true } })).status, 404, "archived");
});

// ---------- guardians, admin screen, retype
test("profile: guardians visible to the child, its guardians and the admin only", async () => {
  for (const [actor, n] of [[as(E.c), 3], [as(E.p1), 3], [as(E.g), 3], [ADMIN, 3], [as(E.e), 0]]) {
    const r = await call("GET", `/people/${P.c}`, { actor });
    assert.equal(r.json.guardians.length, n, actor);
  }
  const prof = await call("GET", `/people/${P.c}`, { actor: as(E.p1) });
  assert.deepEqual(prof.json.can.routines, { read: true, manage: true, check: true, reason: null });
});

test("admin: names (incl. Cyrillic name_ru) and grant scopes; members cannot", async () => {
  assert.equal((await call("PATCH", `/people/${P.c}`, { body: { name_ru: "КУА Ребёнок" } })).status, 200);
  assert.equal((await call("GET", `/people/${P.c}`, { actor: as(E.c) })).json.person.name_ru, "КУА Ребёнок");
  assert.equal((await call("PATCH", `/people/${P.c}`, { actor: as(E.p1), body: { name_ru: "x" } })).status, 403);
  assert.equal((await call("PATCH", `/people/${P.c}`, { body: { name_ru: "" } })).json.error, "bad_person");
  assert.equal((await call("PATCH", `/people/${P.c}`, { body: {} })).json.error, "bad_request");
  assert.equal((await call("PATCH", `/grants/${P.gGrant}`, { actor: as(E.p1), body: { scopes: ["routines"] } })).status, 403);
  assert.equal((await call("PATCH", `/grants/${P.gGrant}`, { body: { scopes: ["photos"] } })).json.error, "bad_scopes");
  assert.equal((await call("PATCH", `/grants/${P.gGrant}`, { body: { scopes: ["health", "routines"] } })).status, 200);
  assert.equal((await call("GET", `/people/${P.c}/routines`, { actor: as(E.g) })).status, 200, "the new scope applies on the next request");
  await call("PATCH", `/grants/${P.gGrant}`, { body: { scopes: ["health"] } });
  assert.equal((await call("GET", `/people/${P.c}/routines`, { actor: as(E.g) })).status, 403);
});

test("documents: retype — admin and readers; others refused; logged", async () => {
  const id = (await call("POST", `/people/${P.c}/documents`, { body: { type: "other" } })).json.id;
  assert.equal((await call("PATCH", `/documents/${id}`, { actor: as(E.e), body: { type: "passport" } })).status, 403);
  assert.equal((await call("PATCH", `/documents/${id}`, { body: { type: "visa" } })).json.error, "bad_type");
  assert.equal((await call("PATCH", `/documents/${id}`, { body: { type: "residence" } })).status, 200, "admin fixes an import");
  assert.equal((await call("PATCH", `/documents/${id}`, { actor: as(E.p1), body: { type: "passport" } })).status, 200);
  assert.equal(store._raw.docs().get(id).type, "passport");
  assert.equal(store._raw.log.at(-1).entity, "document:retype:passport");
});

// ---------- HEIC metadata
async function heifWithExif() {
  const avif = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#345" } })
    .withExif({ IFD0: { Copyright: "QA-GPS-MARKER-51.5", Artist: "QA-ARTIST" } }).avif().toBuffer();
  const heic = Buffer.from(avif); heic.write("heic", 8, "latin1"); // same ISOBMFF item layout, HEIC brand
  return heic;
}

test("heif: Exif payload zeroed, structure intact; unparseable containers refused", async () => {
  const heic = await heifWithExif();
  assert.ok(heic.includes("QA-GPS-MARKER-51.5"));
  const { bytes, stripped } = stripHeifMetadata(heic);
  assert.equal(stripped, 1); assert.equal(bytes.length, heic.length);
  assert.ok(!bytes.includes("QA-GPS-MARKER-51.5") && !bytes.includes("QA-ARTIST"));
  const back = Buffer.from(bytes); back.write("avif", 8, "latin1");
  assert.equal((await sharp(back).metadata()).width, 32, "image still decodes");
  const plain = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).avif().toBuffer();
  assert.equal(stripHeifMetadata(plain).stripped, 0);
  assert.throws(() => stripHeifMetadata(Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(40, 7)])), /heif_unparseable/);
});

test("service: HEIC upload stored without Exif; an unparseable HEIC is refused", async () => {
  const id = (await call("POST", `/people/${P.c}/documents`, { body: { type: "other" } })).json.id;
  const up = await call("POST", `/documents/${id}/files`, { raw: await heifWithExif(), headers: { "x-file-name": Buffer.from("photo.heic").toString("base64url") } });
  assert.equal(up.status, 201); assert.equal(up.json.mime, "image/heic");
  const got = await call("GET", `/documents/${id}/files/${up.json.id}`, { actor: as(E.p1) });
  assert.equal(got.status, 200); assert.ok(!got.buf.includes("QA-GPS-MARKER-51.5"));
  const junk = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(40, 7)]);
  assert.equal((await call("POST", `/documents/${id}/files`, { raw: junk })).status, 415);
});

test("logs: new routes are classed without ids", () => {
  assert.equal(routeClass(`/people/${P.c}/routines`), "/people/:id/routines");
  assert.equal(routeClass(`/routines/${R.child}/check`), "/routines/:id/check");
  assert.equal(routeClass(`/routines/${R.child}`), "/routines/:id");
  assert.equal(routeClass(`/documents/${R.child}`), "/documents/:id");
});
