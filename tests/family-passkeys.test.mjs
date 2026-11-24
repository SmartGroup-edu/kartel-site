// Passkeys on the site (bus 98 design; bus 100 review C1–C4 and (a)).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canRegister, REGISTER_FRESH_MS, PK_COOKIE, pkCookieOptions, validChallengeId } from "../app/lib/family-passkey-rules.mjs";

const src = (f) => readFileSync(f, "utf8");
const now = new Date("2026-11-18T12:00:00Z");
const at = (min) => new Date(now.getTime() - min * 60_000);

test("(a) a new key only from an EMAIL-LINK session minted ≤ 15 minutes ago — never from a passkey session", () => {
  assert.equal(REGISTER_FRESH_MS, 15 * 60_000);
  assert.equal(canRegister({ amr: "link", issuedAt: at(1) }, now), true);
  assert.equal(canRegister({ amr: "link", issuedAt: at(15) }, now), true);
  assert.equal(canRegister({ amr: "link", issuedAt: at(16) }, now), false, "older than 15 minutes");
  assert.equal(canRegister({ amr: "pk", issuedAt: at(1) }, now), false, "a passkey session cannot enrol another key");
  assert.equal(canRegister({ amr: "link", issuedAt: new Date(now.getTime() + 60_000) }, now), false, "a future iat is not fresh");
  assert.equal(canRegister(null, now), false);
});

test("C2: the challenge cookie is __Host- (Secure, HttpOnly, Lax, Path=/, no Domain, 5 minutes); ids must be UUIDs", () => {
  assert.equal(PK_COOKIE, "__Host-kartel_pk");
  assert.deepEqual(pkCookieOptions(), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 300 });
  assert.ok(!("domain" in pkCookieOptions()));
  assert.equal(validChallengeId("0b5e6b0e-1f2a-4c3d-9e8f-0123456789ab"), true);
  assert.equal(validChallengeId("x; Path=/"), false);
});

test("sign-in route: re-checks the allowlist after the key verifies, mints the same session marked pk, one 401 for every failure", () => {
  const v = src("app/api/family-auth/passkey/verify/route.ts");
  assert.match(v, /if \(r\.status !== 200 \|\| !email \|\| !\(await isViewerApproved\(email, email\)\)\) return fail\(\);/);
  assert.match(v, /await createSession\(\{ email, name: null, amr: "pk" \}\);/);
  assert.match(v, /const challengeId = await takeChallenge\(\);/, "the bound challenge is read and cleared");
  assert.match(src("app/api/family-auth/passkey/options/route.ts"), /osPk\("\/passkeys\/auth\/options", "auth:passkey"\)/);
  const auth = src("app/lib/family-auth.ts");
  assert.match(auth, /typ: "session", amr: data\.amr \?\? "link"/);
  assert.match(auth, /amr: payload\.amr === "pk" \? "pk" : "link"/);
});

test("registration routes: approved viewer + canRegister on BOTH steps; Origin + JSON enforced; feature dormant unless FAMILY_PASSKEYS=on", () => {
  for (const f of ["app/api/family-auth/passkey/register/options/route.ts", "app/api/family-auth/passkey/register/verify/route.ts"]) {
    const s = src(f);
    assert.match(s, /if \(decision !== "allow" \|\| !session\) return pjson\(401/); assert.match(s, /if \(!canRegister\(session\)\) return pjson\(403, \{ error: "reauth" \}\);/);
  }
  const h = src("app/lib/family-passkeys.ts");
  assert.match(h, /!familyEnv\.passkeysOn\(\)/); assert.match(h, /req\.headers\.get\("origin"\) !== familyEnv\.siteOrigin\(\)/); assert.match(h, /startsWith\("application\/json"\)/);
  assert.match(src("app/lib/family-env.ts"), /passkeysOn: \(\): boolean => process\.env\.FAMILY_PASSKEYS === "on"/);
});

test("UI: «Вход» shows no credential id; adding only when the server says so; parents/owner never see «Добавить»; sign-in offers the button + autofill", () => {
  const c = src("app/components/FamilyPasskeys.tsx");
  assert.doesNotMatch(c, /credential_id|credentialID|public_?key/i);
  assert.match(c, /\{self && \(!supported \?/, "only on one's own keys");
  assert.match(c, /: canAdd \? <p className="mt-4"><button type="button" data-passkey-add=""/);
  const page = src("app/[lang]/family/os/people/[id]/page.tsx");
  assert.match(page, /canAdd: self && canRegister\(session\)/);
  const g = src("app/components/FamilyGateNotice.tsx");
  assert.match(g, /autoComplete=\{passkeys \? "email webauthn" : "email"\}/); assert.match(g, /useBrowserAutofill: autofill/);
  const proxy = src("app/api/family-os/[...op]/route.ts");
  assert.match(proxy, /passkeys\/mine\|people\/\$\{ID\}\/passkeys/); assert.match(proxy, /passkeys\/\$\{ID\}\/\(revoke\|clear-flag\)/);
});

test("C4: exact pins — @simplewebauthn/server 14.0.3 (root dev + family-os), @simplewebauthn/browser 14.0.0; the lockfiles agree", () => {
  const root = JSON.parse(src("package.json")), fo = JSON.parse(src("family-os/package.json"));
  assert.equal(root.dependencies["@simplewebauthn/browser"], "14.0.0");
  assert.equal(root.devDependencies["@simplewebauthn/server"], "14.0.3");
  assert.equal(fo.dependencies["@simplewebauthn/server"], "14.0.3");
  const lock = JSON.parse(src("package-lock.json")), flock = JSON.parse(src("family-os/package-lock.json"));
  assert.equal(lock.packages["node_modules/@simplewebauthn/server"].version, "14.0.3");
  assert.equal(lock.packages["node_modules/@simplewebauthn/browser"].version, "14.0.0");
  assert.equal(flock.packages["node_modules/@simplewebauthn/server"].version, "14.0.3");
  for (const p of [lock.packages["node_modules/@simplewebauthn/server"], lock.packages["node_modules/@simplewebauthn/browser"], flock.packages["node_modules/@simplewebauthn/server"]]) assert.match(p.integrity, /^sha512-/);
});
