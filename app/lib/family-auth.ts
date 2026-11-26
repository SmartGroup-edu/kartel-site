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
 * bus 165: each request is also a pending sign-in in Family OS (app/lib/family-signin.ts), which makes the link
 * single-use, lets a newer request supersede an older one, and backs the six-digit code typed in the asking tab.
 * When Family OS does not answer, the link still works as before (replayable inside its 10 minutes in the same
 * browser — docs/standalone-auth-design.md §3) and the code does not.
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
    // Host-only (QA-156 L2): no Domain, so no other *.kartel.org.uk host ever receives the session.
    expires: expiresAt,
  });
}

/** Clear the session cookie. */
export async function destroySession(): Promise<void> {
  (await cookies()).set(familyEnv.sessionCookie(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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

export type LinkClaims = { email: string; returnTo: string; nonce: string };

/**
 * Why a link did not sign in (bus 165). Only "bad" is undifferentiated: a forged, foreign or malformed token
 * learns nothing. The others are told to whoever holds a link WE signed — which only reaches the address it
 * was sent to — so naming them reveals nothing to anyone else:
 *   expired   — past its lifetime;
 *   elsewhere — no nonce cookie here: opened in another browser than the one that asked (or by a mail scanner);
 *   mismatch  — this browser asked again since: the cookie belongs to a newer request.
 */
export type LinkCheck =
  | { ok: true; claims: LinkClaims }
  | { ok: false; reason: "bad" | "expired" | "elsewhere" | "mismatch"; claims?: LinkClaims };

/** Verify a sign-in link: signature, expiry, token type, and that the nonce matches THIS browser's cookie. */
export async function checkSignInLink(token: string): Promise<LinkCheck> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, linkKey()));
  } catch (e) {
    return { ok: false, reason: (e as { code?: string })?.code === "ERR_JWT_EXPIRED" ? "expired" : "bad" };
  }
  const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (payload.typ !== "link" || !nonce || !email) return { ok: false, reason: "bad" };
  const claims = { email, nonce, returnTo: typeof payload.rt === "string" ? payload.rt : "/" };

  const expected = await readSignInNonce();
  if (!expected) return { ok: false, reason: "elsewhere", claims };
  if (expected !== nonce) return { ok: false, reason: "mismatch", claims };
  return { ok: true, claims };
}

/** The nonce cookie of THIS browser's latest sign-in request, if any. */
export async function readSignInNonce(): Promise<string | null> {
  return (await cookies()).get(familyEnv.linkNonceCookie())?.value || null;
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
