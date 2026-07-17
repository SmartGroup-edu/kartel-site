import { CONSOLE_HTML } from "./console-html";
import { renderLivePanel } from "./live-panel";

// Ecosystem Operations Console — GATED (proxy.ts requires a Family-admin session). Serves the
// console shell (snapshot) with a LIVE Eureka-daily-report panel fetched from RusJAz (fail-soft).
// noindex; never cached. Access enforced at the edge.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const live = await renderLivePanel();
  const html = CONSOLE_HTML.replace('<div class="hero">', `${live}\n  <div class="hero">`);
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "private, no-store",
    },
  });
}
