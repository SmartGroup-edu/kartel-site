// QA-156 fixes on the site side (R0 25.11, bus 157). Behaviour where the module is plain ESM; the source shape
// where it is a Next route (the live behaviour is in tests/e2e/family-auth.e2e.mjs and family-ended.e2e.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { osSessionState, PHOTO_CACHE_MS } from "../app/lib/family-os-session.mjs";
import { mintConsoleToken, verifyConsoleToken } from "../app/lib/console-auth.mjs";
import { consoleSessionCookie } from "../app/lib/family-cookie.mjs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ENV = { FAMILY_OS_URL: "http://os.test", FAMILY_OS_SECRET: "os-secret-at-least-32-characters-long!!" };
const fakeFetch = (status, body) => { const calls = []; const f = async (url, init) => { calls.push({ url: String(url), init }); if (status === "throw") throw new Error("down"); return new Response(JSON.stringify(body), { status }); }; f.calls = calls; return f; };
let n = 1000;
const s = (extra = {}) => ({ email: "member@example.test", admin: false, iat: n++, ...extra });

test("H1: the site asks Family OS about a session — /me signed with the session's sat; only an explicit session_ended ends it", async () => {
  const f = fakeFetch(401, { error: "session_ended" });
  assert.deepEqual(await osSessionState({ email: "Member@example.test", admin: false, iat: 1764000000 }, ENV, f), { state: "ended", member: false, child: false, id: null }); // bus 172 P3: + child, id
  assert.match(f.calls[0].url, /\/me\?sat=1764000000$/);
  assert.equal(f.calls[0].init.headers["x-kartel-actor"], "member:member@example.test");
  assert.equal((await osSessionState(s({ admin: true }), ENV, fakeFetch(200, { me: { id: "x" }, admin: true }))).state, "ok");
  assert.equal((await osSessionState(s(), ENV, fakeFetch(200, { me: null, admin: false }))).member, false);
  assert.equal((await osSessionState(s(), ENV, fakeFetch(200, { me: { id: "x" } }))).member, true);
  assert.equal((await osSessionState(s(), ENV, fakeFetch(401, { error: "unauthorized" }))).state, "unknown", "a bad signature is not an ended session");
  assert.equal((await osSessionState(s(), ENV, fakeFetch(503, {}))).state, "unknown");
  assert.equal((await osSessionState(s(), ENV, fakeFetch("throw"))).state, "unknown", "service down → the caller decides (pages fail closed via sat)");
  assert.equal((await osSessionState(s(), {}, fakeFetch(200, {}))).state, "unknown", "Family OS off");
});

test("H1: pages ask every time; photos may reuse an answer for 30 s; an ended session stays ended", async () => {
  const one = s(), ok = fakeFetch(200, { me: { id: "x" } }), ended = fakeFetch(401, { error: "session_ended" });
  await osSessionState(one, ENV, ok);
  assert.equal((await osSessionState(one, ENV, ended)).state, "ended", "no cache by default: the page sees the end at once");
  assert.equal((await osSessionState(one, ENV, ok)).state, "ended", "ended is remembered");
  const two = s();
  await osSessionState({ ...two, cacheMs: PHOTO_CACHE_MS }, ENV, ok);
  assert.equal((await osSessionState({ ...two, cacheMs: PHOTO_CACHE_MS }, ENV, ended)).state, "ok", "a photo within 30 s reuses the answer");
  assert.equal(PHOTO_CACHE_MS, 30_000);
});

