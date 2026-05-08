import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

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

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

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
