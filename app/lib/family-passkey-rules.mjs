// Passkeys on the site (bus 98/100) — the rules the site enforces before it calls the service. Pure, unit-tested.

/** Bus 100 (a): a new key only from a session minted by the EMAIL LINK, at most 15 minutes ago. A passkey
 *  session never enrols another key, so one stolen device cannot multiply itself. */
export const REGISTER_FRESH_MS = 15 * 60_000;
export function canRegister(session, now = new Date()) {
  if (!session || session.amr !== "link") return false;
  const age = now.getTime() - new Date(session.issuedAt).getTime();
  return age >= 0 && age <= REGISTER_FRESH_MS;
}

/** C2: the challenge-binding cookie. __Host- ⇒ Secure, Path=/, no Domain. */
export const PK_COOKIE = "__Host-kartel_pk";
export const pkCookieOptions = () => ({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 300 });

/** A challenge id is a UUID; anything else is ignored. */
export const validChallengeId = (s) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);
