// E2E (QA-158 N2): one family page costs a small, bounded number of Family OS calls. QA measured 15–49 calls per
// page (most of them GET /me), which spent the family's hourly read budget. Now: GETs are asked once per render
// (React cache in app/lib/family-os.ts), the edge gate asks /me once, and family links do not prefetch.
// Runs the real Family OS app (memory store, synthetic people) in this process on :18795 behind a counter, against
// `next start` with the same env as family-ended.e2e.mjs. NOT part of `npm test`; CI `e2e` job.
//   node tests/e2e/family-os-calls.e2e.mjs
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { createApp } from "../../family-os/server.mjs";
import { memoryStore } from "../../family-os/store.mjs";
import { signMediaRequest } from "../../app/lib/media-signature.mjs";
import { familySessionCookie } from "../../app/lib/family-cookie.mjs";

const B = process.env.E2E_BASE ?? "http://localhost:3999";
const SESSION = familySessionCookie({ NODE_ENV: "production" });
const OS_SECRET = process.env.FAMILY_OS_SECRET, KEY = new TextEncoder().encode(process.env.FAMILY_SESSION_SECRET);
// The bound: the edge gate's /me + the page's /me, /people and its own data. The person page is the widest (8 reads);
// the printable week sheet reads one board per day (7), so it has its own ceiling.
const MAX_CALLS = 12, MAX_WEEK = 16, MAX_ME = 2;
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

// ── Family OS, in process, behind a counter ──
const calls = [];
const app = createApp({ store: memoryStore(), secret: OS_SECRET, masterKey: randomBytes(32), passkeys: null });
const os = createServer((req, res) => { calls.push(req.url.split("?")[0]); return app(req, res); }).listen(18795, "127.0.0.1");
await new Promise((r) => os.once("listening", r));
const osCall = async (method, path, actor, body) => {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: OS_SECRET, method, path, actor, body: raw });
  const r = await fetch(`http://127.0.0.1:18795${path}`, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: raw || undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};
// The owner is NOT a member here (the QA-156 L7 / QA-158 N3 case); the member is an adult parent of a child.
const ADMIN = "admin@example.com", MEMBER = "member@example.com", owner = `admin:${ADMIN}`;
const memberId = (await osCall("POST", "/people", owner, { email: MEMBER, name_en: "QA member", name_ru: "QA взрослый", kind: "adult" })).json.id;
await osCall("PATCH", `/people/${memberId}`, owner, { birth_date: "1985-06-01" });
const childId = (await osCall("POST", "/people", owner, { email: "child@example.com", name_en: "QA child", name_ru: "QA ребёнок", kind: "child" })).json.id;
await osCall("POST", "/grants", owner, { guardian_id: memberId, child_id: childId, relation: "parent", scopes: ["routines", "health", "education", "documents"] });

const nowS = () => Math.floor(Date.now() / 1000);
const session = (email) => new SignJWT({ email, typ: "session", amr: "link" }).setProtectedHeader({ alg: "HS256" }).setSubject(email).setIssuedAt(nowS() - 5).setExpirationTime(nowS() + 3600).sign(KEY);
const member = await session(MEMBER), admin = await session(ADMIN);

async function page(who, tok, path, status = 200) {
  calls.length = 0;
  const r = await fetch(B + path, { redirect: "manual", headers: { cookie: `${SESSION}=${tok}` } });
  await r.text();
  const me = calls.filter((c) => c === "/me").length, max = path.endsWith("/week") ? MAX_WEEK : MAX_CALLS;
  check(`${who} ${path}: ${status}, ≤ ${max} OS calls, ≤ ${MAX_ME} × /me`, r.status === status && calls.length <= max && me <= MAX_ME, `${r.status} · ${calls.length} calls · ${me} × /me`);
}

for (const p of ["/ru/family", "/ru/family/os", "/ru/family/os/board", "/ru/family/os/people", `/ru/family/os/people/${memberId}`, `/ru/family/os/people/${childId}`,
  "/ru/family/os/council", "/ru/family/os/calendar", "/ru/family/os/kodeks", "/ru/family/os/week", "/en/family/os/board"]) await page("member", member, p);
for (const p of ["/ru/family/os", "/ru/family/os/access", "/ru/family/os/people", "/ru/family/admin"]) await page("owner", admin, p);
// The owner who is not a member: member-only sections and unknown addresses are the family 404 (N3).
for (const p of ["/ru/family/os/council", "/ru/family/os/board", "/ru/family/os/no-such-page"]) await page("owner", admin, p, 404);

// N3: on that 404 the owner's tabs are the same as on every other page — no Доска / Совет / Календарь.
const nf = await (await fetch(`${B}/ru/family/os/council`, { redirect: "manual", headers: { cookie: `${SESSION}=${admin}` } })).text();
const nav = nf.match(/<nav[^>]*data-family-subnav[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? "";
check("N3: owner (not a member) on the family 404 — sub-nav present", nav.includes("/ru/family/os/access"));
check("N3: …without Доска / Совет / Календарь", !/\/ru\/family\/os\/(board|council|calendar)"/.test(nav), nav.match(/href="[^"]+"/g)?.join(" ") ?? "");

os.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
