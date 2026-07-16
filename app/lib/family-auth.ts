/**
 * Family-gate auth (kartel-site) — Keycloak OIDC + jose session.
 *
 * Mirrors the RusJAz reference implementation (src/lib/auth.ts): Arctic (KeyCloak provider,
 * OAuth2 + PKCE) + jose (id_token JWKS verify + HS256 session JWT in an HTTP-only cookie).
 * Identity source: Keycloak `sub` = cpifSubjectId (Federation v2 canonical declaration).
 * There is NO role hierarchy here — access is decided by family_access entitlement
 * (see family-gate.ts), not by a role claim.
 *
 * FEDERATION-V2 reference-implementation, ratification-pending
 * Pattern: reuse of RusJAz Arctic+jose OIDC (first non-RusJAz CPIF consumer). Lazy client
 *   construction so the module is import-safe while dormant. Session claims = {sub, email, name}.
 * Ratification gate: R0 act OR second-federated-client adoption.
 * Vault: KARTEL-Vault/40-Observations/2026-07-16-refimpl-kartel-site-family-gate.md
 */

import { KeyCloak, generateState, generateCodeVerifier } from "arctic";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { cookies } from "next/headers";
import { familyEnv } from "@/app/lib/family-env";

/** Lazily construct the Keycloak OIDC client (needs env — only when the flow runs). */
export function getKeycloak(): KeyCloak {
  return new KeyCloak(
    familyEnv.issuer(),
    familyEnv.clientId(),
    familyEnv.clientSecret(),
    familyEnv.redirectUri(),
  );
}

function jwks() {
  return createRemoteJWKSet(
    new URL(`${familyEnv.issuer()}/protocol/openid-connect/certs`),
  );
}

function sessionKey(): Uint8Array {
  return new TextEncoder().encode(familyEnv.sessionSecret());
}

export type FamilySession = {
  cpifSubjectId: string;
  email: string;
  name: string | null;
  expiresAt: Date;
};

/** Read + validate the session cookie. null if absent, expired, or tampered. */
export async function getSession(): Promise<FamilySession | null> {
  const token = (await cookies()).get(familyEnv.sessionCookie())?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    const expiresAt = new Date((payload.exp ?? 0) * 1000);
    if (expiresAt <= new Date()) return null;
    return {
      cpifSubjectId: payload.sub as string,
      email: (payload.email as string) ?? "",
      name: (payload.name as string) ?? null,
      expiresAt,
    };
  } catch {
    return null;
  }
}

/** Sign a session JWT and set the HTTP-only cookie. */
export async function createSession(data: {
  cpifSubjectId: string;
  email: string;
  name: string | null;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + familyEnv.sessionMaxAgeSeconds() * 1000);
  const token = await new SignJWT({ email: data.email, name: data.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(data.cpifSubjectId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(sessionKey());
  (await cookies()).set(familyEnv.sessionCookie(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
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

/** Verify a Keycloak id_token signature + issuer/audience. */
export async function verifyIdToken(
  idToken: string,
): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(idToken, jwks(), {
    issuer: familyEnv.issuer(),
    audience: familyEnv.clientId(),
  });
  return payload as Record<string, unknown>;
}

export { generateState, generateCodeVerifier };
