// QA-156 L2 (R0 25.11): the family session is host-only now, so console.kartel.org.uk can no longer read it. The
// owner's apex session hands off to the console host instead:
//   apex  GET /api/family-auth/console-handoff  (owner, session not ended) → a 60-second hand-off token
//   console GET /api/family-auth/console?t=…    → the console's own host-only cookie (consoleSessionCookie)
// Separate key (`<secret>:console`), so neither token can ever pass as a family session or a sign-in link. The
// console token carries the apex session's issued-at (`sat`), so «Завершить сеансы» ends the console too.
import { SignJWT, jwtVerify } from "jose";

export const HANDOFF_TTL_S = 60;
const key = (env) => new TextEncoder().encode(`${env.FAMILY_SESSION_SECRET ?? ""}:console`);

/** @param {{ email: string, sat: number, typ: "console-handoff" | "console", ttl: number }} c */
export async function mintConsoleToken({ email, sat, typ, ttl }, env = process.env) {
  return new SignJWT({ typ, sat })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email.toLowerCase())
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(key(env));
}

/** @returns {Promise<{ email: string, sat: number, exp: number } | null>} */
export async function verifyConsoleToken(token, typ, env = process.env) {
  if (!token || !(env.FAMILY_SESSION_SECRET ?? "")) return null;
  try {
    const { payload } = await jwtVerify(token, key(env));
    if (payload.typ !== typ || typeof payload.sub !== "string" || !Number.isInteger(payload.sat)) return null;
    return { email: payload.sub, sat: payload.sat, exp: payload.exp ?? 0 };
  } catch {
    return null;
  }
}

/** The owners (FAMILY_ADMIN_EMAILS), lowercased. */
export const consoleAdmins = (env = process.env) => (env.FAMILY_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
