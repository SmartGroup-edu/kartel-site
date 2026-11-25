// E2E (QA-156 H1): «Завершить сеансы» closes EVERYTHING for an older session — the Family OS API (/body,
// /body/export, DELETE /body), the family pages, family photos and the ICS feed — and a fresh session works.
// Runs the real Family OS app (memory store, synthetic people) in this process on :18795, against `next start`
// started with FAMILY_OS_URL=http://127.0.0.1:18795 and the env below. NOT part of `npm test`; CI `e2e` job.
//   FAMILY_OS_SECRET=e2e-os-secret-at-least-32-characters!! FAMILY_MEDIA_URL=http://127.0.0.1:9
//   FAMILY_MEDIA_SECRET=e2e-media-secret-at-least-32-characters (plus the family-auth e2e env)
//   node tests/e2e/family-ended.e2e.mjs
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { createApp } from "../../family-os/server.mjs";
import { memoryStore } from "../../family-os/store.mjs";
import { signMediaRequest } from "../../app/lib/media-signature.mjs";
import { familySessionCookie } from "../../app/lib/family-cookie.mjs";

const B = process.env.E2E_BASE ?? "http://localhost:3999";
const SESSION = familySessionCookie({ NODE_ENV: "production" });
const OS_SECRET = process.env.FAMILY_OS_SECRET, KEY = new TextEncoder().encode(process.env.FAMILY_SESSION_SECRET);
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

// ── Family OS, in process ──
const store = memoryStore();
const os = createServer(createApp({ store, secret: OS_SECRET, masterKey: randomBytes(32), passkeys: null })).listen(18795, "127.0.0.1");
await new Promise((r) => os.once("listening", r));
const osCall = async (method, path, actor, body) => {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const h = await signMediaRequest({ secret: OS_SECRET, method, path, actor, body: raw });
  const r = await fetch(`http://127.0.0.1:18795${path}`, { method, headers: { ...h, ...(raw ? { "content-type": "application/json" } : {}) }, body: raw || undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ADMIN = "admin@example.com", MEMBER = "member@example.com";
for (const [email, kind] of [[ADMIN, "adult"], [MEMBER, "adult"]]) {
  const id = (await osCall("POST", "/people", `admin:${ADMIN}`, { email, name_en: "QA", name_ru: "QA", kind })).json.id;
  await osCall("PATCH", `/people/${id}`, `admin:${ADMIN}`, { birth_date: "1985-06-01" });
}
const nowS = () => Math.floor(Date.now() / 1000);
const session = (email, iat) => new SignJWT({ email, typ: "session", amr: "link" }).setProtectedHeader({ alg: "HS256" }).setSubject(email).setIssuedAt(iat).setExpirationTime(iat + 8 * 3600).sign(KEY);
const as = (tok, extra = {}) => ({ redirect: "manual", headers: { cookie: `${SESSION}=${tok}`, ...extra } });
const site = (path, tok, init = {}) => fetch(B + path, { ...as(tok, init.origin ? { origin: B, "content-type": "application/json" } : {}), ...init });

// ── before: the member's older session works everywhere ──
const old = await session(MEMBER, nowS() - 600);
check("before: PUT /body/prefs on", (await site("/api/family-os/body/prefs", old, { method: "PUT", origin: true, body: JSON.stringify({ on: true }) })).status === 200);
check("before: PUT /body/log", (await site(`/api/family-os/body/log/${new Date().toISOString().slice(0, 10)}`, old, { method: "PUT", origin: true, body: JSON.stringify({ weight_kg: 71.4 }) })).status === 200);
check("before: GET /body → 200", (await site("/api/family-os/body", old)).status === 200);
check("before: /ru/family/os → 200", (await site("/ru/family/os", old)).status === 200);
const me = (await osCall("GET", `/me?sat=${nowS()}`, `member:${MEMBER}`)).json.me;
const ics = await site(`/api/family-os/people/${me.id}/ics`, old, { method: "POST", origin: true, body: "{}" });
const icsToken = ics.status === 200 || ics.status === 201 ? (await ics.json()).token : null;
check("before: an ICS link is issued", !!icsToken, `${ics.status}`);
check("before: the ICS feed is served", icsToken ? (await fetch(`${B}/api/family-ics/${icsToken}.ics`)).status === 200 : false);

// ── the owner ends every session ──
const admin = await session(ADMIN, nowS() - 1);
check("owner: «Завершить все сеансы» → 200", (await site("/api/family-os/sessions/end-all", admin, { method: "POST", origin: true, body: "{}" })).status === 200);
await new Promise((r) => setTimeout(r, 1100)); // the cut-off is rounded up to the second

// ── after: the older session is refused everywhere ──
for (const [what, init, path] of [["GET /body", {}, "/api/family-os/body"], ["GET /body/export", {}, "/api/family-os/body/export"], ["DELETE /body", { method: "DELETE", origin: true }, "/api/family-os/body"], ["GET /health", {}, "/api/family-os/health"]]) {
  const r = await site(path, old, init), b = await r.json().catch(() => null);
  check(`after: ${what} → 401 session_ended`, r.status === 401 && b?.error === "session_ended", `${r.status} ${b?.error}`);
}
for (const p of ["/ru/family/os", "/ru/family", "/en/family/os/people", "/ru/family/os/board"]) {
  const r = await site(p, old), loc = r.headers.get("location") ?? "";
  check(`after: page ${p} → sign-in «сеанс завершён», cookie cleared`, r.status === 307 && loc.includes("family_auth=ended") && (r.headers.getSetCookie().find((s) => s.startsWith(SESSION + "=")) ?? "").includes("Max-Age=0"), `${r.status} ${loc}`);
}
const media = await site(`/api/family-media/${randomUUID()}/640.webp`, old);
check("after: a family photo → 401", media.status === 401, `${media.status}`);
const ed = await site("/api/family-admin/draft", await session(ADMIN, nowS() - 600));
check("after: the family editor API (owner's older session) → 401 session_ended", ed.status === 401 && (await ed.json()).error === "session_ended", `${ed.status}`);
check("after: the ICS link is revoked", icsToken ? (await fetch(`${B}/api/family-ics/${icsToken}`)).status === 404 : false);

// ── a fresh sign-in works again ──
const fresh = await session(MEMBER, nowS() + 1);
check("fresh session: GET /body → 200 (data intact)", (await site("/api/family-os/body", fresh)).status === 200);
check("fresh session: /ru/family/os → 200", (await site("/ru/family/os", fresh)).status === 200);

os.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
