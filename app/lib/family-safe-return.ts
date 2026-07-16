/**
 * safeReturnTo — open-redirect guard for the Family OIDC flow (kartel-site).
 * Mirrors RusJAz src/lib/safeReturnTo. Accepts ONLY same-origin absolute paths
 * (start with a single "/", not "//" and not a scheme); everything else → fallback.
 */
export function safeReturnTo(raw: string | null | undefined, fallback = "/en/family"): string {
  if (!raw) return fallback;
  // Reject absolute URLs, protocol-relative ("//host"), and backslash tricks.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback; // "/javascript:" etc.
  return raw;
}
