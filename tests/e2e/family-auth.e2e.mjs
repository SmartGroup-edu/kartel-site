// E2E: kartel-site standalone auth against a real server. NOT part of `npm test` (needs a server).
// Run:
//   npm run build
//   FAMILY_GATE=on FAMILY_SESSION_SECRET="e2e-secret-at-least-32-characters-long!!" \
//   FAMILY_APPROVED_EMAILS=member@example.com FAMILY_ADMIN_EMAILS=admin@example.com \
//   FAMILY_MAIL_RELAY_URL=http://127.0.0.1:9 FAMILY_MAIL_RELAY_SECRET=fake FAMILY_SITE_ORIGIN=http://localhost:3999 npx next start -p 3999 &
//   FAMILY_SESSION_SECRET="e2e-secret-at-least-32-characters-long!!" node tests/e2e/family-auth.e2e.mjs
// Never point this at production: it mints sign-in links with the secret it is given.
// End-to-end check of kartel-site standalone auth against a real `next start`.
// Runs outside the user's tree. Mints the link token itself with the known test secret, because
// the real link only exists inside an email.
import { SignJWT } from "jose";

const B = "http://localhost:3999";
const SECRET = process.env.FAMILY_SESSION_SECRET;
const linkKey = new TextEncoder().encode(`${SECRET}:link`);
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

const cookieOf = (res, name) => {
  const all = res.headers.getSetCookie?.() ?? [];
  const c = all.find((s) => s.startsWith(name + "="));
  return c ? c.split(";")[0].slice(name.length + 1) : null;
};
const req = (path, opts = {}) => fetch(B + path, { redirect: "manual", ...opts });
const post = (email) => req("/api/family-auth/request", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, returnTo: "/en/family" }),
});
const mint = (email, nonce, ttl = 600, rt = "/en/family", key = linkKey) =>
  new SignJWT({ email, nonce, rt, typ: "link" })
    .setProtectedHeader({ alg: "HS256" }).setSubject(email).setIssuedAt()
    .setExpirationTime(new Date(Date.now() + ttl * 1000)).sign(key);
const verify = (tok, nonce) => req(`/api/family-auth/verify?token=${encodeURIComponent(tok)}`,
  { headers: { cookie: `kartel_family_link=${nonce}` } });
const invalid = (r) => (r.headers.get("location") ?? "").includes("family_auth=invalid") && !cookieOf(r, "kartel_family_session");

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
const session = cookieOf(vOk, "kartel_family_session");
check("valid link + matching nonce → session", vOk.status === 307 && !!session, `${vOk.status} → ${vOk.headers.get("location")}`);
check("redirects to returnTo", (vOk.headers.get("location") ?? "").endsWith("/en/family"));
check("nonce cleared after use", (vOk.headers.getSetCookie().find((s) => s.startsWith("kartel_family_link=")) ?? "").includes("Max-Age=0"));
check("same link, other browser → refused", invalid(await verify(tokM, "other-browser")));
check("expired link → refused", invalid(await verify(await mint("member@example.com", nM, -5), nM)));
check("validly signed link for a NON-member → refused at verify", invalid(await verify(await mint("stranger@example.com", nU), nU)));
check("link signed with a foreign key → refused",
  invalid(await verify(await mint("member@example.com", nM, 600, "/en/family", new TextEncoder().encode("attacker-key-at-least-32-characters-long")), nM)));
const vEvil = await verify(await mint("member@example.com", nM, 600, "https://evil.example"), nM);
check("off-site returnTo neutralised", !(vEvil.headers.get("location") ?? "").includes("evil.example"), vEvil.headers.get("location"));

// ── the gate itself ──
const fam = await req("/en/family", { headers: { cookie: `kartel_family_session=${session}` } });
check("member session → /en/family passes the edge", fam.status === 200, `${fam.status}`);
const conM = await req("/console", { headers: { cookie: `kartel_family_session=${session}` } });
check("member session → /console refused", conM.status === 307, `${conM.status}`);
const nA = cookieOf(await post("admin@example.com"), "kartel_family_link");
const adminSession = cookieOf(await verify(await mint("admin@example.com", nA), nA), "kartel_family_session");
const conA = await req("/console", { headers: { cookie: `kartel_family_session=${adminSession}` } });
check("admin session → /console allowed (FAMILY_ADMIN_EMAILS)", conA.status === 200, `${conA.status}`);
const asSession = await req("/en/family", { headers: { cookie: `kartel_family_session=${tokM}` } });
check("a link token presented as a session → refused", asSession.status === 307, `${asSession.status}`);
const out = await req("/api/family-auth/logout", { headers: { cookie: `kartel_family_session=${session}` } });
check("logout clears the session", (out.headers.getSetCookie().find((s) => s.startsWith("kartel_family_session=")) ?? "").includes("Max-Age=0"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
