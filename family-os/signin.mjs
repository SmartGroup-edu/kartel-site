// Pending sign-ins (bus 165): the one-time code beside the email link. The site holds every secret: the nonce
// stays in the requester's cookie (only its SHA-256 lands here), the email is keyed by an HMAC under the site's
// secret, and the code arrives already HMAC-ed — this service never sees a code, a nonce or a stranger's address.
// One row per request, members and strangers alike (a stranger's row has no email and a code nobody knows), so
// nothing here behaves differently for a member.
import { timingSafeEqual } from "node:crypto";

export const CODE_ATTEMPTS = 5;
const HEX64 = /^[0-9a-f]{64}$/;
const MAX_TTL_S = 3600;

/** open | used | superseded | expired | locked | unknown — in that order of precedence. */
export function signinState(row, now) {
  if (!row) return "unknown";
  if (row.consumed_at) return "used";
  if (row.superseded_at) return "superseded";
  if (new Date(row.expires_at) <= now) return "expired";
  if (row.attempts >= CODE_ATTEMPTS) return "locked";
  return "open";
}

const same = (a, b) => typeof a === "string" && typeof b === "string" && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** The pseudonymous key in the audit row — never the address, never the code. */
const who = (row) => `signin:${String(row?.email_key ?? "").slice(0, 12)}`;

/** POST /signin/pending — a new request; every older open request for the same address stops working. */
export async function addPending({ store, b, now }) {
  const ttl = Number(b.ttl_s);
  const email = b.email === null || b.email === undefined ? null : typeof b.email === "string" && b.email === b.email.toLowerCase() && b.email.length <= 254 && b.email.includes("@") ? b.email : undefined;
  if (!HEX64.test(b.nonce_hash ?? "") || !HEX64.test(b.email_key ?? "") || !HEX64.test(b.code_hash ?? "") || email === undefined
    || !Number.isInteger(ttl) || ttl < 60 || ttl > MAX_TTL_S) return { status: 400, body: { error: "bad_request" } };
  const ok = await store.signinAdd({ nonce_hash: b.nonce_hash, email_key: b.email_key, email, code_hash: b.code_hash, expires_at: new Date(now.getTime() + ttl * 1000) }, now);
  return ok ? { status: 201, body: { ok: true } } : { status: 409, body: { error: "exists" } };
}

/** POST /signin/status — read-only; for a link opened without its cookie (another browser, or a mail scanner). */
export async function pendingStatus({ store, b, now }) {
  if (!HEX64.test(b.nonce_hash ?? "")) return { status: 400, body: { error: "bad_request" } };
  return { status: 200, body: { state: signinState(await store.signinGet(b.nonce_hash), now) } };
}

/** POST /signin/consume — the link, with its cookie: single use. A locked code does not block the link. */
export async function consumePending({ store, b, now }) {
  if (!HEX64.test(b.nonce_hash ?? "")) return { status: 400, body: { error: "bad_request" } };
  const row = await store.signinConsume(b.nonce_hash, now);
  if (row) { await store.signinAudit("signin.link", who(row)); return { status: 200, body: { state: "ok", email: row.email } }; }
  const st = signinState(await store.signinGet(b.nonce_hash), now);
  return { status: 200, body: { state: st === "locked" || st === "open" ? "unknown" : st } };
}

/**
 * POST /signin/code — the code, typed in the tab that holds the cookie. An attempt is reserved atomically BEFORE
 * the comparison, so parallel guesses can never compare more than CODE_ATTEMPTS times. A wrong code that matches
 * an older request for the same address answers «superseded», so the person knows to open the newest letter.
 */
export async function checkCode({ store, b, now }) {
  if (!HEX64.test(b.nonce_hash ?? "") || !HEX64.test(b.code_hash ?? "")) return { status: 400, body: { error: "bad_request" } };
  const row = await store.signinReserve(b.nonce_hash, CODE_ATTEMPTS, now);
  if (!row) {
    const st = signinState(await store.signinGet(b.nonce_hash), now);
    return { status: 200, body: { state: st === "open" ? "unknown" : st } };
  }
  if (same(row.code_hash, b.code_hash)) {
    const done = await store.signinConsume(b.nonce_hash, now);
    if (done) { await store.signinAudit("signin.code", who(row)); return { status: 200, body: { state: "ok", email: done.email } }; }
    return { status: 200, body: { state: signinState(await store.signinGet(b.nonce_hash), now) } };
  }
  const left = Math.max(0, CODE_ATTEMPTS - row.attempts);
  if (left === 0) await store.signinAudit("signin.code.locked", who(row));
  const older = (await store.signinSupersededCodes(row.email_key, now)).some((h) => same(h, b.code_hash));
  if (older) return { status: 200, body: { state: "superseded", left } };
  return { status: 200, body: left === 0 ? { state: "locked" } : { state: "wrong", left } };
}
