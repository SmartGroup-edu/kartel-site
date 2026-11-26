// Pending sign-ins in Family OS (bus 165) — the site side. Family OS holds one row per request: the SHA-256 of the
// nonce, an HMAC of the address, an HMAC of the code, an attempt counter and three timestamps. Every secret stays
// here. Every call is best-effort and never throws: if Family OS does not answer, the email link works as it did
// before this change and the code cannot be checked (the page says so in the same words as any failed code).
import { createHmac } from "node:crypto";
import { familyEnv } from "@/app/lib/family-env";
import { osCall, osEnabled } from "@/app/lib/family-os";
import { nonceHash, emailKey, codeHash, newCode } from "@/app/lib/family-signin-code.mjs";

const ACTOR = "auth:signin";
export type PendingState = "ok" | "open" | "used" | "superseded" | "expired" | "locked" | "wrong" | "unknown";
type OsAnswer = { status: number; state: PendingState | null; email: string | null; left: number | null };

async function os(path: string, body: Record<string, unknown>): Promise<OsAnswer> {
  if (!osEnabled()) return { status: 0, state: null, email: null, left: null };
  try {
    const r = await osCall("POST", path, ACTOR, body);
    const j = (await r.json().catch(() => ({}))) as { state?: unknown; email?: unknown; left?: unknown };
    return {
      status: r.status,
      state: typeof j.state === "string" ? (j.state as PendingState) : null,
      email: typeof j.email === "string" ? j.email.toLowerCase() : null,
      left: typeof j.left === "number" ? j.left : null,
    };
  } catch {
    return { status: 0, state: null, email: null, left: null };
  }
}

/** Codes work only where they can be checked. */
export const codesOn = (): boolean => osEnabled();

/**
 * Record a request. Runs for EVERY well-formed address (member or not), after the response. A member gets a real
 * code back to put in the letter; a stranger's row carries the HMAC of a code nobody ever sees. null = Family OS
 * did not take it: send the link without a code.
 */
export async function recordPending(nonce: string, email: string, member: boolean): Promise<string | null> {
  const secret = familyEnv.sessionSecret();
  const code = newCode();
  const r = await os("/signin/pending", {
    nonce_hash: await nonceHash(nonce),
    email_key: await emailKey(secret, email),
    email: member ? email.trim().toLowerCase() : null,
    code_hash: await codeHash(secret, code),
    ttl_s: familyEnv.linkTtlSeconds(),
  });
  return r.status === 201 && member ? code : null;
}

/** Read-only: what became of a request (a link opened without its cookie). null = Family OS did not answer. */
export async function pendingState(nonce: string): Promise<PendingState | null> {
  return (await os("/signin/status", { nonce_hash: await nonceHash(nonce) })).state;
}

/** The link, with its cookie: use the request up. null = Family OS did not answer (the link still signs in). */
export async function consumePending(nonce: string): Promise<{ state: PendingState; email: string | null } | null> {
  const r = await os("/signin/consume", { nonce_hash: await nonceHash(nonce) });
  return r.state ? { state: r.state, email: r.email } : null;
}

/** The code, typed in the tab that holds the cookie. */
export async function checkPendingCode(nonce: string, code: string, req: Request): Promise<OsAnswer> {
  return os("/signin/code", { nonce_hash: await nonceHash(nonce), code_hash: await codeHash(familyEnv.sessionSecret(), code), client: clientKey(req) });
}

/** As for passkeys (QA-156 M5): an HMAC of the client IP under the OS secret — the service never sees the address. */
function clientKey(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.FAMILY_OS_SECRET ?? "").update(`signin-client:${ip}`).digest("hex").slice(0, 32);
}
