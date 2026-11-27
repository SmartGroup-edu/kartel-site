import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // The coat of arms is the public home since R0's decision of 2026-11-14: the old gated
  // crest URL goes there (308), so there is one canonical page and no duplicate content.
  // Config redirects run before proxy.ts, so this never reaches the family gate.
  // The council mockup (Stage 5, bus 126): an unlisted static page at /m/<24 hex>/ — served from public/m/<id>/index.html.
  // proxy.ts skips /m/ (see its matcher); temporary, removal planned 29.11.2026.
  async rewrites() {
    return [{ source: "/m/:id([0-9a-f]{24})", destination: "/m/:id/index.html" }];
  },
  async redirects() {
    return [{ source: "/:lang(en|ru)/family/crest", destination: "/:lang", permanent: true }];
  },
  experimental: {
    // viewTransition removed: the flag was dropped in Next 16.3 (view transitions need no config).
    // Unmatched URLs get app/global-not-found.tsx with a real 404 status. A catch-all page under
    // [lang] would render inside loading.tsx's Suspense and stream as a soft-404 (HTTP 200).
    globalNotFound: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [280, 380, 540, 640, 750, 828, 1080, 1200],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Family OS document files (Stage 2a): a served PDF/image must never run script or load
      // anything on this origin. Listed after the site-wide rule so this CSP wins.
      {
        source: "/api/family-os/:path*",
        headers: [{ key: "Content-Security-Policy", value: "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'" }],
      },
      // Gated surfaces are never indexed (gated UI/UX audit 2026-11-14 #2). proxy.ts also sets this
      // on its own responses (redirects included).
      { source: "/:lang(en|ru)/family", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/:lang(en|ru)/family/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/console", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // bus 176 P1: KARTEL Core and the registry are family-only (proxy.ts) — never indexed.
      { source: "/:lang(en|ru)/core", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/:lang(en|ru)/registry", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/:lang(en|ru)/registry/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // bus 176 P1: the self-hosted Playfair Display and Manrope (OFL) of the crest pages, cached for a year.
      { source: "/fonts/:file", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // Council mockup (bus 126): never indexed, never sends a referrer.
      { source: "/m/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }] },
      // Its self-hosted fonts (the site's own Inter + Source Serif 4, OFL): same-origin, cached for a year.
      { source: "/m/:id/fonts/:file", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }, { key: "Content-Type", value: "font/woff2" }] },
      {
        source: "/crest.jpeg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/crest.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/(.*).svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/llms.txt",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          {
            key: "Content-Type",
            value: "text/plain; charset=utf-8",
          },
        ],
      },
      {
        source: "/llms-full.txt",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          {
            key: "Content-Type",
            value: "text/plain; charset=utf-8",
          },
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/robots.txt",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
