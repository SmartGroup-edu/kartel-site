/**
 * Family-gate environment accessors (kartel-site).
 *
 * LAZY on purpose: OIDC/session vars are read only when the gate actually runs, so the
 * dormant (FAMILY_GATE unset/≠"on") build + all public routes never require them and never
 * throw at import. Activation = R0 provisions the Keycloak `kartel-site` client + these vars.
 *
 * FEDERATION-V2 reference-implementation, ratification-pending
 * Pattern: mirrors RusJAz src/lib/env.ts OIDC contract (OIDC_ISSUER/CLIENT_ID/CLIENT_SECRET),
 *   but soft/lazy (no zod-throw at import) so the gate ships dormant on the public authority surface.
 * Ratification gate: R0 act OR second-federated-client adoption.
 * Vault: KARTEL-Vault/40-Observations/2026-07-16-refimpl-kartel-site-family-gate.md
 */

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[family-gate] required env ${name} is not set`);
  return v;
}

export const familyEnv = {
  /** Master flag. The gate is inert unless this is exactly "on". */
  gateOn: (): boolean => process.env.FAMILY_GATE === "on",

  // OIDC (Keycloak realm kartel-ecosystem, client `kartel-site`)
  issuer: (): string => need("OIDC_ISSUER"),
  clientId: (): string => need("OIDC_CLIENT_ID"),
  clientSecret: (): string => need("OIDC_CLIENT_SECRET"),
  redirectUri: (): string =>
    process.env.OIDC_REDIRECT_URI ?? "https://kartel.org.uk/api/family-auth/callback",
  postLogoutUri: (): string => process.env.OIDC_POST_LOGOUT_URI ?? "https://kartel.org.uk/en",

  // Local session (HS256 JWT cookie) — separate from any other platform's session
  sessionSecret: (): string => need("FAMILY_SESSION_SECRET"),
  sessionCookie: (): string => process.env.FAMILY_SESSION_COOKIE ?? "kartel_family_session",
  sessionMaxAgeSeconds: (): number => Number(process.env.FAMILY_SESSION_MAX_AGE ?? 28800), // 8h

  /**
   * Admin bootstrap: comma-separated cpifSubjectIds who may view + (P2) approve/revoke.
   * LOCAL entitlement, NOT a federation role (authz-local invariant).
   */
  adminSubs: (): string[] =>
    (process.env.FAMILY_ADMIN_SUBS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),

  /**
   * Founder-seeded family email allowlist (comma-separated, lowercased). Approves a viewer by their
   * IdP-asserted email — the practical INVITE key, since a cpifSubjectId only exists after first
   * login. LOCAL entitlement, not a federation role. Runtime add/revoke per-email lives in the Edge
   * Config `familyAccessEmails` item; this env is the static seed. Trust model: the email is asserted
   * by Keycloak/Google (users cannot self-set it without realm-admin), so matching it is safe here.
   */
  approvedEmails: (): string[] =>
    (process.env.FAMILY_APPROVED_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
};
