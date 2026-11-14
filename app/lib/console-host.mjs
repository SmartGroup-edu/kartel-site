// The Operations Console is served only on console.kartel.org.uk, which sits behind Cloudflare
// Access. Any other host (the apex, www, *.vercel.app aliases that bypass Cloudflare) gets a 308
// to the console host for /console and /console/*, so the console is never served outside Access.
// The app-level admin check in proxy.ts stays as the second layer. Local dev is exempt.
// R0, 2026-11-14: "закр /console".

export const CONSOLE_HOST = "console.kartel.org.uk";

/** @param {string} host  @param {string} pathname  @param {string} search  @returns {string|null} */
export function consoleRedirectTarget(host, pathname, search = "") {
  const isConsolePath = pathname === "/console" || pathname.startsWith("/console/");
  if (!isConsolePath) return null;
  const h = (host || "").toLowerCase().split(":")[0];
  if (h === CONSOLE_HOST) return null;
  if (h === "localhost" || h === "127.0.0.1") return null;
  return `https://${CONSOLE_HOST}/${search || ""}`;
}
