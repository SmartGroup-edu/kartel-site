/**
 * Transactional mail for the family gate (kartel-site).
 *
 * Sends through kartel-mail-relay (relay/ in this repo), not Brevo directly: the Brevo account
 * blocks API calls from unlisted IPs and Vercel has no fixed egress IP. The relay runs on Hetzner,
 * holds the Brevo key, and sends only the sign-in template with a link to our own verify endpoint.
 *
 * Request is signed: x-kartel-sig = hex HMAC-SHA256(secret, `${ts}.${body}`), ts in seconds.
 *
 * Nothing here is ever surfaced to the caller: a delivery failure must not reveal whether an
 * address is on the allowlist. Callers log and return the same response either way.
 */

import { familyEnv } from "@/app/lib/family-env";

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Send a sign-in link. Throws on a non-2xx response so the caller can log it;
 * the caller must swallow the error rather than pass it to the user.
 */
export async function sendSignInLink(to: string, link: string): Promise<void> {
  const body = JSON.stringify({ to, link });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await hmacHex(familyEnv.mailRelaySecret(), `${ts}.${body}`);

  const res = await fetch(new URL("/send", familyEnv.mailRelayUrl()), {
    method: "POST",
    headers: { "content-type": "application/json", "x-kartel-ts": ts, "x-kartel-sig": sig },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    // Status only — never the address.
    throw new Error(`mail relay failed: ${res.status}`);
  }
}
