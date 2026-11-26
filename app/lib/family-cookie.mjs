// The family session cookie's name — one source for the edge gate (proxy.ts) and the app (family-env.ts).
// Go-live bundle (bus 103/105) made it `__Secure-` in production. QA-156 L2 (R0 25.11) makes it `__Host-`: the
// browser then accepts it only from this host, Secure, Path=/ and without Domain, so no other *.kartel.org.uk
// host ever receives the session. The Operations Console on console.kartel.org.uk gets its own host-only cookie
// through a one-minute hand-off (app/api/family-auth/console*). There is deliberately no env override — a stale
// FAMILY_SESSION_COOKIE in Vercel must not quietly bring an old name back. Renaming signs everyone out once; the
// old domain-wide `__Secure-` cookie is ignored from now on and expires within the session's 8 hours.
export const SESSION_COOKIE_PROD = "__Host-kartel_family_session";
export const SESSION_COOKIE_DEV = "kartel_family_session";
/** The pre-QA-156 production name — only ever cleared, never read. */
export const SESSION_COOKIE_LEGACY = "__Secure-kartel_family_session";

/** @param {{ NODE_ENV?: string }} [env] */
export function familySessionCookie(env = process.env) {
  return env.NODE_ENV === "production" ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV;
}

/**
 * The sign-in nonce (bus 165): `__Host-` in production like the session, so no sibling *.kartel.org.uk host can
 * plant or overwrite it. No env override, for the same reason as the session. Renaming at deploy only voids
 * sign-ins requested in the minutes before it (they ask again). @param {{ NODE_ENV?: string }} [env]
 */
export function linkNonceCookie(env = process.env) {
  return env.NODE_ENV === "production" ? "__Host-kartel_family_link" : "kartel_family_link";
}

/** The console's own session, host-only on console.kartel.org.uk. @param {{ NODE_ENV?: string }} [env] */
export function consoleSessionCookie(env = process.env) {
  return env.NODE_ENV === "production" ? "__Host-kartel_console_session" : "kartel_console_session";
}
