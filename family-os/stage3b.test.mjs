// Family OS Stage 3b — council, goals, calendar, ICS (synthetic people only).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { createApp, routeClass } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { councilDate, weekStart, buildAgenda, fold, councilStatus, calendarItems } from "./council.mjs";
import ICAL from "ical.js";
import { canReadGoal, canWriteGoal } from "./policy.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "os-stage3b-secret-at-least-32-chars!!!";
const TODAY = "2026-11-18"; // Wednesday → council Sunday 2026-11-22
let server, base, store;
const ADMIN = "admin:admin@example.test", as = (e) => `member:${e}`;
const E = { p1: "parent1@example.test", p2: "parent2@example.test", c: "child@example.test", c2: "child2@example.test", e: "adult@example.test", g: "relative@example.test", x: "outsider@example.test" };
const P = {};
async function call(method, path, { body, actor = ADMIN } = {}) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: raw });
  const r = await fetch(base + path, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: method === "GET" || method === "DELETE" ? undefined : raw });
  const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch { /* ics */ }
  return { status: r.status, json, text: txt, type: r.headers.get("content-type") };
}
before(async () => {
  store = memoryStore();
  server = createServer(createApp({ store, secret: SECRET, masterKey: randomBytes(32), clock: () => new Date(`${TODAY}T10:00:00Z`) })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [k, kind] of [["p1", "adult"], ["p2", "adult"], ["c", "child"], ["c2", "child"], ["e", "adult"], ["g", "adult"]])
    P[k] = (await call("POST", "/people", { body: { email: E[k], name_en: `QA ${k}`, name_ru: `QA ${k}`, kind } })).json.id;
  for (const k of ["p1", "p2"]) for (const c of ["c", "c2"]) await call("POST", "/grants", { body: { guardian_id: P[k], child_id: P[c], relation: "parent", scopes: ["routines"] } });
  await call("POST", "/grants", { body: { guardian_id: P.g, child_id: P.c, relation: "relative", scopes: ["health"] } });
  await call("PATCH", `/people/${P.c}`, { body: { birth_date: "2015-11-20" } });
  await call("PATCH", `/people/${P.e}`, { body: { birth_date: "1990-12-01" } });
});
after(() => server.close());

test("pure: council date, week start, ICS folding, aggregate agenda", () => {
  assert.equal(councilDate("2026-11-18"), "2026-11-22"); assert.equal(councilDate("2026-11-22"), "2026-11-22"); assert.equal(councilDate("2026-11-23"), "2026-11-29");
  assert.equal(weekStart("2026-11-18"), "2026-11-16"); assert.equal(weekStart("2026-11-16"), "2026-11-16");
  const long = "SUMMARY:" + "Почистить зубы и ".repeat(10);
  const f = fold(long).split("\r\n");
  assert.ok(f.every((l) => Buffer.byteLength(l) <= 75) && f.slice(1).every((l) => l.startsWith(" ")) && f.map((l, i) => (i ? l.slice(1) : l)).join("") === long, "folded ≤ 75 octets, unfolds to the original");
  const a = buildAgenda("2026-11-22", "2026-11-18", { routines: [{ id: "r", person_id: "c", rrule: "FREQ=DAILY", dtstart: "2026-11-01" }], checks: [{ routine_id: "r", on_date: "2026-11-16", done: true }], prevTasks: [{ done_at: "x" }, { done_at: null }] });
  assert.deepEqual(a, { from: "2026-11-16", to: "2026-11-18", items: { scheduled: 3, done: 1 }, tasks: { done: 1, open: 1 } }, "Mon–Wed so far; family totals only");
});

test("policy: goals — only the owner writes; visibility as chosen", () => {
  const c = { id: "c", kind: "child" }, p1 = { id: "p1", kind: "adult" }, e = { id: "e", kind: "adult" };
  const grants = [{ guardian_id: "p1", child_id: "c", scopes: ["routines"], revoked_at: null }];
  assert.equal(canWriteGoal(p1, c), false, "a parent never writes a child's goal (Floor №8)");
  assert.equal(canWriteGoal(c, c), true);
  assert.equal(canReadGoal(p1, { visibility: "owner" }, c, grants), false);
  assert.equal(canReadGoal(p1, { visibility: "guardians" }, c, grants), true);
  assert.equal(canReadGoal(e, { visibility: "guardians" }, c, grants), false);
  assert.equal(canReadGoal(e, { visibility: "family" }, c, grants), true);
  assert.equal(canReadGoal(null, { visibility: "family" }, c, grants), false, "admin / outsider");
});

