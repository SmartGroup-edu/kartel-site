/**
 * Family-gate environment accessors (kartel-site).
 *
 * LAZY on purpose: auth/session vars are read only when the gate actually runs, so the
 * dormant (FAMILY_GATE unset/≠"on") build + all public routes never require them and never
 * throw at import.
 *
 * STANDALONE AUTH (R0 decision 2026-11-14): Keycloak OIDC is removed. kartel-site has its own
 * sign-in and its own user list; there is no ecosystem identity key here. The **email is the
 * identity** — the session subject is the lowercased email — so the allowlist is the user list
 * and no datastore is required. See docs/standalone-auth-design.md.
 */

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[family-gate] required env ${name} is not set`);
  return v;
}

function csvLower(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const familyEnv = {
  /** Master flag. The gate is inert unless this is exactly "on". */
  gateOn: (): boolean => process.env.FAMILY_GATE === "on",

  // Local session (HS256 JWT cookie). Subject = lowercased email.
  sessionSecret: (): string => need("FAMILY_SESSION_SECRET"),
  sessionCookie: (): string => process.env.FAMILY_SESSION_COOKIE ?? "kartel_family_session",
  sessionMaxAgeSeconds: (): number => Number(process.env.FAMILY_SESSION_MAX_AGE ?? 28800), // 8h

  // Sign-in link (short-lived, same-device bound via the nonce cookie).
  linkTtlSeconds: (): number => Number(process.env.FAMILY_LINK_TTL ?? 600), // 10 min
  /** The same lifetime, in whole minutes, for the sign-in page's helper text (cycle 6 #2). */
  linkTtlMinutes: (): number => {
    const m = Math.round(Number(process.env.FAMILY_LINK_TTL ?? 600) / 60);
    return Number.isFinite(m) && m >= 1 ? m : 10;
  },
  linkNonceCookie: (): string => process.env.FAMILY_LINK_NONCE_COOKIE ?? "kartel_family_link",
  siteOrigin: (): string => process.env.FAMILY_SITE_ORIGIN ?? "https://kartel.org.uk",

  // Mail goes through kartel-mail-relay on Hetzner (Brevo blocks unlisted IPs; Vercel has none
  // fixed). The relay holds the Brevo key, sender and template. See relay/README.md.
  mailRelayUrl: (): string => need("FAMILY_MAIL_RELAY_URL"),
  mailRelaySecret: (): string => need("FAMILY_MAIL_RELAY_SECRET"),

  /**
   * Admins: may reach /console and are always approved for /family. Email-keyed.
   * (The Keycloak-era FAMILY_ADMIN_SUBS was retired 2026-11-14 and is no longer read.)
   */
  adminEmails: (): string[] => csvLower(process.env.FAMILY_ADMIN_EMAILS),

  /**
   * Founder-seeded family allowlist (comma-separated, lowercased). This is the user list:
   * an address here may request a sign-in link. Runtime add/revoke lives in the Edge Config
   * `familyAccessEmails` item; this env is the static seed.
   */
  approvedEmails: (): string[] => csvLower(process.env.FAMILY_APPROVED_EMAILS),
};
