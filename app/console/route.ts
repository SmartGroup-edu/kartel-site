import { CONSOLE_HTML } from "./console-html";

// Ecosystem Operations Console — GATED (proxy.ts requires a Family-admin session). Serves the
// self-contained console HTML (snapshot). noindex; never cached. Access enforced at the edge.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(CONSOLE_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "private, no-store",
    },
  });
}
