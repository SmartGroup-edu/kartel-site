/**
 * safeReturnTo — open-redirect guard for the Family sign-in flow (kartel-site).
 * Guards the `returnTo` carried through the sign-in link, so a crafted link cannot bounce a
 * signed-in viewer off-site. Accepts ONLY same-origin absolute paths
 * (start with a single "/", not "//" and not a scheme); everything else → fallback.
 * Plain .mjs so the unit test imports the real guard on every Node version.
 */
/**
 * @param {string | null | undefined} raw
 * @param {string} [fallback]
 * @returns {string}
 */
export function safeReturnTo(raw, fallback = "/en/family") {
  if (!raw) return fallback;
  // Reject absolute URLs, protocol-relative ("//host"), and backslash tricks.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback; // "/javascript:" etc.
  return raw;
}