test("H1 wiring: edge gate, family-media, the editor API and every Family OS call carry the cut-off", () => {
  const proxy = src("proxy.ts");
  assert.match(proxy, /const os = await osSessionState\(\{ email: email \|\| sub, admin: owner, iat \}\);\s*if \(os\.state === "ended"\) return sessionEnded\(request, lang, pathname\);/);
  assert.match(proxy, /res\.cookies\.set\(familySessionCookie\(\), "", \{[^}]*maxAge: 0 \}\)/, "the cookie is cleared");
  assert.match(proxy, /family\/signin\?\$\{ENDED_PARAM\}/);
  assert.match(src("app/api/family-media/[id]/[variant]/route.ts"), /if \(await sessionEndedByOwner\(session, \{ cacheMs: PHOTO_CACHE_MS \}\)\) \{ await destroySession\(\); return deny\(401\); \}/);
  assert.match(src("app/api/family-admin/[...op]/route.ts"), /if \(await sessionEndedByOwner\(session\)\) \{ await destroySession\(\); return json\(401, \{ error: "session_ended" \}\); \}/);
  const route = src("app/api/family-os/[...op]/route.ts");
  assert.match(route, /if \(r\.status === 401 && \(await r\.clone\(\)\.json\(\)\.catch\(\(\) => null\)\)\?\.error === "session_ended"\) await destroySession\(\);/, "reads end the site session too");
  const os = src("app/lib/family-os.ts");
  assert.doesNotMatch(os, /osCall\("GET", "\//, "no server-side read without sat");
  assert.match(os, /const r = await osGet\(withSat\(path, session\), osActor\(session\)\);/, "reads go through the per-request cache (QA-158 N2), still with sat");
  assert.doesNotMatch(os, /osGet\("\//, "no cached read without sat");
  assert.match(os, /osCall\("POST", "\/signins"/, "the sign-in note alone goes without (the service exempts it)");
});

test("L7: the owner who is not a member: those sections answer 404; unknown family addresses too", () => {
  const proxy = src("proxy.ts");
  assert.match(proxy, /const MEMBER_ONLY = \/\^\\\/\(en\|ru\)\\\/family\\\/os\\\/\(board\|council\|calendar\|kodeks\|week\|review\)/);
  assert.match(proxy, /if \(MEMBER_ONLY\.test\(pathname\) && owner && os\.state === "ok" && !os\.member\) return familyNotFound\(request, lang, pathname\);/);
  assert.match(proxy, /if \(!FAMILY_ROUTES\.test\(pathname\)\) return familyNotFound\(request, lang, pathname\);/);
  const re = new RegExp(proxy.match(/const FAMILY_ROUTES = \/(.+)\/;/)[1]);
  for (const ok of ["/ru/family", "/en/family/admin", "/ru/family/os", "/ru/family/os/kodeks", "/ru/family/os/review", "/ru/family/os/companies", "/en/family/os/people", "/ru/family/os/people/0b5e6b0e-1f2a-4c3d-9e8f-0123456789ab"]) assert.ok(re.test(ok), ok);
  for (const no of ["/ru/family/x", "/ru/family/os/people/abc", "/ru/family/os/kodeks/v2", "/ru/family/os/companies/x", "/en/family/os/nothing"]) assert.ok(!re.test(no), no);
});

test("L2: the console's own cookie — a 60-second hand-off token turns into a host-only console session; tokens never cross", async () => {
  const env = { FAMILY_SESSION_SECRET: "e2e-secret-at-least-32-characters-long!!" };
  const h = await mintConsoleToken({ email: "Owner@example.test", sat: 1764000000, typ: "console-handoff", ttl: 60 }, env);
  assert.deepEqual((({ email, sat }) => ({ email, sat }))(await verifyConsoleToken(h, "console-handoff", env)), { email: "owner@example.test", sat: 1764000000 });
  assert.equal(await verifyConsoleToken(h, "console", env), null, "a hand-off token is not a console session");
  assert.equal(await verifyConsoleToken(h, "console-handoff", { FAMILY_SESSION_SECRET: "another-secret-at-least-32-characters!!" }), null);
  const expired = await mintConsoleToken({ email: "o@example.test", sat: 1, typ: "console-handoff", ttl: -5 }, env);
  assert.equal(await verifyConsoleToken(expired, "console-handoff", env), null);
  assert.equal(consoleSessionCookie({ NODE_ENV: "production" }), "__Host-kartel_console_session");
  const proxy = src("proxy.ts");
  assert.match(proxy, /if \(onConsoleHost\) \{[\s\S]{0,400}verifyConsoleToken\(request\.cookies\.get\(consoleSessionCookie\(\)\)\?\.value, "console"\)/);
  assert.match(src("app/api/family-auth/console-handoff/route.ts"), /familyEnv\.adminEmails\(\)\.includes/);
});

test("L1 + M1: sign-out is a same-origin POST; a sign-in link is requested only from the site", () => {
  const out = src("app/api/family-auth/logout/route.ts");
  assert.doesNotMatch(out, /export async function GET/);
  assert.match(out, /export async function POST[\s\S]*if \(request\.headers\.get\("origin"\) !== familyEnv\.siteOrigin\(\)\) return new NextResponse\("Forbidden", \{ status: 403 \}\);/);
  assert.match(src("app/content/siteNav.ts"), /href: "\/api\/family-auth\/logout", post: true/);
  const h = src("app/components/SiteHeader.tsx");
  assert.equal((h.match(/<form key=\{item\.href\} method="post" action=\{item\.href\}/g) ?? []).length, 2, "desktop and mobile menus");
  assert.match(src("app/api/family-auth/request/route.ts"), /if \(!familyEnv\.gateOn\(\)\)[^\n]*\n\s*if \(request\.headers\.get\("origin"\) !== familyEnv\.siteOrigin\(\)\) return new NextResponse\("Forbidden", \{ status: 403 \}\);/);
});

test("L3: with Edge Config connected but unreadable, seed addresses are refused (a revocation there could not be seen)", () => {
  const a = src("app/lib/family-access.ts");
  assert.match(a, /if \(process\.env\.EDGE_CONFIG\) \{\s*try \{[\s\S]*?\} catch \{[\s\S]*?return false;/);
  assert.ok(a.indexOf("return false;") < a.indexOf("familyEnv.approvedEmails().includes(em)"), "the seed is read only after Edge Config answered");
});

test("L7: the owner who is not a member has no Доска, Совет or Календарь in the family sub-nav", async () => {
  const { familySubNav } = await import("../app/lib/family-nav.mjs");
  const ids = (o) => familySubNav({ lang: "RU", ...o }).map((i) => i.id);
  assert.deepEqual(ids({ admin: true, os: true, member: false }), ["heritage", "today", "people", "access", "admin"]);
  assert.deepEqual(ids({ admin: true, os: true }), ["heritage", "today", "board", "people", "council", "calendar", "access", "admin"], "a member owner keeps everything");
  assert.deepEqual(ids({ admin: false, os: true }), ["heritage", "today", "board", "people", "council", "calendar"]);
  for (const f of ["FamilyClient.tsx", "FamilyAdmin.tsx"]) assert.match(src(`app/components/${f}`), /<FamilySubNav [^>]*member=\{/, f);
  // bus 171: inside Family OS the shell draws the sections, with the same rule
  const { osShellNav } = await import("../app/lib/family-os-shell.mjs");
  const shell = (o) => osShellNav({ lang: "RU", ...o }).groups.flatMap((g) => g.items.map((i) => i.id));
  assert.deepEqual(shell({ admin: true, os: true, member: false }), ["today", "people", "heritage", "companies", "access", "admin"]);
  assert.match(src("app/[lang]/family/os/layout.tsx"), /member: Boolean\(state\.me\)/);
});

test("M2 UI: the owner's «Взрослый, 18+» switch appears only when the service sends adult_confirmed", () => {
  const p = src("app/components/FamilyOsPerson.tsx");
  assert.match(p, /\{typeof p\.adult_confirmed === "boolean" && <FamilyAdultConfirm lang=\{lang\} personId=\{p\.id\} confirmed=\{p\.adult_confirmed\} \/>\}/);
  const c = src("app/components/FamilyAdultConfirm.tsx");
  assert.match(c, /method: "PATCH"[^\n]*JSON\.stringify\(\{ adult_confirmed: next \}\)/);
  assert.match(c, /aria-describedby/);
});