test("council: members read, adults write, agenda aggregate only; tasks ticked by owner or an adult", async () => {
  const r = await call("POST", `/people/${P.c}/routines`, { actor: as(E.p1), body: { kind: "routine", title: "Brush teeth", rrule: "FREQ=DAILY", dtstart: "2026-11-01" } });
  await call("POST", `/routines/${r.json.id}/check`, { actor: as(E.c), body: { date: "2026-11-16", done: true } });
  for (const [actor, code] of [[as(E.c), 200], [as(E.p1), 200], [as(E.e), 200], [as(E.x), 403], [ADMIN, 403]]) assert.equal((await call("GET", "/council", { actor })).status, code, actor);
  const v = await call("GET", "/council", { actor: as(E.c) });
  assert.equal(v.json.date, "2026-11-22"); assert.equal(v.json.can.write, false, "a child reads, does not write");
  assert.deepEqual(v.json.agenda.items, { scheduled: 3, done: 1 });
  assert.ok(!JSON.stringify(v.json.agenda).match(/Brush|QA |[0-9a-f]{8}-[0-9a-f]{4}/), "agenda carries no titles, names or ids");
  assert.equal((await call("PUT", "/council/2026-11-22", { actor: as(E.c), body: { notes: "x", held: false } })).status, 403);
  assert.equal((await call("PUT", "/council/2026-11-21", { actor: as(E.p1), body: { notes: "x", held: false } })).json.error, "bad_council", "councils are on Sundays");
  assert.equal((await call("PUT", "/council/2026-11-22", { actor: as(E.p1), body: { notes: "Synthetic agenda note", held: true } })).json.error, "not_started", "a future council cannot be marked as held (bus 80 #1)");
  assert.equal((await call("PUT", "/council/2026-11-22", { actor: as(E.p1), body: { notes: "Synthetic agenda note", held: false } })).status, 200);
  const st = (await call("GET", "/council", { actor: as(E.p1) })).json;
  assert.equal(st.status, "upcoming"); assert.equal(st.days_until, 4); assert.equal(st.can.mark_held, false);
  assert.ok(![...store._raw.meetings.values()].some((m) => String(m.notes_ct).includes("Synthetic")), "notes are ciphertext at rest");
  assert.equal((await call("GET", "/council", { actor: as(E.c2) })).json.notes, "Synthetic agenda note");
  const t = await call("POST", "/council/2026-11-22/tasks", { actor: as(E.p2), body: { title: "Plan the trip", owner_id: P.c, due_date: "2026-11-29" } });
  assert.equal(t.status, 201);
  assert.equal((await call("POST", "/council/2026-11-22/tasks", { actor: as(E.c), body: { title: "x", owner_id: P.c, due_date: "2026-11-29" } })).status, 403);
  assert.equal((await call("POST", "/council/2026-11-22/tasks", { actor: as(E.p1), body: { title: "x", owner_id: P.c, due_date: "2026-11-20" } })).json.error, "bad_task", "due before the council");
  assert.deepEqual((await call("GET", "/council-tasks", { actor: as(E.c) })).json.tasks.map((x) => x.title), ["Plan the trip"]);
  assert.equal((await call("POST", `/council-tasks/${t.json.id}/done`, { actor: as(E.c2), body: { done: true } })).status, 403, "another child cannot tick it");
  assert.equal((await call("POST", `/council-tasks/${t.json.id}/done`, { actor: as(E.c), body: { done: true } })).status, 200);
  assert.deepEqual((await call("GET", "/council-tasks", { actor: as(E.c) })).json.tasks, []);
});

