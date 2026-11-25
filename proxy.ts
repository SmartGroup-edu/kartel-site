import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isViewerApproved } from "@/app/lib/family-access";
import { consoleRedirectTarget, CONSOLE_HOST } from "@/app/lib/console-host.mjs";
import { familyRoleOf } from "@/app/lib/family-roles.mjs";
import { routeClass } from "@/app/lib/family-ref.mjs";
import { familySessionCookie, consoleSessionCookie } from "@/app/lib/family-cookie.mjs";
import { osSessionState } from "@/app/lib/family-os-session.mjs";
import { verifyConsoleToken, consoleAdmins } from "@/app/lib/console-auth.mjs";
import { ENDED_PARAM } from "@/app/lib/family-ended";

const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * A refusal answers with the family not-found PAGE and a real 404 (QA-156 M6): the request is rewritten to a path no
 * route matches, so nothing streams first and the status cannot fall back to 200 (the L7 «Кодекс»/«Неделя» case).
 * The family layout and its reference code come from app/[lang]/family/[...missing]/page.tsx.
 */
function familyNotFound(request: NextRequest, lang: string, pathname: string) {
  const forwarded = new Headers(request.headers);
  forwarded.set("x-kartel-locale", lang);
  forwarded.set("x-family-route", routeClass(pathname));
  return NextResponse.rewrite(new URL(`/${lang}/family/not-found/page`, request.url), { request: { headers: forwarded }, status: 404 });
}

