import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getKeycloak, verifyIdToken, createSession } from "@/app/lib/family-auth";
import { familyEnv } from "@/app/lib/family-env";
import { safeReturnTo } from "@/app/lib/family-safe-return";

/**
 * GET /api/family-auth/callback — Keycloak OIDC callback. Validates state, exchanges the code
 * (PKCE), verifies the id_token via JWKS, extracts sub=cpifSubjectId, creates the local session
 * cookie, and redirects to the (safe) returnTo. Inert (404) while FAMILY_GATE ≠ "on".
 * No local User upsert (kartel-site has no DB yet) — entitlement lookup is family_access (P2).
 * Mirrors RusJAz /auth/callback.
 */
export async function GET(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/en?family_auth=${reason}`, url.origin));

  if (err) return fail("denied");
  if (!code || !state) return fail("missing");

  const c = await cookies();
  const storedState = c.get("family_oidc_state")?.value;
  const verifier = c.get("family_oidc_verifier")?.value;
  const returnTo = safeReturnTo(c.get("family_oidc_return")?.value);
  c.delete("family_oidc_state");
  c.delete("family_oidc_verifier");
  c.delete("family_oidc_return");

  if (!storedState || state !== storedState) return fail("state");
  if (!verifier) return fail("verifier");

  try {
    const tokens = await getKeycloak().validateAuthorizationCode(code, verifier);
    const claims = await verifyIdToken(tokens.idToken());
    const sub = claims.sub as string | undefined;
    if (!sub) throw new Error("id_token missing sub");
    await createSession({
      cpifSubjectId: sub,
      email: (claims.email as string) ?? "",
      name: (claims.name as string) ?? null,
    });
    return NextResponse.redirect(new URL(returnTo, url.origin));
  } catch (e) {
    console.error("[family-auth/callback]", e);
    return fail("exchange");
  }
}
