// E2E (bus 176 P4): the read-only guest end to end — the owner invites from the site, the guest opens only their
// sections (the blue bar, their menu, no write controls, within the call cap), everything else sends them to their
// home with a real 307, every write through the site is refused, «Отозвать» works on the next request, and an unknown
// guest is «pending» like any address off the list.
// Runs the real Family OS app (memory store, synthetic people) in this process on FAMILY_OS_URL's port (CI :18795) behind a counter, against
// `next start` with the CI e2e env. NOT part of `npm test`; CI `e2e` job.
//   node tests/e2e/family-guest.e2e.mjs
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { createApp } from "../../family-os/server.mjs";
import { memoryStore } from "../../family-os/store.mjs";
import { KODEKS_V1, KODEKS_V1_APPROVED_ON } from "../../family-os/kodeks.mjs";
import { signMediaRequest } from "../../app/lib/media-signature.mjs";
import { familySessionCookie, linkNonceCookie } from "../../app/lib/family-cookie.mjs";

const B = process.env.E2E_BASE ?? "http://localhost:3999";
const SESSION = familySessionCookie({ NODE_ENV: "production" });
const OS_SECRET = process.env.FAMILY_OS_SECRET, KEY = new TextEncoder().encode(process.env.FAMILY_SESSION_SECRET);
const MAX_CALLS = 12, OS_PORT = Number(new URL(process.env.FAMILY_OS_URL ?? "http://127.0.0.1:18795").port || 18795);
const RELAY_PORT = Number(new URL(process.env.FAMILY_MAIL_RELAY_URL ?? "http://127.0.0.1:18797").port || 18797), NONCE = linkNonceCookie({ NODE_ENV: "production" });
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

