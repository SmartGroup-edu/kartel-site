// Bus 87: the family editor role — every editor change is a pending revision the owner approves.
// Run: npm test. No database, no network: memory store, temp dir, synthetic addresses only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createApp, routeClass, parseActor } from "./server.mjs";
import { memoryStore } from "./store.mjs";
import { ownerDue, editorDigests, quiet } from "./review.mjs";
import { signMediaRequest } from "../app/lib/media-signature.mjs";

const SECRET = "media-test-secret-at-least-32-characters";
const OWNER = "owner@example.test", ED = "editor:editor@example.test", ED2 = "editor:editor2@example.test", VIEWER = "member@example.test";
let server, base, dir, store;
async function call(method, path, { body = "", actor = OWNER } = {}) {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  const h = await signMediaRequest({ secret: SECRET, method, path, actor, body: bytes });
  const r = await fetch(base + path, { method, headers: { ...h, ...(typeof body === "string" && body ? { "content-type": "application/json" } : {}) }, body: method === "GET" ? undefined : bytes });
  const ct = r.headers.get("content-type") ?? "";
  return { status: r.status, json: ct.includes("json") ? await r.json() : null };
}
const jpeg = (r = 120) => sharp({ create: { width: 900, height: 1100, channels: 3, background: { r, g: 40, b: 50 } } }).jpeg().toBuffer();
const upload = async (actor) => (await call("POST", "/media", { body: await jpeg(), actor })).json.id;
const img = (id, actor, scope = "admin") => call("GET", `/media/${id}/256.webp?scope=${scope}`, { actor });

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "kfm-review-"));
  store = memoryStore();
  server = createServer(createApp({ store, mediaDir: dir, secret: SECRET })).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  // the owner has a published entry already
  await call("PUT", "/draft/person/p1", { body: JSON.stringify({ portrait: null, altEN: "A", altRU: "А" }) });
  await call("POST", "/publish");
});
after(async () => { server.close(); await rm(dir, { recursive: true, force: true }); });

test("actor roles: «editor:» prefix is an editor; a bare email the owner; anything else refused", () => {
  assert.deepEqual(parseActor("editor:e@example.test"), { role: "editor", email: "e@example.test" });
  assert.deepEqual(parseActor("o@example.test"), { role: "owner", email: "o@example.test" });
  assert.equal(parseActor("editor:not-an-email"), null);
  assert.equal(parseActor("owner:o@example.test"), null, "no other role prefixes");
});

test("an editor cannot publish, undo, write the draft, read the audit, see or decide the queue", async () => {
  for (const [m, p, body] of [["PUT", "/draft/person/p1", JSON.stringify({ altEN: "x" })], ["POST", "/publish"], ["POST", "/undo"], ["GET", "/audit"], ["GET", "/revisions?scope=pending"], ["POST", "/revisions/approve-all"]]) {
    const r = await call(m, p, { body: body ?? "", actor: ED });
    assert.equal(r.status, 403, `${m} ${p}`); assert.equal(r.json.error, "owner_only");
  }
  assert.equal((await call("POST", "/revisions/person/p1", { body: JSON.stringify({ altEN: "x" }) })).json.error, "owner_edits_directly", "the owner publishes as today");
});

let pid, rev;
test("an editor's upload is hidden: not to viewers, not to another editor; visible to her and the owner", async () => {
  pid = await upload(ED);
  assert.equal((await img(pid, VIEWER, "published")).status, 404, "viewer");
  assert.equal((await img(pid, ED2)).status, 404, "another editor");
  assert.equal((await img(pid, ED)).status, 200, "her own preview");
  assert.equal((await img(pid, OWNER)).status, 200, "the owner reviews it");
});

