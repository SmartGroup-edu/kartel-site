// Go-live bundle (bus 103/105): the `__Secure-` session cookie and R1 «Завершить сеансы» on the site side.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { familySessionCookie, SESSION_COOKIE_PROD, SESSION_COOKIE_DEV } from "../app/lib/family-cookie.mjs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("session cookie: __Secure-kartel_family_session in production, the plain name in dev; no env override", () => {
  assert.equal(familySessionCookie({ NODE_ENV: "production" }), "__Secure-kartel_family_session");
  assert.equal(familySessionCookie({ NODE_ENV: "development" }), "kartel_family_session");
  assert.equal(familySessionCookie({ NODE_ENV: "production", FAMILY_SESSION_COOKIE: "kartel_family_session" }), SESSION_COOKIE_PROD, "a stale env value can't bring the old name back");
  assert.equal(SESSION_COOKIE_DEV, "kartel_family_session");
  for (const f of ["proxy.ts", "app/lib/family-env.ts", "app/lib/family-auth.ts"]) assert.doesNotMatch(src(f), /process\.env\.FAMILY_SESSION_COOKIE/, `${f} must not read FAMILY_SESSION_COOKIE`);
  const proxy = src("proxy.ts");
  assert.equal((proxy.match(/familySessionCookie\(\)/g) ?? []).length, 2, "the family gate and the console gate read the same name");
  assert.match(src("app/lib/family-env.ts"), /sessionCookie: \(\): string => familySessionCookie\(\)/);
});

test("session cookie: Secure exactly in production (a __Secure- name needs it), Domain kept for the console", () => {
  const auth = src("app/lib/family-auth.ts");
  const set = auth.slice(auth.indexOf("export async function createSession"), auth.indexOf("export async function destroySession"));
  assert.match(set, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(set, /domain: process\.env\.FAMILY_COOKIE_DOMAIN \|\| undefined/);
  assert.match(set, /httpOnly: true/); assert.match(set, /sameSite: "lax"/);
  const del = auth.slice(auth.indexOf("export async function destroySession"));
  assert.match(del.slice(0, 400), /secure: process\.env\.NODE_ENV === "production"[\s\S]*domain: process\.env\.FAMILY_COOKIE_DOMAIN/, "sign-out clears the same cookie");
});

test("R1: every Family OS call from the proxy carries the signed `sat`; the register routes too; session_ended ends the site session", () => {
  const proxy = src("app/api/family-os/[...op]/route.ts");
  assert.match(proxy, /const path = withSat\(rawPath, who\.session\), actor = who\.actor;\s*const h = await signMediaRequest\(\{[^}]*path,/, "sat is inside the signed path");
  assert.doesNotMatch(proxy, /^let /m, "no module-level request state (concurrent requests share an instance)");
  assert.match(proxy, /if \(status === 401 && body\?\.error === "session_ended"\) \{ await destroySession\(\);/);
  assert.match(proxy, /if \(r\.status === 401\) return ended\(401,/, "a document file read also ends the session");
  assert.match(proxy, /people\/\$\{ID\}\/end-sessions\|sessions\/end-all\)\$/, "the owner's two actions are forwarded (the service checks the owner)");
  for (const step of ["options", "verify"]) {
    const r = src(`app/api/family-auth/passkey/register/${step}/route.ts`);
    assert.match(r, new RegExp(`osPk\\(withSat\\("/passkeys/register/${step}", session\\)`));
    assert.match(r, /if \(r\.status === 401 && r\.body\.error === "session_ended"\) \{ await destroySession\(\);/);
  }
  const os = src("app/lib/family-os.ts");
  assert.match(os, /export function withSat\(path: string, session: \{ issuedAt\?: Date \| null \}\): string \{\s*const sat = session\.issuedAt \? Math\.floor\(session\.issuedAt\.getTime\(\) \/ 1000\) : 0;/);
});

test("R1 UI: the owner's «Завершить все сеансы» on «Кто уже с нами» and «Завершить сеансы» in a person's «Вход»; both ask first", () => {
  const a = src("app/components/FamilyAdoption.tsx"), k = src("app/components/FamilyPasskeys.tsx");
  assert.match(a, /<EndAll lang=\{lang\} \/>/); assert.match(a, /"\/api\/family-os\/sessions\/end-all"/);
  assert.match(a, /endAllConfirm: "Завершить все открытые сеансы в семье\?"/);
  assert.match(k, /\{!self && personId && data\?\.can\.clear && <EndSessions/, "owner only (can.clear is the owner's capability)");
  assert.match(k, /`\/api\/family-os\/people\/\$\{personId\}\/end-sessions`/);
  assert.match(k, /ended: "Сеанс завершён владельцем\. Войди заново по ссылке из письма\."/);
  assert.doesNotMatch(a + k, /text-\[1[0-3]px\]/, "text ≥ 14 px");
});
