import { NextResponse } from "next/server";
import { destroySession, clearSignInNonce } from "@/app/lib/family-auth";
import { familyEnv } from "@/app/lib/family-env";

/**
 * GET /api/family-auth/logout — destroy the local session. Inert (404) while FAMILY_GATE ≠ "on".
 *
 * Standalone auth: there is no upstream identity provider to sign out of, so this is the whole
 * logout. Previously this redirected to the Keycloak RP-initiated end_session endpoint.
 */
export async function GET(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });

  await destroySession();
  await clearSignInNonce();

  return NextResponse.redirect(new URL("/en", new URL(request.url).origin));
}