test("a proposal is pending: the draft and the family see nothing; a second save updates the same proposal", async () => {
  const r = await call("POST", "/revisions/person/p1", { body: JSON.stringify({ portrait: pid, altEN: "Portrait", altRU: "Портрет" }), actor: ED });
  assert.equal(r.status, 200); rev = r.json.id;
  const again = await call("POST", "/revisions/person/p1", { body: JSON.stringify({ portrait: pid, altEN: "Portrait 2", altRU: "Портрет 2" }), actor: ED });
  assert.equal(again.json.id, rev); assert.equal(again.json.updated, true);
  const owner = (await call("GET", "/content?state=draft")).json;
  assert.equal(owner.content.persons.p1.altEN, "A", "the draft is untouched"); assert.equal(owner.pending, 1);
  assert.equal((await call("GET", "/content?state=published", { actor: VIEWER })).json.content.persons.p1.portrait, null, "the family sees nothing");
  const mine = (await call("GET", "/content?state=draft", { actor: ED })).json;
  assert.equal(mine.mine.persons.p1.altEN, "Portrait 2", "the editor works on her own proposal");
  assert.ok(!("pending" in mine));
  const other = await call("POST", "/revisions/person/p2", { body: JSON.stringify({ portrait: pid }), actor: ED2 });
  assert.equal(other.status, 422, "another editor cannot use her hidden upload");
});

test("owner review: before/after, stale flag; approve → draft + publish; the photo becomes visible", async () => {
  const q = (await call("GET", "/revisions?scope=pending")).json.revisions;
  assert.equal(q.length, 1); assert.equal(q[0].before.altEN, "A"); assert.equal(q[0].after.altEN, "Portrait 2"); assert.equal(q[0].stale, false);
  assert.equal((await call("POST", `/revisions/${rev}/approve`, { actor: ED })).json.error, "owner_only", "the editor never approves (her own or anyone's)");
  const ok = await call("POST", `/revisions/${rev}/approve`);
  assert.equal(ok.status, 200);
  const pub = (await call("GET", "/content?state=published", { actor: VIEWER })).json.content.persons.p1;
  assert.equal(pub.portrait, pid); assert.equal(pub.altEN, "Portrait 2");
  assert.equal((await img(pid, VIEWER, "published")).status, 200, "now visible to the family");
  assert.equal((await img(pid, ED2)).status, 200, "and to other editors");
  const acts = store._raw.log.map((r) => r.action);
  assert.ok(["review.propose", "review.approve", "publish"].every((a) => acts.includes(a)), "audited");
  assert.equal((await call("POST", `/revisions/${rev}/approve`)).status, 404, "decided once");
});

test("reject: hidden, with the comment back to the editor; her upload is purged after 30 days", async () => {
  const p2 = await upload(ED);
  const r = (await call("POST", "/revisions/event/e1", { body: JSON.stringify({ storyRU: "Синтетическая история", photos: [{ id: p2, captionEN: "", captionRU: "" }] }), actor: ED })).json.id;
  assert.equal((await call("POST", `/revisions/${r}/reject`, { body: JSON.stringify({ comment: "x".repeat(501) }) })).json.error, "bad_comment");
  assert.equal((await call("POST", `/revisions/${r}/reject`, { body: JSON.stringify({ comment: "Синтетика: другое фото" }) })).status, 200);
  assert.equal((await call("GET", "/content?state=published", { actor: VIEWER })).json.content.events.e1, undefined, "hidden");
  const mine = (await call("GET", "/revisions?scope=mine", { actor: ED })).json.revisions.find((x) => x.id === r);
  assert.equal(mine.state, "rejected"); assert.equal(mine.comment, "Синтетика: другое фото");
  assert.ok(!("author" in mine) && !("decided_by" in mine), "no addresses in the editor's list");
  assert.deepEqual(await store.purgeRejected(new Date(Date.now() - 1000).toISOString()), [], "not before 30 days");
  store._raw.meta.get(p2).rejected_at = new Date(Date.now() - 31 * 86400_000).toISOString();
  assert.deepEqual(await store.purgeRejected(new Date(Date.now() - 30 * 86400_000).toISOString()), [p2]);
  assert.equal(await store.purgeRejected(new Date().toISOString()).then((x) => x.length), 0, "approved/published files never purged");
});