/** «Завершить сеансы» reached the site (QA-156 H1): clear the cookie and say so calmly on the sign-in page. */
function sessionEnded(request: NextRequest, lang: string, pathname: string) {
  const res = NextResponse.redirect(new URL(`/${lang}/family/signin?${ENDED_PARAM}&returnTo=${encodeURIComponent(pathname)}`, request.url));
  res.cookies.set(familySessionCookie(), "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

// Family OS sections that only exist for members: the owner who is not a member gets no nav item and a 404 (QA-156 L7).
const MEMBER_ONLY = /^\/(en|ru)\/family\/os\/(board|council|calendar|kodeks|week)(\/|$)/;
// Every family page there is. Anything else under /family is answered here with the 404 page (QA-156 L7).
const FAMILY_ROUTES = /^\/(en|ru)\/family(\/admin|\/os(\/(access|board|council|calendar|kodeks|week|people(\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?))?)?\/?$/;

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

// --- Family gate, enforced at the EDGE (fail-closed) --------------------------
// Enforcement lives here, not in the page: in this Next build a Server-Component
// redirect() does not reliably abort a force-dynamic render (it streamed a 200 with
// content — the 2026-07-17 leak). NextResponse.redirect at the edge runs before any
// render, so it cannot leak. Approval = FAMILY_ADMIN_EMAILS + the email allowlist
// (Edge Config / env seed); everyone else → pending. Mirrors app/lib/family-* contracts.
async function familyEdgeGate(request: NextRequest, pathname: string) {
  const lang = pathname.startsWith("/ru") ? "ru" : "en";
  // No/invalid session → a PUBLIC sign-in landing (no PII). The form there posts an address to
  // /api/family-auth/request, which emails a short-lived link. No upstream IdP is involved.
  const signin = new URL(
    `/${lang}/family/signin?returnTo=${encodeURIComponent(pathname)}`,
    request.url,
  );
  const cookieName = familySessionCookie();
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return NextResponse.redirect(signin);
  let sub = "", email = "", iat = 0;
  try {
    const secret = new TextEncoder().encode(process.env.FAMILY_SESSION_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);
    sub = typeof payload.sub === "string" ? payload.sub : "";
    email = typeof payload.email === "string" ? payload.email : "";
    iat = typeof payload.iat === "number" ? payload.iat : 0;
  } catch {
    return NextResponse.redirect(signin); // invalid/expired session → re-auth
  }
  // Approval = admin OR Edge Config `familyAccess[sub]`/`familyAccessEmails[email]` approved OR the
  // founder email seed (FAMILY_APPROVED_EMAILS), fail-closed. R0 approves/revokes without redeploy.
  if (!sub || !(await isViewerApproved(sub, email))) return NextResponse.redirect(new URL(`/${lang}/family/pending`, request.url));
  const owner = list(process.env.FAMILY_ADMIN_EMAILS).includes(sub.toLowerCase());
  // QA-156 H1: a session older than the owner's «Завершить сеансы» cut-off ends here, on every family page.
  const os = await osSessionState({ email: email || sub, admin: owner, iat });
  if (os.state === "ended") return sessionEnded(request, lang, pathname);
  if (!FAMILY_ROUTES.test(pathname)) return familyNotFound(request, lang, pathname);
  // The family editor is for the owner and editors only (bus 87: FAMILY_EDITOR_EMAILS — their changes wait for
  // the owner's approval). Refused here, at the edge, with a real 404: a page-level notFound() in a streamed
  // dynamic render still answers 200 (seen 2026-11-16).
  if (/^\/(en|ru)\/family\/admin(\/|$)/.test(pathname) && familyRoleOf(sub, list(process.env.FAMILY_ADMIN_EMAILS), list(process.env.FAMILY_EDITOR_EMAILS)) === "member") return familyNotFound(request, lang, pathname);
  // Family OS «Доступы» (grants, emails): the owner only — never an editor or a member (bus 87).
  if (/^\/(en|ru)\/family\/os\/access(\/|$)/.test(pathname) && !owner) return familyNotFound(request, lang, pathname);
  // The owner who is not a member has no board, council, calendar, Кодекс or week (QA-156 L7). Only when the
  // service answered: an outage leaves the page to say «не отвечает».
  if (MEMBER_ONLY.test(pathname) && owner && os.state === "ok" && !os.member) return familyNotFound(request, lang, pathname);
  // The family not-found page gets no params (bus 97 item 6): pass the language and a route CLASS
  // (no ids) so it can render in the right language and log its reference code. Always overwritten,
  // so a client cannot inject either header.
  const forwarded = new Headers(request.headers);
  forwarded.set("x-kartel-locale", lang);
  forwarded.set("x-family-route", routeClass(pathname));
  return NextResponse.next({ request: { headers: forwarded } });
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

/** Gated surfaces (family area, console) must never be indexed — gated UI/UX audit 2026-11-14 #2.
 *  Set on every response from those branches, redirects included. */
function noindex<T extends Response>(res: T): T {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Ecosystem Operations Console — gated (Family-admin only), at /console and on the
  // console.kartel.org.uk subdomain. Contains internal infra/governance detail → never public.
  // Sign-in runs on the apex (the link nonce cookie stays same-host). The family session is host-only
  // (QA-156 L2), so the console host gets its own cookie through the apex hand-off.
  //
  // Admins = FAMILY_ADMIN_EMAILS (the session subject is the lowercased email). Without it,
  // /console closes to everyone. Must stay in step with familyEnv.adminEmails().
  const host = request.headers.get("host") ?? "";
  // Layer 1: the console is served only on its own host, behind Cloudflare Access.
  const toConsoleHost = consoleRedirectTarget(host, pathname, request.nextUrl.search);
  if (toConsoleHost) return NextResponse.redirect(toConsoleHost, 308);
  const onConsoleHost = host === CONSOLE_HOST;
  if (onConsoleHost) {
    // QA-156 L2: the family session is host-only, so the console host reads its own cookie, minted from the
    // owner's apex session by the hand-off (app/api/family-auth/console*). Ended sessions end the console too.
    const c = await verifyConsoleToken(request.cookies.get(consoleSessionCookie())?.value, "console");
    const ok = !!c && consoleAdmins().includes(c.email) && (await osSessionState({ email: c.email, admin: true, iat: c.sat })).state !== "ended";
    if (!ok) return noindex(NextResponse.redirect(new URL("https://kartel.org.uk/api/family-auth/console-handoff"), 303));
    if (pathname === "/" || pathname === "") {
      const u = request.nextUrl.clone();
      u.pathname = "/console";
      return noindex(NextResponse.rewrite(u));
    }
    return noindex(NextResponse.next());
  }
  if (pathname === "/console" || pathname.startsWith("/console/")) {
    // Local dev only (any other host was sent to the console host above): the family session, as before.
    const token = request.cookies.get(familySessionCookie())?.value;
    let admin = false;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.FAMILY_SESSION_SECRET ?? ""));
        const sub = typeof payload.sub === "string" ? payload.sub : "";
        admin = !!sub && list(process.env.FAMILY_ADMIN_EMAILS).includes(sub.toLowerCase());
      } catch {
        admin = false;
      }
    }
    if (!admin) return noindex(NextResponse.redirect(new URL("https://kartel.org.uk/en/family/signin?returnTo=%2Fconsole")));
    return noindex(NextResponse.next());
  }

  // /en/family and /ru/family — members-only Family Heritage.
  //
  // Option A (R0-signed 2026-07-16) specified gated access via CPIF / Keycloak and explicitly
  // "NOT bespoke auth". That is SUPERSEDED by the R0 decision of 2026-11-14 to retire Keycloak:
  // kartel-site now has its own sign-in and its own user list. The approval model is unchanged —
  // only who authenticates the address has changed. See docs/standalone-auth-design.md.
  // DORMANT by default: FAMILY_GATE ≠ "on" keeps the hard-redirect to home, so the public
  // no-PII authority surface is unchanged. When FAMILY_GATE = "on", the gate is enforced HERE at
  // the edge (session + approval) — fail-closed, before any render. /family/pending stays reachable
  // (no PII) so signed-in-but-unapproved users land somewhere. Reversible: unset FAMILY_GATE.
  if (/^\/(en|ru)\/family(\/|$)/.test(pathname)) {
    const lang = pathname.startsWith("/ru") ? "ru" : "en";
    if (process.env.FAMILY_GATE !== "on") {
      return noindex(NextResponse.redirect(new URL(`/${lang}`, request.url)));
    }
    // Public, no-PII landings reachable without a session:
    if (/^\/(en|ru)\/family\/(pending|signin)\/?$/.test(pathname)) return noindex(NextResponse.next());
    return noindex(await familyEdgeGate(request, pathname));
  }

  // If the path already starts with a known locale, leave it alone.
  // The locale also travels as a request header: app/global-not-found.tsx gets no route params
  // and reads it to render the 404 in the requested language (cycle 5 #1).
  const firstSegment = pathname.split("/")[1];
  if (LOCALES.includes(firstSegment as Locale)) {
    const forwarded = new Headers(request.headers);
    forwarded.set("x-kartel-locale", firstSegment);
    return NextResponse.next({ request: { headers: forwarded } });
  }

  // Backwards compat: legacy ?lang=EN / ?lang=RU URLs → permanent redirect to /{lang}{path}
  const legacyLang = legacyLocaleFromQuery(searchParams.get("lang"));
  const target = request.nextUrl.clone();
  target.pathname = `/${legacyLang ?? detectLocale(request)}${pathname === "/" ? "" : pathname}`;
  target.searchParams.delete("lang");
  return NextResponse.redirect(target, legacyLang ? 308 : 307);
}

export const config = {
  // Skip Next internals, static assets, sitemap, robots, sw, llms files, and any
  // path with a file extension (favicon, images, etc.), and /m/ (the unlisted council mockup, bus 126).
  matcher: [
    "/((?!_next|api|m/|sitemap\\.xml|robots\\.txt|sw\\.js|humans\\.txt|llms\\.txt|llms-full\\.txt|opengraph-image|icon|apple-icon|.*\\.).*)",
  ],
};