const G = {};
test("goals: owner creates (a child too); a parent cannot write a child's goal; visibility; encrypted; others' reads logged", async () => {
  const c = await call("POST", `/people/${P.c}/goals`, { actor: as(E.c), body: { title: "Read 5 books", sphere: "learning" } });
  assert.equal(c.status, 201); G.c = c.json.id;
  assert.equal((await call("POST", `/people/${P.c}/goals`, { actor: as(E.p1), body: { title: "x", sphere: "learning" } })).json.reason, "owner_only");
  assert.equal((await call("POST", `/people/${P.e}/goals`, { actor: as(E.e), body: { title: "x", sphere: "joy", visibility: "guardians" } })).json.error, "bad_goal", "adults: owner or family only");
  assert.equal((await call("POST", `/people/${P.c}/goals`, { actor: as(E.c), body: { title: "x", sphere: "fame" } })).json.error, "bad_goal");
  assert.ok(![...store._raw.goals.values()].some((g) => String(g.title_ct).includes("Read 5")), "title is ciphertext at rest");
  const seen = async (actor) => (await call("GET", `/people/${P.c}/goals`, { actor })).json.goals.length;
  assert.equal(await seen(as(E.c)), 1); assert.equal(await seen(as(E.p1)), 0, "owner-only by default"); assert.equal(await seen(as(E.e)), 0);
  assert.equal((await call("PATCH", `/goals/${G.c}`, { actor: as(E.p1), body: { visibility: "family" } })).status, 403, "only the owner shares");
  assert.equal((await call("PATCH", `/goals/${G.c}`, { actor: as(E.c), body: { visibility: "guardians" } })).status, 200);
  const before = store._raw.log.length;
  assert.equal(await seen(as(E.p1)), 1); assert.equal(await seen(as(E.g)), 1, "a relative with a grant is a guardian too"); assert.equal(await seen(as(E.e)), 0);
  assert.equal(store._raw.log.at(-1).entity, "goals:list"); assert.ok(store._raw.log.length > before, "someone else's goals: logged");
  assert.equal((await call("POST", `/goals/${G.c}/checkins`, { actor: as(E.c), body: { mood: "on_track", note: "Synthetic: two chapters" } })).json.week_start, "2026-11-16");
  assert.equal((await call("POST", `/goals/${G.c}/checkins`, { actor: as(E.p1), body: { mood: "slow" } })).status, 403, "a parent does not check in for the child");
  assert.equal((await call("POST", `/goals/${G.c}/checkins`, { actor: as(E.c), body: { mood: "great" } })).json.error, "bad_checkin");
  const v = (await call("GET", `/people/${P.c}/goals`, { actor: as(E.c) })).json.goals[0];
  assert.equal(v.checked_this_week, true); assert.equal(v.checkins[0].note, "Synthetic: two chapters");
  assert.equal((await call("GET", `/people/${P.c}/goals`, { actor: as(E.x) })).status, 403);
});

test("calendar: council Sundays, family events (adults add), birthdays only where the birth date may be seen", async () => {
  assert.equal((await call("POST", "/events", { actor: as(E.c), body: { title: "x", on_date: "2026-11-25" } })).status, 403);
  assert.equal((await call("POST", "/events", { actor: as(E.p1), body: { title: "Grandma visits", on_date: "2026-11-25", at_time: "15:00" } })).status, 201);
  assert.equal((await call("POST", "/events", { actor: as(E.p1), body: { title: "x", on_date: "2026-11-01" } })).json.error, "bad_event", "not in the past");
  const kinds = async (actor) => (await call("GET", "/calendar?days=14", { actor })).json.items.map((i) => `${i.date}:${i.kind}${i.name_ru ? `:${i.name_ru}` : ""}`);
  const p1 = await kinds(as(E.p1));
  assert.ok(p1.includes("2026-11-20:birthday:QA c") && p1.includes("2026-11-22:council") && p1.includes("2026-11-25:event"));
  assert.ok(!p1.includes("2026-11-29:council"), "only the next council is listed (bus 80 #3)");
  assert.ok(!p1.includes("2026-12-01:birthday:QA e"), "another adult's birthday: not visible to p1");
  assert.ok((await kinds(as(E.e))).every((x) => !x.includes("birthday:QA c")), "unrelated adult: no child's birthday");
  assert.ok((await kinds(as(E.c))).includes("2026-11-20:birthday:QA c"), "own birthday");
  assert.equal((await call("GET", "/calendar", { actor: as(E.x) })).status, 403);
});

