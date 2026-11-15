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
import { signRelayRequest } from "@/app/lib/relay-signature.mjs";

/**
 * Send a sign-in link. Throws on a non-2xx response so the caller can log it;
 * the caller must swallow the error rather than pass it to the user.
 */
export async function sendSignInLink(to: string, link: string, lang: "en" | "ru" = "en"): Promise<void> {
  // ttlMinutes: the lifetime the link is signed with, so the email states the real expiry.
  const body = JSON.stringify({ to, link, ttlMinutes: familyEnv.linkTtlMinutes(), lang });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await signRelayRequest(familyEnv.mailRelaySecret(), ts, body);

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
