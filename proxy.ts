import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

// --- Family gate, enforced at the EDGE (fail-closed) --------------------------
// Enforcement lives here, not in the page: in this Next build a Server-Component
// redirect() does not reliably abort a force-dynamic render (it streamed a 200 with
// content — the 2026-07-17 leak). NextResponse.redirect at the edge runs before any
// render, so it cannot leak. P1 approval = FAMILY_ADMIN_SUBS (admins only) until the
// P2 datastore exists; everyone else → pending. Mirrors app/lib/family-* contracts.
async function familyEdgeGate(request: NextRequest, pathname: string) {
  const lang = pathname.startsWith("/ru") ? "ru" : "en";
  const login = new URL(
    `/api/family-auth/login?returnTo=${encodeURIComponent(pathname)}`,
    request.url,
  );
  const cookieName = process.env.FAMILY_SESSION_COOKIE ?? "kartel_family_session";
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return NextResponse.redirect(login);
  try {
    const secret = new TextEncoder().encode(process.env.FAMILY_SESSION_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const admins = (process.env.FAMILY_ADMIN_SUBS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (sub && admins.includes(sub)) return NextResponse.next(); // approved (P1)
    return NextResponse.redirect(new URL(`/${lang}/family/pending`, request.url)); // signed-in, not approved
  } catch {
    return NextResponse.redirect(login); // invalid/expired session → re-auth
  }
}

function detectLocale(request: NextRequest): Locale {
  const accept = request.headers.get("accept-language") ?? "";
  // Take the first 2-letter primary tag from each candidate, in order.
  const primaries = accept
    .split(",")
    .map((part) => part.trim().split(";")[0].slice(0, 2).toLowerCase())
    .filter(Boolean);
  for (const p of primaries) {
    if (LOCALES.includes(p as Locale)) return p as Locale;
  }
  return DEFAULT_LOCALE;
}

function legacyLocaleFromQuery(value: string | null): Locale | null {
  if (!value) return null;
  const v = value.toLowerCase();
  return LOCALES.includes(v as Locale) ? (v as Locale) : null;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // /en/family and /ru/family — members-only Family Heritage (Option A, R0-signed 2026-07-16:
  // gated access via CPIF / Keycloak, family_access approval; NOT bespoke auth).
  // DORMANT by default: FAMILY_GATE ≠ "on" keeps the hard-redirect to home, so the public
  // no-PII authority surface is unchanged. When FAMILY_GATE = "on", the gate is enforced HERE at
  // the edge (session + approval) — fail-closed, before any render. /family/pending stays reachable
  // (no PII) so signed-in-but-unapproved users land somewhere. Reversible: unset FAMILY_GATE.
  if (/^\/(en|ru)\/family(\/|$)/.test(pathname)) {
    const lang = pathname.startsWith("/ru") ? "ru" : "en";
    if (process.env.FAMILY_GATE !== "on") {
      return NextResponse.redirect(new URL(`/${lang}`, request.url));
    }
    if (/^\/(en|ru)\/family\/pending\/?$/.test(pathname)) return NextResponse.next();
    return familyEdgeGate(request, pathname);
  }

  // If the path already starts with a known locale, leave it alone.
  const firstSegment = pathname.split("/")[1];
  if (LOCALES.includes(firstSegment as Locale)) return NextResponse.next();

  // Backwards compat: legacy ?lang=EN / ?lang=RU URLs → permanent redirect to /{lang}{path}
  const legacyLang = legacyLocaleFromQuery(searchParams.get("lang"));
  const target = request.nextUrl.clone();
  target.pathname = `/${legacyLang ?? detectLocale(request)}${pathname === "/" ? "" : pathname}`;
  target.searchParams.delete("lang");
  return NextResponse.redirect(target, legacyLang ? 308 : 307);
}

export const config = {
  // Skip Next internals, static assets, sitemap, robots, sw, llms files, and any
  // path with a file extension (favicon, images, etc.).
  matcher: [
    "/((?!_next|api|sitemap\\.xml|robots\\.txt|sw\\.js|humans\\.txt|llms\\.txt|llms-full\\.txt|opengraph-image|icon|apple-icon|.*\\.).*)",
  ],
};
