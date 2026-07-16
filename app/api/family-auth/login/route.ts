import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getKeycloak, generateState, generateCodeVerifier } from "@/app/lib/family-auth";
import { familyEnv } from "@/app/lib/family-env";
import { safeReturnTo } from "@/app/lib/family-safe-return";

/**
 * GET /api/family-auth/login — start the Keycloak OIDC Authorization-Code + PKCE flow
 * for the members-only Family Heritage area. Inert (404) while FAMILY_GATE ≠ "on".
 * Mirrors RusJAz /auth/login (PKCE + short-lived HTTP-only state/verifier/return cookies).
 */
export async function GET(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });

  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const authUrl = getKeycloak().createAuthorizationURL(state, codeVerifier, [
    "openid",
    "profile",
    "email",
  ]);

  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  const c = await cookies();
  c.set("family_oidc_state", state, opts);
  c.set("family_oidc_verifier", codeVerifier, opts);
  c.set("family_oidc_return", returnTo, opts);

  return NextResponse.redirect(authUrl);
}
