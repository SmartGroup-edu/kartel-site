/**
 * Family-gate auth (kartel-site) — standalone email sign-in link + jose session.
 *
 * STANDALONE AUTH (R0 decision 2026-11-14). Keycloak OIDC removed: no realm, no OIDC client,
 * no id_token, no JWKS. The **email is the identity** — the session subject is the lowercased
 * email — so the allowlist is the user list and there is no user table to provision.
 *
 * Sign-in: POST an address → if allowlisted, a 10-minute single-purpose link token is signed and
 * emailed, and a nonce cookie is set in the requesting browser. Verification requires BOTH the
 * token and the matching nonce, so an intercepted link is useless in another browser.
 *
 * Known limit, stated not hidden: without a datastore a token cannot be marked consumed, so it is
 * replayable inside its 10-minute life *in the same browser*. See docs/standalone-auth-design.md §3.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { familyEnv } from "@/app/lib/family-env";

function sessionKey(): Uint8Array {
  return new TextEncoder().encode(familyEnv.sessionSecret());
}

/** Link tokens are signed with a separated key so a link can never be replayed as a session. */
function linkKey(): Uint8Array {
  return new TextEncoder().encode(`${familyEnv.sessionSecret()}:link`);
}

export type FamilySession = {
  /** Lowercased email. Kept as `cpifSubjectId` only to avoid churn in call sites. */
  cpifSubjectId: string;
  email: string;
  name: string | null;
  expiresAt: Date;
  /** How this session was minted (bus 100 (a)): "link" = email link, "pk" = passkey. Older tokens: "link". */
  amr: "link" | "pk";
  issuedAt: Date;
};

// ── Session ────────────────────────────────────────────────────────────────

/** Read + validate the session cookie. null if absent, expired, or tampered. */
export async function getSession(): Promise<FamilySession | null> {
  const token = (await cookies()).get(familyEnv.sessionCookie())?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (payload.typ !== "session") return null;
    const expiresAt = new Date((payload.exp ?? 0) * 1000);
    if (expiresAt <= new Date()) return null;
    const email = ((payload.email as string) ?? "").toLowerCase();
    return {
      cpifSubjectId: (payload.sub as string) ?? email,
      email,
      name: (payload.name as string) ?? null,
      expiresAt,
      amr: payload.amr === "pk" ? "pk" : "link",
      issuedAt: new Date((payload.iat ?? 0) * 1000),
    };
  } catch {
    return null;
  }
}

/** Sign a session JWT and set the HTTP-only cookie. Subject = lowercased email. */
export async function createSession(data: {
  email: string;
  name?: string | null;
  /** "pk" for a passkey sign-in; the email link is the default. */
  amr?: "link" | "pk";
}): Promise<void> {
  const email = data.email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + familyEnv.sessionMaxAgeSeconds() * 1000);
  const token = await new SignJWT({ email, name: data.name ?? null, typ: "session", amr: data.amr ?? "link" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(sessionKey());
  (await cookies()).set(familyEnv.sessionCookie(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Widen to the registrable domain so one session covers apex + subdomains
    // (e.g. the gated console.kartel.org.uk). Unset in dev → host-only.
    domain: process.env.FAMILY_COOKIE_DOMAIN || undefined,
    expires: expiresAt,
  });
}

/** Clear the session cookie. */
export async function destroySession(): Promise<void> {
  (await cookies()).set(familyEnv.sessionCookie(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: process.env.FAMILY_COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: 0,
  });
}

// ── Sign-in link ───────────────────────────────────────────────────────────

/**
 * Set the same-device nonce cookie and return its value.
 *
 * MUST be called for EVERY sign-in request — allowlisted or not, well-formed or not. If the cookie
 * were set only for allowlisted addresses, its presence in the response headers would reveal
 * membership even though the body is identical. (Found by end-to-end test, 2026-11-14.)
 */
export async function issueSignInNonce(): Promise<string> {
  const nonce = crypto.randomUUID();
  (await cookies()).set(familyEnv.linkNonceCookie(), nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: familyEnv.linkTtlSeconds(),
  });
  return nonce;
}

/**
 * Mint the sign-in link for a nonce already issued by issueSignInNonce(). Touches no cookies, so it
 * is safe to run after the response has been sent. Caller must have checked the allowlist first.
 */
export async function mintSignInLink(
  email: string,
  returnTo: string,
  nonce: string,
): Promise<string> {
  const addr = email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + familyEnv.linkTtlSeconds() * 1000);

  const token = await new SignJWT({ email: addr, nonce, rt: returnTo, typ: "link" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(addr)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(linkKey());

  const url = new URL("/api/family-auth/verify", familyEnv.siteOrigin());
  url.searchParams.set("token", token);
  return url.toString();
}

export type LinkClaims = { email: string; returnTo: string };

/**
 * Verify a sign-in link: signature, expiry, token type, and that the nonce matches the cookie
 * set in THIS browser when the link was requested. null on any failure — callers must not
 * distinguish the reasons to the user.
 */
export async function verifySignInLink(token: string): Promise<LinkClaims | null> {
  try {
    const { payload } = await jwtVerify(token, linkKey());
    if (payload.typ !== "link") return null;

    const expected = (await cookies()).get(familyEnv.linkNonceCookie())?.value;
    const got = typeof payload.nonce === "string" ? payload.nonce : "";
    if (!expected || !got || expected !== got) return null;

    const email = ((payload.email as string) ?? "").toLowerCase();
    if (!email) return null;

    const rt = typeof payload.rt === "string" ? payload.rt : "/";
    return { email, returnTo: rt };
  } catch {
    return null;
  }
}

/** Clear the one-time nonce cookie once a link has been consumed. */
export async function clearSignInNonce(): Promise<void> {
  (await cookies()).set(familyEnv.linkNonceCookie(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
