import { NextResponse, after } from "next/server";
import { decodeJwt } from "jose";
import { verifySignInLink, clearSignInNonce, createSession } from "@/app/lib/family-auth";
import { isViewerApproved } from "@/app/lib/family-access";
import { familyEnv } from "@/app/lib/family-env";
import { safeReturnTo } from "@/app/lib/family-safe-return.mjs";
import { noteSignIn } from "@/app/lib/family-os";

/**
 * GET /api/family-auth/verify?token=… — consume a sign-in link and create the session.
 * Inert (404) while FAMILY_GATE ≠ "on".
 *
 * Requires BOTH a valid token and the matching nonce cookie set in this browser when the link
 * was requested, so an intercepted link is useless elsewhere. The allowlist is re-checked here:
 * entitlement may have been revoked in the minutes since the link was issued.
 *
 * Every failure returns the same `family_auth=invalid` outcome — a caller must not be able to
 * tell an expired link from a wrong browser from a revoked address.
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
  const fail = (lang: "en" | "ru" = "en") =>
    NextResponse.redirect(new URL(`/${lang}/family/signin?family_auth=invalid`, url.origin));

  if (!token) return fail();

  const claims = await verifySignInLink(token);
  if (!claims) return fail(langHint(token));
  const lang = claims.returnTo.startsWith("/ru") ? "ru" : "en";

  // Re-check at consumption time, not only at issue time.
  if (!(await isViewerApproved(claims.email, claims.email))) return fail(lang);

  await createSession({ email: claims.email, name: null });
  await clearSignInNonce();
  // «Кто уже с нами» (bus 97 item 3): the sign-in DATE, after the response, so it never slows or blocks sign-in.
  after(() => noteSignIn(claims.email));

  return NextResponse.redirect(new URL(safeReturnTo(claims.returnTo), url.origin));
}

/** Language of the failure page only — read from the (unverified) token; never used for anything else. */
function langHint(token: string): "en" | "ru" {
  try {
    const rt = decodeJwt(token).rt;
    return typeof rt === "string" && rt.startsWith("/ru") ? "ru" : "en";
  } catch {
    return "en";
  }
}
