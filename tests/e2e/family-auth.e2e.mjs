// E2E: kartel-site standalone auth against a real server. NOT part of `npm test` (needs a server); CI runs it in
// the `e2e` job (.github/workflows/ci.yml). Run:
//   npm run build
//   FAMILY_GATE=on FAMILY_SESSION_SECRET="e2e-secret-at-least-32-characters-long!!" \
//   FAMILY_APPROVED_EMAILS=member@example.com FAMILY_ADMIN_EMAILS=admin@example.com \
//   FAMILY_MAIL_RELAY_URL=http://127.0.0.1:9 FAMILY_MAIL_RELAY_SECRET=fake FAMILY_SITE_ORIGIN=http://localhost:3999 npx next start -p 3999 &
//   FAMILY_SESSION_SECRET="e2e-secret-at-least-32-characters-long!!" node tests/e2e/family-auth.e2e.mjs
// Never point this at production: it mints sign-in links with the secret it is given.
// End-to-end check of kartel-site standalone auth against a real `next start`.
// Runs outside the user's tree. Mints the link token itself with the known test secret, because
// the real link only exists inside an email.
// QA-156 M8: the session cookie's name comes from the app (familySessionCookie). `next start` is production, so it
// is the `__Host-` name. A hard-coded old name made the refusal checks pass without checking anything.
import { SignJWT } from "jose";
import { familySessionCookie, SESSION_COOKIE_LEGACY } from "../../app/lib/family-cookie.mjs";

const B = process.env.E2E_BASE ?? "http://localhost:3999";
const SESSION = familySessionCookie({ NODE_ENV: "production" });
const SECRET = process.env.FAMILY_SESSION_SECRET;
const linkKey = new TextEncoder().encode(`${SECRET}:link`);
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

const cookieOf = (res, name) => {
  const all = res.headers.getSetCookie?.() ?? [];
  const c = all.find((s) => s.startsWith(name + "="));
  return c ? c.split(";")[0].slice(name.length + 1) : null;
};
const setCookie = (res, name) => (res.headers.getSetCookie?.() ?? []).find((s) => s.startsWith(name + "=")) ?? "";
const req = (path, opts = {}) => fetch(B + path, { redirect: "manual", ...opts });
const post = (email, origin = B) => req("/api/family-auth/request", {
  method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
  body: JSON.stringify({ email, returnTo: "/en/family" }),
});
const mint = (email, nonce, ttl = 600, rt = "/en/family", key = linkKey) =>
  new SignJWT({ email, nonce, rt, typ: "link" })
    .setProtectedHeader({ alg: "HS256" }).setSubject(email).setIssuedAt()
    .setExpirationTime(new Date(Date.now() + ttl * 1000)).sign(key);
const verify = (tok, nonce) => req(`/api/family-auth/verify?token=${encodeURIComponent(tok)}`,
  { headers: { cookie: `kartel_family_link=${nonce}` } });
const invalid = (r) => (r.headers.get("location") ?? "").includes("family_auth=invalid") && !cookieOf(r, SESSION);
const as = (tok, name = SESSION) => ({ headers: { cookie: `${name}=${tok}` } });

// ── enumeration: body, headers, timing ──
const time = async (email) => { const t = performance.now(); const r = await post(email); const b = await r.text(); return [r, performance.now() - t, b]; };
await time("warmup@example.com");
const sU = [], sM = [];
let rU, rM, bU, bM;
for (let i = 0; i < 5; i++) {
  let t; [rU, t, bU] = await time("stranger@example.com"); sU.push(t);
  [rM, t, bM] = await time("member@example.com"); sM.push(t);
}
const med = (a) => [...a].sort((x, y) => x - y)[2];
check("body identical for member and stranger", bU === bM);
const nU = cookieOf(rU, "kartel_family_link"), nM = cookieOf(rM, "kartel_family_link");
check("nonce cookie set for stranger too", !!nU);
check("nonce cookie set for member", !!nM);
const shape = (r) => r.headers.getSetCookie().map((s) => s.replace(/=[^;]+/, "=X")).join("|");
check("Set-Cookie shape identical", shape(rU) === shape(rM));
check("response time independent of membership (median of 5)", Math.abs(med(sU) - med(sM)) < 50,
  `stranger ${med(sU).toFixed(0)}ms vs member ${med(sM).toFixed(0)}ms`);

