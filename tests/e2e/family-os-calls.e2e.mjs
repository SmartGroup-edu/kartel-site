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
const member = await session(MEMBER), admin = await session(ADMIN), child = await session("child@example.com");

async function page(who, tok, path, status = 200, location = null) {
  calls.length = 0;
  const r = await fetch(B + path, { redirect: "manual", headers: { cookie: `${SESSION}=${tok}` } });
  const html = await r.text();
  const me = calls.filter((c) => c === "/me").length, max = path.endsWith("/week") ? MAX_WEEK : MAX_CALLS;
  const loc = r.headers.get("location") ?? "";
  check(`${who} ${path}: ${status}${location ? ` → ${location}` : ""}, ≤ ${max} OS calls, ≤ ${MAX_ME} × /me`, r.status === status && (!location || new URL(loc, B).pathname === location) && calls.length <= max && me <= MAX_ME,
    `${r.status}${loc ? ` → ${loc}` : ""} · ${calls.length} calls · ${me} × /me`);
  return { html, calls: [...calls] };
}

for (const p of ["/ru/family", "/ru/family/os", "/ru/family/os/board", "/ru/family/os/people", `/ru/family/os/people/${memberId}`, `/ru/family/os/people/${childId}`,
  "/ru/family/os/council", "/ru/family/os/calendar", "/ru/family/os/kodeks", "/ru/family/os/week", "/en/family/os/board"]) await page("member", member, p);
for (const p of ["/ru/family/os", "/ru/family/os/access", "/ru/family/os/people", "/ru/family/admin"]) await page("owner", admin, p);
// bus 172 P3: a child's Family OS is «Мой день» + «Календарь» (and their own page). Every other section sends them home
// on the server — before the page reads its data, so no /board, /council or /people/:id call is made for them.
const kidDay = await page("child", child, "/ru/family/os");
check("P3 child: «Мой день» in the menu, no Задачи / Решения / Люди / Кодекс links", kidDay.html.includes("Мой день") && !/href="\/ru\/family\/os\/(board|council|people"|kodeks|week|access)/.test(kidDay.html));
check("P3 child: «Мой день» does not read the family board", !kidDay.calls.includes("/board"), kidDay.calls.join(" "));
await page("child", child, "/ru/family/os/calendar");
await page("child", child, `/ru/family/os/people/${childId}`);
for (const p of ["/ru/family/os/board", "/ru/family/os/council", "/ru/family/os/people", `/ru/family/os/people/${memberId}`, "/ru/family/os/kodeks", "/ru/family/os/week"]) {
  const r = await page("child", child, p, 307, "/ru/family/os");
  check(`P3 child ${p}: nothing read past /me, /people, /my-tasks`, r.calls.every((c) => ["/me", "/people", "/my-tasks"].includes(c)), r.calls.join(" "));
}
await page("child", child, "/en/family/os/board", 307, "/en/family/os");

// The owner who is not a member: member-only sections and unknown addresses are the family 404 (N3).
for (const p of ["/ru/family/os/council", "/ru/family/os/board", "/ru/family/os/no-such-page"]) await page("owner", admin, p, 404);

// N3: on that 404 the owner's tabs are the same as on every other page — no Доска / Совет / Календарь.
const nf = await (await fetch(`${B}/ru/family/os/council`, { redirect: "manual", headers: { cookie: `${SESSION}=${admin}` } })).text();
const nav = nf.match(/<nav[^>]*data-family-subnav[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? "";
check("N3: owner (not a member) on the family 404 — sub-nav present", nav.includes("/ru/family/os/access"));
check("N3: …without Доска / Совет / Календарь", !/\/ru\/family\/os\/(board|council|calendar)"/.test(nav), nav.match(/href="[^"]+"/g)?.join(" ") ?? "");

// ── bus 172 P4: the invite wizard, «Ждут ответа» and the first-login tour ──
const api = (tok, method, path, body, origin = B) => fetch(B + path, { method, redirect: "manual", headers: { cookie: `${SESSION}=${tok}`, origin, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
const ownerPeople = await page("owner", admin, "/ru/family/os/people");
check("P4 owner «Люди»: «+ Пригласить» and «Ждут ответа» (nobody has signed in on this stand)", ownerPeople.html.includes("data-invite-open") && ownerPeople.html.includes("data-pending-invites"));
check("P4 owner «Люди»: one /adoption read", ownerPeople.calls.filter((c) => c === "/adoption").length === 1, ownerPeople.calls.join(" "));
const memberPeople = await page("member", member, "/ru/family/os/people");
check("P4 member «Люди»: no invite button, no pending cards, no /adoption read", !memberPeople.html.includes("data-invite-open") && !memberPeople.html.includes("data-pending-invites") && !memberPeople.calls.includes("/adoption"));
const listed = async (tok, email, origin) => { const r = await api(tok, "POST", "/api/family-invite", { email }, origin); return { status: r.status, state: (await r.json().catch(() => ({}))).state }; };
check("P4 access-list check: a listed address", (await listed(admin, MEMBER)).state === "listed");
check("P4 access-list check: an unknown address is not_listed", (await listed(admin, "new-person@example.com")).state === "not_listed");
check("P4 access-list check: a member gets the 404", (await listed(member, MEMBER)).status === 404);
check("P4 access-list check: another origin is refused", (await listed(admin, MEMBER, "https://evil.example")).status === 403);
check("P4 invite: the owner queues one (202)", (await api(admin, "POST", `/api/family-os/people/${childId}/invite`, {})).status === 202);
check("P4 cancel: a member is refused by the service (403)", (await api(member, "DELETE", `/api/family-os/people/${childId}/invite`)).status === 403);
check("P4 cancel: the owner cancels (200)", (await api(admin, "DELETE", `/api/family-os/people/${childId}/invite`)).status === 200);
check("P4 cancel: the cancelled invitation leaves «Ждут ответа»", !(await page("owner", admin, "/ru/family/os/people")).html.includes(`data-pending="${childId}"`));
const before = await page("member", member, "/ru/family/os");
check("P4 tour: «Сегодня» with the tour still costs the page no extra call (no letter-settings read in the render)", !before.calls.includes(`/people/${memberId}/prefs`), before.calls.join(" "));
const ownPrefs = await api(member, "GET", `/api/family-os/people/${memberId}/prefs`, undefined, B);
check("P4 tour: the browser loads the member's own letter settings (200)", ownPrefs.status === 200 && typeof (await ownPrefs.json()).prefs?.email_on === "boolean");
check("P4 tour: the owner (not a person) cannot read them (403)", (await api(admin, "GET", `/api/family-os/people/${memberId}/prefs`, undefined, B)).status === 403);
check("P4 tour: POST /api/family-os/onboarding (200)", (await api(member, "POST", "/api/family-os/onboarding", {})).status === 200);
check("P4 tour: Family OS now says onboarded", (await osCall("GET", "/me", `member:${MEMBER}`)).json?.onboarded === true);
const after = await page("member", member, "/ru/family/os");
check("P4 tour: once done, «Сегодня» is back to its own reads", after.calls.length === before.calls.length, `${before.calls.length} → ${after.calls.length}`);

os.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
