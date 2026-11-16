// Signature for requests from kartel-site to kartel-family-media (family-media/server.mjs verifies
// it; family-media/media.test.mjs proves both sides agree). Plain ESM + WebCrypto, like
// relay-signature.mjs, so the Next runtime and the service tests import the same code.
//
// sig = hex HMAC-SHA256(secret, `${ts}.${nonce}.${METHOD}.${path?query}.${actor}.${sha256hex(body)}`)

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** @param {Uint8Array | string} body */
export async function sha256Hex(body) {
  const data = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return hex(await crypto.subtle.digest("SHA-256", data));
}

/**
 * @param {{ secret: string, method: string, path: string, actor?: string, body?: Uint8Array | string }} a
 * @returns {Promise<Record<string, string>>} headers to send
 */
export async function signMediaRequest({ secret, method, path, actor = "", body = "" }) {
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const msg = `${ts}.${nonce}.${method.toUpperCase()}.${path}.${actor}.${await sha256Hex(body)}`;
  const sig = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
  return { "x-kartel-ts": ts, "x-kartel-nonce": nonce, "x-kartel-sig": sig, "x-kartel-actor": actor };
}