// ── verify: the real sign-in ──
const tokM = await mint("member@example.com", nM);
const vOk = await verify(tokM, nM);
const session = cookieOf(vOk, SESSION);
check("valid link + matching nonce → session", vOk.status === 307 && !!session, `${vOk.status} → ${vOk.headers.get("location")}`);
check("the session cookie is host-only, Secure, HttpOnly (QA-156 L2)", /; Secure/i.test(setCookie(vOk, SESSION)) && /HttpOnly/i.test(setCookie(vOk, SESSION)) && !/Domain=/i.test(setCookie(vOk, SESSION)));
check("redirects to returnTo", (vOk.headers.get("location") ?? "").endsWith("/en/family"));
check("nonce cleared after use", setCookie(vOk, "kartel_family_link").includes("Max-Age=0"));
check("same link, other browser → refused", invalid(await verify(tokM, "other-browser")));
check("expired link → refused", invalid(await verify(await mint("member@example.com", nM, -5), nM)));
check("validly signed link for a NON-member → refused at verify", invalid(await verify(await mint("stranger@example.com", nU), nU)));
check("link signed with a foreign key → refused",
  invalid(await verify(await mint("member@example.com", nM, 600, "/en/family", new TextEncoder().encode("attacker-key-at-least-32-characters-long")), nM)));
const vEvil = await verify(await mint("member@example.com", nM, 600, "https://evil.example"), nM);
check("off-site returnTo neutralised", !(vEvil.headers.get("location") ?? "").includes("evil.example"), vEvil.headers.get("location"));

// ── the gate itself ──
const fam = await req("/en/family", as(session));
check("member session → /en/family passes the edge", fam.status === 200, `${fam.status}`);
check("the same session under the old __Secure- name → sign-in (never read)", (await req("/en/family", as(session, SESSION_COOKIE_LEGACY))).status === 307);
const conM = await req("/console", as(session));
check("member session → /console refused", conM.status === 307, `${conM.status}`);
const nA = cookieOf(await post("admin@example.com"), "kartel_family_link");
const adminSession = cookieOf(await verify(await mint("admin@example.com", nA), nA), SESSION);
check("admin signs in (control for the refusals around it)", !!adminSession);
const conA = await req("/console", as(adminSession));
check("admin session → /console allowed (FAMILY_ADMIN_EMAILS)", conA.status === 200, `${conA.status}`);
const asSession = await req("/en/family", as(tokM));
check("a link token presented as a session → refused", asSession.status === 307, `${asSession.status}`);

// QA-156 M6: a refusal is the family not-found PAGE with a real 404 — a title, a language, a way back.
for (const p of ["/en/family/os/access", "/ru/family/os/access", "/en/family/admin"]) {
  const r = await req(p, as(session)), html = await r.text();
  const page = /<title>[^<]+<\/title>/.test(html) && /<html[^>]* lang="(en|ru)"/.test(html) && /<main/.test(html) && /href="\/(en|ru)\/family/.test(html);
  check(`member → ${p}: 404 page (title, lang, main, link back)`, r.status === 404 && page, `${r.status}`);
}
check("owner → /en/family/os/access is not refused", (await req("/en/family/os/access", as(adminSession))).status !== 404);
check("an unknown family address → the same 404 page", (await req("/en/family/no-such-page", as(session))).status === 404);

// QA-156 M1: a sign-in link may be requested only from the site's own pages.
check("request without Origin → 403", (await post("member@example.com", null)).status === 403);
check("request from another site → 403", (await post("member@example.com", "https://evil.example")).status === 403);

// QA-156 L1: sign-out is a POST from the site; a cross-site link or image cannot sign anyone out.
check("logout by GET → not served", (await req("/api/family-auth/logout", as(session))).status === 405);
const xOut = await req("/api/family-auth/logout", { method: "POST", headers: { cookie: `${SESSION}=${session}`, origin: "https://evil.example" } });
check("logout POST from another site → 403, session kept", xOut.status === 403 && !setCookie(xOut, SESSION));
const out = await req("/api/family-auth/logout", { method: "POST", headers: { cookie: `${SESSION}=${session}`, origin: B } });
check("logout clears the session", out.status === 303 && setCookie(out, SESSION).includes("Max-Age=0"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
