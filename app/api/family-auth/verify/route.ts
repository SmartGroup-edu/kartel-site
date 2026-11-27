import { NextResponse, after } from "next/server";
import { decodeJwt } from "jose";
import { checkSignInLink, readSignInNonce, clearSignInNonce, createSession } from "@/app/lib/family-auth";
import { signInAs } from "@/app/lib/family-access";
import { guestSignedIn } from "@/app/lib/family-guest.mjs";
import { familyEnv } from "@/app/lib/family-env";
import { safeReturnTo } from "@/app/lib/family-safe-return.mjs";
import { noteSignIn } from "@/app/lib/family-os";
import { pendingState, consumePending, checkPendingCode, codesOn } from "@/app/lib/family-signin";
import { normCode } from "@/app/lib/family-signin-code.mjs";

/**
 * GET /api/family-auth/verify?token=… — consume a sign-in link and create the session.
 * POST /api/family-auth/verify { code, returnTo } — the six-digit code from the same letter (bus 165), typed in
 * the tab that asked. One path on purpose: the Vercel Firewall rate limit on /verify covers both.
 * Inert (404) while FAMILY_GATE ≠ "on".
 *
 * The link requires BOTH a valid token and the matching nonce cookie set in this browser when it was
 * requested, so an intercepted link is useless elsewhere. The allowlist is re-checked at consumption time:
 * entitlement may have been revoked in the minutes since the link was issued.
 *
 * bus 165: a link WE signed is told why it failed — expired, opened in another browser, superseded by a newer
 * request, already used — because it only ever reaches the address it was sent to. A forged or malformed token
 * still gets the one undifferentiated `invalid`. The reason code (never the address or token) is logged.
 */
export async function GET(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  /**
   * Keep the viewer in the language they started in; fall back to en.
   *
   * A failure does NOT clear the nonce cookie. Clearing it broke the newest, valid link: tap an
   * older letter (or the same link twice) and the cookie for the latest request was wiped, so
   * «request a new one» looped. The nonce is random and useless without a matching token, so
   * keeping it until it expires (10 min) or a link succeeds costs nothing.
   */
  const fail = (lang: "en" | "ru" = "en", reason: "invalid" | "expired" | "elsewhere" | "superseded" | "used" = "invalid", returnTo?: string) => {
    console.warn(`[family-auth/verify] link ${reason}`);
    const to = new URL(`/${lang}/family/signin`, url.origin);
    to.searchParams.set("family_auth", reason);
    if (returnTo) to.searchParams.set("returnTo", safeReturnTo(returnTo, `/${lang}/family`));
    return NextResponse.redirect(to);
  };

  if (!token) return fail();

  const chk = await checkSignInLink(token);
  if (!chk.ok) {
    if (!chk.claims) return fail(langHint(token), chk.reason === "expired" ? "expired" : "invalid");
    const { nonce, returnTo } = chk.claims;
    const lang = langOf(returnTo);
    // No cookie, or a newer request's cookie: what became of THIS request? Read-only — a mail scanner or another
    // browser opening the link must never use it up.
    const st = await pendingState(nonce);
    if (st === "superseded" || st === "used" || st === "expired") return fail(lang, st, returnTo);
    return fail(lang, chk.reason === "mismatch" ? "superseded" : "elsewhere", returnTo);
  }
  const claims = chk.claims;
  const lang = langOf(claims.returnTo);

  // Re-check at consumption time, not only at issue time.
  const as = await signInAs(claims.email);
  if (!as) return fail(lang);

  // Single use (bus 165). Family OS not answering, or a request it never recorded, leaves the link working as
  // before — the cookie and the signed token are still both required.
  const used = await consumePending(claims.nonce);
  if (used && used.state !== "ok" && used.state !== "unknown") {
    return fail(lang, used.state === "superseded" || used.state === "used" || used.state === "expired" ? used.state : "invalid", claims.returnTo);
  }
  if (used?.state === "ok" && used.email !== claims.email) return fail(lang);

  await createSession({ email: claims.email, name: null });
  await clearSignInNonce();
  // «Кто уже с нами» (bus 97 item 3): the sign-in DATE, after the response, so it never slows or blocks sign-in.
  // bus 176 P4: a guest's sign-in goes to the guest log instead (who and when).
  after(() => (as === "guest" ? guestSignedIn(claims.email) : noteSignIn(claims.email)));

  return NextResponse.redirect(new URL(safeReturnTo(claims.returnTo), url.origin));
}

const noStore = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };
const cjson = (status: number, body: unknown) => Response.json(body, { status, headers: noStore });

/**
 * POST { code, returnTo } — the code from the letter. Needs this browser's nonce cookie (the tab that asked) and
 * the site's Origin. Family OS compares the HMACs in constant time, allows five tries per request, twenty per
 * client per 10 minutes, and writes the audit row (no code). Answers: 200 { ok, returnTo } or 4xx { error, left? }
 * with error ∈ no_request · format · wrong · locked · superseded · expired · used · invalid · rate_limited ·
 * unavailable.
 */
export async function POST(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });
  if (request.headers.get("origin") !== familyEnv.siteOrigin()) return cjson(403, { error: "forbidden" });
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return cjson(415, { error: "json_only" });
  const b = (await request.json().catch(() => null)) as { code?: unknown; returnTo?: unknown } | null;
  const rt = typeof b?.returnTo === "string" ? b.returnTo : "";
  const returnTo = safeReturnTo(rt, rt.startsWith("/ru") ? "/ru/family" : "/en/family");

  const nonce = await readSignInNonce();
  if (!nonce) return cjson(400, { error: "no_request" });
  const code = normCode(b?.code);
  if (!code) return cjson(400, { error: "format" });
  if (!codesOn()) return cjson(503, { error: "unavailable" });

  const r = await checkPendingCode(nonce, code, request);
  if (r.status === 429) { console.warn("[family-auth/verify] code rate_limited"); return cjson(429, { error: "rate_limited" }); }
  if (r.status !== 200 || !r.state) { console.error("[family-auth/verify] code unavailable"); return cjson(503, { error: "unavailable" }); }
  console.info(`[family-auth/verify] code ${r.state}`);

  const as = r.state === "ok" && r.email ? await signInAs(r.email) : null;
  if (as && r.email) {
    await createSession({ email: r.email, name: null });
    await clearSignInNonce();
    after(() => (as === "guest" ? guestSignedIn(r.email!) : noteSignIn(r.email!)));
    return cjson(200, { ok: true, returnTo });
  }
  const error = r.state === "wrong" || r.state === "locked" || r.state === "superseded" || r.state === "expired" || r.state === "used" ? r.state : "invalid";
  return cjson(error === "locked" ? 429 : 400, { error, ...(r.left !== null && error !== "locked" ? { left: r.left } : {}) });
}

const langOf = (rt: string): "en" | "ru" => (rt.startsWith("/ru") ? "ru" : "en");

/** Language of the failure page only — read from the (unverified) token; never used for anything else. */
function langHint(token: string): "en" | "ru" {
  try {
    const rt = decodeJwt(token).rt;
    return typeof rt === "string" && rt.startsWith("/ru") ? "ru" : "en";
  } catch {
    return "en";
  }
}
