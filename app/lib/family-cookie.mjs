// The family session cookie's name — one source for the edge gate (proxy.ts) and the app (family-env.ts).
// Go-live bundle (bus 103/105): in production it is `__Secure-kartel_family_session`. The browser accepts a
// `__Secure-` cookie only with the Secure flag, which createSession sets exactly when NODE_ENV is production, so
// the name and the flag can never disagree. It can't be `__Host-`: it keeps `Domain` (FAMILY_COOKIE_DOMAIN) so
// one session covers console.kartel.org.uk. There is deliberately no env override any more — a stale
// FAMILY_SESSION_COOKIE in Vercel must not quietly bring the old name back. Renaming signs everyone out once.
export const SESSION_COOKIE_PROD = "__Secure-kartel_family_session";
export const SESSION_COOKIE_DEV = "kartel_family_session";

/** @param {{ NODE_ENV?: string }} [env] */
export function familySessionCookie(env = process.env) {
  return env.NODE_ENV === "production" ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV;
}