test("withdraw: only the author, only while pending; approve-all publishes once", async () => {
  const a = (await call("POST", "/revisions/event/e2", { body: JSON.stringify({ storyEN: "One" }), actor: ED })).json.id;
  assert.equal((await call("POST", `/revisions/${a}/withdraw`, { actor: ED2 })).status, 404, "not another editor");
  assert.equal((await call("POST", `/revisions/${a}/withdraw`)).status, 403, "the owner rejects instead");
  assert.equal((await call("POST", `/revisions/${a}/withdraw`, { actor: ED })).status, 200);
  assert.equal((await call("GET", "/revisions?scope=pending")).json.revisions.length, 0);
  await call("POST", "/revisions/event/e3", { body: JSON.stringify({ storyEN: "Three" }), actor: ED });
  await call("POST", "/revisions/event/e4", { body: JSON.stringify({ storyEN: "Four" }), actor: ED2 });
  const pubs = store._raw.log.filter((r) => r.action === "publish").length;
  assert.equal((await call("POST", "/revisions/approve-all")).json.approved, 2);
  assert.equal(store._raw.log.filter((r) => r.action === "publish").length, pubs + 1, "one publish for the batch");
  const pub = (await call("GET", "/content?state=published", { actor: VIEWER })).json.content.events;
  assert.equal(pub.e3.storyEN, "Three"); assert.equal(pub.e4.storyEN, "Four");
});

test("notices: owner at most once per 2 h, only for new changes, never 21:00–07:00; editors per author", () => {
  const day = new Date("2026-11-18T12:00:00Z"); // 12:00 London (GMT)
  assert.equal(ownerDue({ pending: 2, fresh: 2, lastAt: null, now: day }), true);
  assert.equal(ownerDue({ pending: 2, fresh: 0, lastAt: null, now: day }), false, "nothing new since the last notice");
  assert.equal(ownerDue({ pending: 2, fresh: 1, lastAt: "2026-11-18T10:30:00Z", now: day }), false, "< 2 h");
  assert.equal(ownerDue({ pending: 2, fresh: 1, lastAt: "2026-11-18T10:00:00Z", now: day }), true, "2 h");
  assert.equal(quiet(new Date("2026-11-18T21:00:00Z")), true); assert.equal(quiet(new Date("2026-11-18T06:59:00Z")), true); assert.equal(quiet(new Date("2026-11-18T07:00:00Z")), false);
  assert.equal(ownerDue({ pending: 1, fresh: 1, lastAt: null, now: new Date("2026-11-18T22:00:00Z") }), false, "quiet hours");
  assert.equal(quiet(new Date("2026-06-18T20:30:00Z")), true, "BST: 21:30 London");
  assert.deepEqual(editorDigests([{ id: "1", author: "a@x.test", state: "approved" }, { id: "2", author: "a@x.test", state: "rejected" }, { id: "3", author: "b@x.test", state: "approved" }]),
    [{ to: "a@x.test", approved: 1, rejected: 1, ids: ["1", "2"] }, { to: "b@x.test", approved: 1, rejected: 0, ids: ["3"] }]);
});

test("owner addresses for notices come only from owner actions; the queue counts what is new", async () => {
  assert.deepEqual(await store.ownerEmails(), [OWNER]);
  const r = (await call("POST", "/revisions/event/e5", { body: JSON.stringify({ storyEN: "Five" }), actor: ED })).json.id;
  const t0 = new Date(Date.now() - 60_000).toISOString();
  assert.deepEqual(await store.pendingStats(t0), { pending: 1, fresh: 1 });
  await store.setNotice("owner_pending", new Date(Date.now() + 1000).toISOString());
  assert.deepEqual(await store.pendingStats(await store.noticeAt("owner_pending")), { pending: 1, fresh: 0 });
  await call("POST", `/revisions/${r}/reject`, { body: "{}" });
  assert.ok((await store.decidedUnnotified()).length >= 1);
});

test("logs: revision routes classed without ids or keys", () => {
  assert.equal(routeClass("/revisions/person/some-name"), "/revisions/:kind/:key");
  assert.equal(routeClass("/revisions/00000000-0000-4000-8000-000000000000/approve"), "/revisions/:id/approve");
  assert.equal(routeClass("/revisions/approve-all"), "/revisions/approve-all");
  assert.equal(routeClass("/revisions?scope=mine"), "/revisions");
});
