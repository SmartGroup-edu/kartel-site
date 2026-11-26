// The one-time sign-in code (bus 165): six digits in the letter beside the button, typed in the tab that asked.
// Pure helpers (WebCrypto only), shared by the routes and the tests. Family OS stores only what these return:
// SHA-256 of the nonce, an HMAC of the address and an HMAC of the code — never a code, a nonce or a stranger's
// address. The keys are derived from FAMILY_SESSION_SECRET with their own labels, so none of them doubles as
// a session or link key.

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const CODE_LENGTH = 6;

/** A uniform six-digit code (rejection sampling — no modulo bias). */
export function newCode() {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % 1_000_000).padStart(CODE_LENGTH, "0");
  }
}

/** What a person typed → six ASCII digits, or null. Spaces, dashes and full-width digits (NFKC) are fine. */
export function normCode(input) {
  if (typeof input !== "string" || input.length > 32) return null;
  const digits = input.normalize("NFKC").replace(/[\s\-–—.]/gu, "");
  return /^[0-9]{6}$/.test(digits) ? digits : null;
}

export async function sha256Hex(s) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

async function hmacHex(secret, label, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(`${secret}:${label}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

/** The nonce's fingerprint: identifies the pending sign-in without revealing the cookie. */
export const nonceHash = (nonce) => sha256Hex(`signin-nonce:${nonce}`);
/** The address key: the same for every request from one address, so a newer request supersedes the older ones. */
export const emailKey = (secret, email) => hmacHex(secret, "signin-email", String(email).trim().toLowerCase());
/** The code's HMAC. A million codes are not a secret by themselves; under the site's key they are. */
export const codeHash = (secret, code) => hmacHex(secret, "signin-code", code);

/** Outcomes the sign-in page explains. Anything else reads as the plain «invalid». */
export const LINK_REASONS = ["expired", "superseded", "elsewhere", "used"];
