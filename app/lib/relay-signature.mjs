// Signature for requests from kartel-site to kartel-mail-relay (relay/server.mjs verifies it).
// Plain ESM + WebCrypto so the site (Next runtime) AND relay/relay.test.mjs import the very same
// code — a change here is caught by the relay tests, not discovered in production.
//
// sig = hex HMAC-SHA256(secret, `${ts}.${body}`), ts = unix seconds as a string.

/**
 * @param {string} secret
 * @param {string} ts
 * @param {string} body
 * @returns {Promise<string>}
 */
export async function signRelayRequest(secret, ts, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}
