import { NextResponse } from "next/server";
import { destroySession } from "@/app/lib/family-auth";
import { familyEnv } from "@/app/lib/family-env";

/**
 * GET /api/family-auth/logout — destroy the local session, then RP-Initiated Logout at
 * Keycloak (front-channel). Inert (404) while FAMILY_GATE ≠ "on". Mirrors RusJAz /auth/logout.
 */
export async function GET(): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });

  await destroySession();
  const logoutUrl = new URL(`${familyEnv.issuer()}/protocol/openid-connect/logout`);
  logoutUrl.searchParams.set("client_id", familyEnv.clientId());
  logoutUrl.searchParams.set("post_logout_redirect_uri", familyEnv.postLogoutUri());
  return NextResponse.redirect(logoutUrl.toString());
}
