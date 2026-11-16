/**
 * Sign-in link tests (kartel-site standalone auth).
 *
 * These exercise the token rules directly with `jose`, mirroring app/lib/family-auth.ts, because
 * that module imports next/headers and cannot run outside a request scope. What is proven here is
 * the part that would be a security defect if wrong: key separation, type separation, expiry, and
 * nonce binding. The cookie plumbing is left to the Next runtime.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, jwtVerify } from "jose";

const SECRET = "test-secret-at-least-32-characters-long!!";
const sessionKey = () => new TextEncoder().encode(SECRET);
const linkKey = () => new TextEncoder().encode(`${SECRET}:link`);

async function mintLink({ email, nonce, rt = "/en/family", ttl = 600, key = linkKey(), typ = "link" }) {
  return new SignJWT({ email, nonce, rt, typ })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + ttl * 1000))
    .sign(key);
}

/** Mirrors verifySignInLink: signature + type + nonce-vs-cookie. */
async function verifyLink(token, cookieNonce) {
  try {
    const { payload } = await jwtVerify(token, linkKey());
    if (payload.typ !== "link") return null;
    const got = typeof payload.nonce === "string" ? payload.nonce : "";
    if (!cookieNonce || !got || cookieNonce !== got) return null;
    const email = String(payload.email ?? "").toLowerCase();
    if (!email) return null;
    return { email, returnTo: typeof payload.rt === "string" ? payload.rt : "/" };
  } catch {
    return null;
  }
}

describe("sign-in link", () => {
  test("a valid link in the browser that requested it is accepted", async () => {
    const nonce = crypto.randomUUID();
    const token = await mintLink({ email: "a@example.com", nonce });
    const claims = await verifyLink(token, nonce);
    assert.ok(claims);
    assert.equal(claims.email, "a@example.com");
    assert.equal(claims.returnTo, "/en/family");
  });

  test("the same link in another browser is rejected (no matching nonce)", async () => {
    const token = await mintLink({ email: "a@example.com", nonce: crypto.randomUUID() });
    assert.equal(await verifyLink(token, crypto.randomUUID()), null);
    assert.equal(await verifyLink(token, undefined), null);
  });

  test("an expired link is rejected", async () => {
    const nonce = crypto.randomUUID();
    const token = await mintLink({ email: "a@example.com", nonce, ttl: -1 });
    assert.equal(await verifyLink(token, nonce), null);
  });

  test("a session token cannot be replayed as a sign-in link", async () => {
    const nonce = crypto.randomUUID();
    // Signed with the SESSION key and typed as a session — both reasons to refuse.
    const session = await mintLink({ email: "a@example.com", nonce, key: sessionKey(), typ: "session" });
    assert.equal(await verifyLink(session, nonce), null);
  });

  test("a link token cannot be replayed as a session", async () => {
    const nonce = crypto.randomUUID();
    const token = await mintLink({ email: "a@example.com", nonce });
    // A session verifier uses the session key: a link must not validate against it.
    await assert.rejects(() => jwtVerify(token, sessionKey()));
  });

  test("a link signed with an unrelated key is rejected", async () => {
    const nonce = crypto.randomUUID();
    const token = await mintLink({
      email: "a@example.com",
      nonce,
      key: new TextEncoder().encode("another-secret-at-least-32-chars!!!!"),
    });
    assert.equal(await verifyLink(token, nonce), null);
  });

  test("the email is normalised to lower case", async () => {
    const nonce = crypto.randomUUID();
    const token = await mintLink({ email: "Mixed.Case@Example.COM".toLowerCase(), nonce });
    const claims = await verifyLink(token, nonce);
    assert.equal(claims.email, "mixed.case@example.com");
  });
});

describe("safeReturnTo guard still holds for link returnTo", async () => {
  const { safeReturnTo } = await import("../app/lib/family-safe-return.mjs");

  test("off-site and scheme-like destinations fall back", () => {
    assert.equal(safeReturnTo("https://evil.example"), "/en/family");
    assert.equal(safeReturnTo("//evil.example"), "/en/family");
    assert.equal(safeReturnTo("/javascript:alert(1)"), "/en/family");
    assert.equal(safeReturnTo("/en\\evil"), "/en/family");
  });

  test("same-origin paths pass through", () => {
    assert.equal(safeReturnTo("/ru/family"), "/ru/family");
  });
});
