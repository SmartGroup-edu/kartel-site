// Reference codes for Family OS error and not-found pages (bus 84/97 item 6).
// The page shows «Код обращения: X7K2QD»; the same code is written to the server log next to a route
// CLASS (ids, dates and numbers replaced), so the owner can find the event without the log carrying ids.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O, U — easy to read aloud

/** A fresh 6-character code (30 bits; for matching one report to one log line, not a secret). */
export function newRef(rand = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  return [...rand(6)].map((b) => ALPHABET[b & 31]).join("");
}

/** Next's server error digest → a short code that is a prefix of the logged digest. */
export const refFromDigest = (digest) => (typeof digest === "string" && /^[A-Za-z0-9]{4,}$/.test(digest) ? `E-${digest.slice(0, 8)}` : null);

export const REF_RE = /^(?:[0-9A-HJKMNP-TV-Z]{6}|E-[A-Za-z0-9]{4,8})$/;

/** /ru/family/os/people/<uuid>?x=1 → /family/os/people/:id. Never returns an id, a date or a query. Idempotent. */
export function routeClass(pathname) {
  const p = String(pathname ?? "").split(/[?#]/)[0].replace(/^\/(en|ru)(?=\/|$)/, "") || "/";
  const out = p
    .split("/")
    .map((s) => (/^:(id|date|n|x)$/.test(s) ? s : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? ":id" : /^\d{4}-\d{2}-\d{2}$/.test(s) ? ":date" : /\d/.test(s) ? ":n" : /^[a-z-]{1,24}$/.test(s) || s === "" ? s : ":x"))
    .join("/");
  return out.slice(0, 80);
}

/** One log line, the only place a reference code is written. */
export const refLogLine = (kind, ref, route) => `[family] ${kind} ref=${ref} route=${routeClass(route)}`;
