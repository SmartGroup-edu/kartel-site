/**
 * The verify route must not wipe the nonce cookie on a failed link (incident 2026-11-18).
 *
 * Before the fix, any failure cleared the nonce. Tapping an older letter (or the same link twice)
 * therefore killed the cookie of the latest request, so the newest, valid link failed too and
 * «request a new one» looped. The route imports next/headers and cannot run here, so this checks
 * the source structure (as the other route guards in tests/ do) and replays the user's sequence
 * against the token rules.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SignJWT, jwtVerify } from "jose";

const src = readFileSync(new URL("../app/api/family-auth/verify/route.ts", import.meta.url), "utf8");

describe("verify route — nonce kept on failure", () => {
  test("the failure path does not clear the nonce", () => {
    const fail = src.slice(src.indexOf("const fail"), src.indexOf("if (!token)"));
    assert.ok(fail.length > 0, "fail() not found");
    assert.doesNotMatch(fail, /clearSignInNonce\s*\(/);
  });

  test("the nonce is cleared exactly once, after the session is created", () => {
    const calls = src.match(/await clearSignInNonce\(\)/g) ?? [];
    assert.equal(calls.length, 1);
    assert.ok(src.indexOf("await createSession(") < src.indexOf("await clearSignInNonce()"));
  });

  test("a failed link keeps the reader's language", () => {
    assert.match(src, /if \(!claims\) return fail\(langHint\(token\)\)/);
  });
});

const key = () => new TextEncoder().encode("test-secret-at-least-32-characters-long!!:link");
const mint = (nonce) =>
  new SignJWT({ email: "parent@example.test", nonce, rt: "/ru/family", typ: "link" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 600_000))
    .sign(key());
const verify = async (token, cookie) => {
  try {
    const { payload } = await jwtVerify(token, key());
    return cookie && payload.nonce === cookie ? payload : null;
  } catch {
    return null;
  }
};

describe("the user's sequence: two requests, the older letter tapped first", () => {
  test("the newest link still works when the cookie survives the failure", async () => {
    const first = crypto.randomUUID();
    const second = crypto.randomUUID(); // the second request overwrote the cookie
    const oldLink = await mint(first);
    const newLink = await mint(second);
    let cookie = second;

    assert.equal(await verify(oldLink, cookie), null); // older letter fails — expected
    // Fixed behaviour: cookie untouched. (The old code set cookie = undefined here.)
    assert.ok(await verify(newLink, cookie), "newest link must still sign in");

    cookie = undefined; // what the old code did
    assert.equal(await verify(newLink, cookie), null, "documents the defect the fix removes");
  });
});