test("ICS: own link only; token shown once, hash stored; feed; new link revokes the old; switch off", async () => {
  assert.equal((await call("POST", `/people/${P.c}/ics`, { actor: as(E.p1) })).json.reason, "own_link_only");
  const t1 = (await call("POST", `/people/${P.c}/ics`, { actor: as(E.c) })).json.token;
  assert.match(t1, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(store._raw.ics.get(P.c).hash, createHash("sha256").update(t1).digest("hex"), "only the hash is stored");
  const feed = await call("GET", `/ics/${t1}`, { actor: "system:ics" });
  assert.equal(feed.status, 200); assert.match(feed.type, /text\/calendar/);
  assert.match(feed.text, /BEGIN:VCALENDAR[\s\S]*SUMMARY:Brush teeth[\s\S]*RRULE:FREQ=DAILY/);
  assert.match(feed.text, /SUMMARY:Семейный совет\r\nRRULE:FREQ=WEEKLY;BYDAY=SU/); assert.match(feed.text, /SUMMARY:День рождения: QA c\r\nRRULE:FREQ=YEARLY/);
  assert.ok(!feed.text.includes("Read 5 books"), "goals never go into the feed");
  assert.ok(feed.text.split("\r\n").every((l) => Buffer.byteLength(l) <= 75), "every line ≤ 75 octets");
  assert.equal((await call("GET", `/ics/${t1}`, { actor: as(E.c) })).status, 403, "only the site's ics actor");
  assert.equal((await call("GET", `/ics/${t1}`)).status, 403);
  const t2 = (await call("POST", `/people/${P.c}/ics`, { actor: as(E.c) })).json.token;
  assert.equal((await call("GET", `/ics/${t1}`, { actor: "system:ics" })).status, 404, "a new link revokes the old one");
  assert.equal((await call("GET", `/ics/${t2}`, { actor: "system:ics" })).status, 200);
  assert.equal((await call("DELETE", `/people/${P.c}/ics`, { actor: as(E.c) })).json.ok, true);
  assert.equal((await call("GET", `/ics/${t2}`, { actor: "system:ics" })).status, 404);
  assert.equal((await call("GET", `/people/${P.c}/ics`, { actor: as(E.c) })).json.active, false);
  assert.equal(routeClass(`/ics/${t2}`), "/ics/:token", "tokens never reach the log");
});

test("profile: capabilities for notes, goals and the ICS link", async () => {
  const pr = async (actor) => (await call("GET", `/people/${P.c}`, { actor })).json.can;
  assert.deepEqual((await pr(as(E.c))).notes, []); assert.equal((await pr(as(E.c))).goals, true); assert.equal((await pr(as(E.c))).ics, true);
  assert.equal((await pr(as(E.p1))).goals, false); assert.equal((await pr(as(E.p1))).ics, false);
  assert.deepEqual((await pr(as(E.g))).notes, ["health"]);
});


test("council status chip: upcoming → today → live → held / missed; held only from 19:00 (bus 80 #1)", () => {
  assert.deepEqual(councilStatus("2026-11-22", "2026-11-18", "10:00", false), { status: "upcoming", days: 4, canMarkHeld: false });
  assert.deepEqual(councilStatus("2026-11-22", "2026-11-22", "18:59", false), { status: "today", days: 0, canMarkHeld: false });
  assert.deepEqual(councilStatus("2026-11-22", "2026-11-22", "19:00", false), { status: "live", days: 0, canMarkHeld: true });
  assert.deepEqual(councilStatus("2026-11-22", "2026-11-22", "21:00", false), { status: "missed", days: 0, canMarkHeld: true });
  assert.deepEqual(councilStatus("2026-11-15", "2026-11-18", "10:00", false), { status: "missed", days: -3, canMarkHeld: true });
  assert.equal(councilStatus("2026-11-15", "2026-11-18", "10:00", true).status, "held");
});

test("calendar: only the next council is listed; birthdays carry the age (bus 80 #3, #8)", () => {
  const items = calendarItems("2026-11-18", "2027-01-16", { events: [], birthdayPeople: [{ id: "c", birth_date: "2015-11-20", name_ru: "Вера" }], nameOf: (p) => p.name_ru });
  assert.deepEqual(items.filter((i) => i.kind === "council").map((i) => i.date), ["2026-11-22"]);
  assert.deepEqual(items.filter((i) => i.kind === "birthday").map((i) => [i.date, i.age]), [["2026-11-20", 11]]);
});

test("ICS parses with a real parser (ical.js); VTIMEZONE Europe/London gives the right UTC across DST (bus 80 #9)", async () => {
  const t = (await call("POST", `/people/${P.c}/ics`, { actor: as(E.c) })).json.token;
  const feed = (await call("GET", `/ics/${t}`, { actor: "system:ics" })).text;
  const cal = new ICAL.Component(ICAL.parse(feed));
  const tz = cal.getFirstSubcomponent("vtimezone");
  assert.ok(tz, "VTIMEZONE present"); assert.equal(tz.getFirstPropertyValue("tzid"), "Europe/London");
  ICAL.TimezoneService.register(tz);
  const council = cal.getAllSubcomponents("vevent").map((v) => new ICAL.Event(v)).find((e) => e.summary === "Семейный совет");
  assert.ok(council.isRecurring());
  const it = council.iterator(), utc = [];
  for (let n = it.next(); n && utc.length < 40; n = it.next()) utc.push(n.convertToZone(ICAL.Timezone.utcTimezone).toString());
  assert.ok(utc.includes("2026-11-22T19:00:00Z"), "November: 19:00 London = 19:00 UTC (GMT)");
  assert.ok(utc.some((x) => /^2027-0[4-8]-\d\dT18:00:00Z$/.test(x)), "summer: 19:00 London = 18:00 UTC (BST)");
  const events = cal.getAllSubcomponents("vevent").map((v) => new ICAL.Event(v));
  assert.ok(events.every((e) => e.uid && e.summary && e.startDate), "every event has UID, SUMMARY, DTSTART");
  await call("DELETE", `/people/${P.c}/ics`, { actor: as(E.c) });
});