const calls = [];
const store = memoryStore();
const app = createApp({ store, secret: OS_SECRET, masterKey: randomBytes(32), passkeys: null });
const os = createServer((req, res) => { calls.push(req.url.split("?")[0]); return app(req, res); }).listen(OS_PORT, "127.0.0.1");
// A fake mail relay that keeps the letters the site sends (as in family-signin-code.e2e.mjs).
const letters = [];
const relay = createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c));
  req.on("end", () => { try { letters.push(JSON.parse(raw)); } catch { /* ignore */ } res.writeHead(202, { "content-type": "application/json" }); res.end('{"ok":true}'); });
}).listen(RELAY_PORT, "127.0.0.1");
await Promise.all([os, relay].map((s) => new Promise((r) => s.once("listening", r))));
const cookieOf = (res, name) => { const c = (res.headers.getSetCookie?.() ?? []).find((s) => s.startsWith(name + "=")); return c ? c.split(";")[0].slice(name.length + 1) : null; };
/** Ask for a sign-in as a browser would; the letter, if the site sent one. */
async function ask(email) {
  const n = letters.length;
  const r = await fetch(`${B}/api/family-auth/request`, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", origin: B }, body: JSON.stringify({ email, returnTo: "/ru/family" }) });
  const nonce = cookieOf(r, NONCE);
  let letter = null;
  for (let i = 0; i < 40 && !letter; i++) { await new Promise((s) => setTimeout(s, 50)); letter = letters.slice(n).find((l) => l.to === email) ?? null; }
  return { nonce, letter };
}
const osCall = async (method, path, actor, body) => {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: OS_SECRET, method, path, actor, body: raw });
  const r = await fetch(`http://127.0.0.1:${OS_PORT}${path}`, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: raw || undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ADMIN = "admin@example.com", MEMBER = "member@example.com", GUEST = "accountant@example.com", owner = `admin:${ADMIN}`;
const memberId = (await osCall("POST", "/people", owner, { email: MEMBER, name_en: "QA member", name_ru: "QA взрослый", kind: "adult" })).json.id;
const childId = (await osCall("POST", "/people", owner, { email: "child@example.com", name_en: "QA child", name_ru: "QA ребёнок", kind: "child" })).json.id;
await osCall("POST", "/grants", owner, { guardian_id: memberId, child_id: childId, relation: "parent", scopes: ["routines", "health", "education", "documents"] });
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
// The Кодекс v1, as production seeds it at start (ensureKodeks); here a parent adds it through the service.
await osCall("POST", "/kodeks", `member:${MEMBER}`, { body: KODEKS_V1, approved_on: KODEKS_V1_APPROVED_ON });
await osCall("PUT", `/plan/${today}`, `member:${MEMBER}`, { items: [] });
await osCall("POST", `/plan/${today}/tasks`, `member:${MEMBER}`, { title: "QA adult task", assignee_id: memberId });
await osCall("POST", `/plan/${today}/tasks`, `member:${MEMBER}`, { title: "QA secret child task", assignee_id: childId });

const nowS = () => Math.floor(Date.now() / 1000);
const session = (email) => new SignJWT({ email, typ: "session", amr: "link" }).setProtectedHeader({ alg: "HS256" }).setSubject(email).setIssuedAt(nowS() - 5).setExpirationTime(nowS() + 3600).sign(KEY);
const admin = await session(ADMIN), guest = await session(GUEST), stranger = await session("stranger@example.com");

async function page(who, tok, path, status = 200, location = null) {
  calls.length = 0;
  const r = await fetch(B + path, { redirect: "manual", headers: { cookie: `${SESSION}=${tok}` } });
  const html = await r.text(), loc = r.headers.get("location") ?? "";
  check(`${who} ${path}: ${status}${location ? ` → ${location}` : ""}, ≤ ${MAX_CALLS} OS calls`, r.status === status && (!location || new URL(loc, B).pathname === location) && calls.length <= MAX_CALLS,
    `${r.status}${loc ? ` → ${loc}` : ""} · ${calls.length} calls: ${calls.join(" ")}`);
  return { html, calls: [...calls] };
}
const api = (tok, method, path, body) => fetch(B + path, { method, redirect: "manual", headers: { cookie: `${SESSION}=${tok}`, origin: B, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
const plus = (n) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ── Before the invitation: the address is off the list → pending, like any unknown address; no letter ──
await page("guest (not invited yet)", guest, "/ru/family/os/calendar", 307, "/ru/family/pending");
check("no sign-in letter before the invitation", (await ask(GUEST)).letter === null);

// ── The owner invites from the site ──
const inv = await api(admin, "POST", "/api/family-os/guests", { email: GUEST, label: "Бухгалтер", sections: ["calendar", "review", "companies"], until: plus(90) });
check("owner invites a guest through the site (201)", inv.status === 201, String(inv.status));
check("an address on the family list cannot be a guest (409 is_member)", (await (await api(admin, "POST", "/api/family-os/guests", { email: MEMBER, label: "x", sections: ["calendar"], until: plus(5) })).json()).error === "is_member");
const memberTok = await session(MEMBER);
check("a member cannot invite (the service's 403)", (await api(memberTok, "POST", "/api/family-os/guests", { email: "x@example.com", label: "x", sections: ["calendar"], until: plus(5) })).status === 403);
check("a year at most (400)", (await api(admin, "POST", "/api/family-os/guests", { email: "y@example.com", label: "x", sections: ["calendar"], until: plus(400) })).status === 400);
const acc = await page("owner", admin, "/ru/family/os/access");
check("«Доступ и безопасность»: the guest, their sections and end date, «Отозвать»", acc.html.includes("data-guests") && acc.html.includes("Бухгалтер") && acc.html.includes("data-guest-revoke") && acc.html.includes("Обзор недели"));

// ── The guest signs in with the code from the letter, like a member ──
const asked = await ask(GUEST);
check("the invited guest gets the sign-in letter with a code", /^[0-9]{6}$/.test(asked.letter?.code ?? ""));
const typed = await fetch(`${B}/api/family-auth/verify`, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", origin: B, cookie: `${NONCE}=${asked.nonce}` }, body: JSON.stringify({ code: asked.letter?.code, returnTo: "/ru/family" }) });
const minted = cookieOf(typed, SESSION);
check("the code signs the guest in (200 + session)", typed.status === 200 && Boolean(minted), String(typed.status));
if (minted) await page("guest (fresh session)", minted, "/ru/family", 307, "/ru/family/os/calendar");
for (let i = 0; i < 20; i++) { if ((await osCall("GET", "/guests", owner)).json.guests[0]?.last_signin) break; await new Promise((s) => setTimeout(s, 50)); }
check("the sign-in is in the guest log", Boolean((await osCall("GET", "/guests", owner)).json.guests[0]?.last_signin));

// ── The guest's sections ──
await page("guest", guest, "/ru/family/os", 307, "/ru/family/os/calendar");
const cal = await page("guest", guest, "/ru/family/os/calendar");
check("guest calendar: the blue bar «Только чтение · доступ до …»", /data-guest-bar=""[^>]*>[\s\S]*?Только чтение · доступ до/.test(cal.html));
check("guest calendar: the menu holds only their sections", ["/ru/family/os/calendar", "/ru/family/os/review", "/ru/family/os/companies"].every((h) => cal.html.includes(`href="${h}"`))
  && !/href="\/ru\/family\/os\/(people|board|council|kodeks|access|week)"|href="\/ru\/family"|href="\/ru\/registry"/.test(cal.html));
check("guest calendar: no «Добавить событие» form", !cal.html.includes('name="on_date"'));
check("guest calendar: no /people read", !cal.calls.includes("/people"), cal.calls.join(" "));
const rv = await page("guest", guest, "/ru/family/os/review");
check("guest review: renders, without the child or the child's task, no «Фокус» form", rv.html.includes('data-review="done"') && !rv.html.includes("QA secret child task") && !rv.html.includes("QA ребёнок") && !rv.html.includes("data-focus-form"));
const co = await page("guest", guest, "/ru/family/os/companies");
check("guest companies: the cards render", co.html.includes('data-source="vault"'));
check("guest: «Гость · только чтение» in the user block", co.html.includes("Гость · только чтение"));

// ── Everything else: a real 307 to their home, before any page renders ──
for (const p of ["/ru/family/os/kodeks", "/ru/family/os/people", `/ru/family/os/people/${childId}`, "/ru/family/os/board", "/ru/family/os/council", "/ru/family/os/week", "/ru/family/os/access", "/ru/family", "/ru/family/admin", "/ru/core", "/ru/registry"]) {
  const r = await page("guest", guest, p, 307, "/ru/family/os/calendar");
  check(`guest ${p}: nothing read past the lookup`, r.calls.every((c) => c === "/guests/lookup"), r.calls.join(" "));
}
await page("guest", guest, "/en/family/os/no-such-page", 404);

// ── Writes and other reads through the site: refused before Family OS ──
for (const [m, p, b] of [["POST", "/api/family-os/events", { title: "x", on_date: plus(1) }], ["POST", "/api/family-os/guests", { email: "z@example.com" }], ["PUT", `/api/family-os/council/${plus(3)}`, { notes: "x", held: false }],
  ["GET", "/api/family-os/board", undefined], ["GET", `/api/family-os/people/${childId}/prefs`, undefined], ["POST", "/api/family-os/onboarding", {}]]) {
  calls.length = 0;
  const r = await api(guest, m, p, b);
  check(`guest ${m} ${p}: refused by the site (401), no write reached Family OS`, r.status === 401 && calls.every((c) => c === "/guests/lookup"), `${r.status} · ${calls.join(" ")}`);
}
const g = (await osCall("GET", "/guests", owner)).json.guests[0];
check("the service logged the guest's page views and reads", g.reads_30d >= 3, String(g.reads_30d));
check("the service refuses the guest's write itself (403 read_only)", (await osCall("POST", "/events", `guest:${g.id}`, { title: "x", on_date: plus(1) })).json?.error === "read_only");

// ── «Отозвать»: the next request ──
check("owner revokes (200)", (await api(admin, "POST", `/api/family-os/guests/${g.id}/revoke`, {})).status === 200);
await page("guest (revoked)", guest, "/ru/family/os/calendar", 307, "/ru/family/pending");
await page("stranger", stranger, "/ru/family/os/calendar", 307, "/ru/family/pending");
check("no sign-in letter after «Отозвать»", (await ask(GUEST)).letter === null);

// ── A second grant for the same address, «Документы и правила» only: the Кодекс reads, no edit, no names ──
check("re-invite after a revoke (201)", (await api(admin, "POST", "/api/family-os/guests", { email: GUEST, label: "Аудитор", sections: ["kodeks"], until: plus(7) })).status === 201);
await page("guest (kodeks only)", guest, "/ru/family/os/calendar", 307, "/ru/family/os/kodeks");
const kd = await page("guest (kodeks only)", guest, "/ru/family/os/kodeks");
check("guest kodeks: the text renders, no edit form, the bar, «Аудитор» in the user block", kd.html.includes("data-kodeks=") && !kd.html.includes('name="motto"') && kd.html.includes("data-guest-bar") && kd.html.includes("Аудитор"));

os.close(); relay.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
