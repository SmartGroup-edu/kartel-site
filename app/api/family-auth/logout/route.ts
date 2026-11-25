import { NextResponse } from "next/server";
import { destroySession, clearSignInNonce } from "@/app/lib/family-auth";
import { familyEnv } from "@/app/lib/family-env";

/**
 * POST /api/family-auth/logout — destroy the local session. Inert (404) while FAMILY_GATE ≠ "on".
 *
 * Standalone auth: there is no upstream identity provider to sign out of, so this is the whole
 * logout. QA-156 L1: a POST from the site's own Origin only (the «Выйти» form in the header), so a
 * cross-site link or image can no longer sign anyone out. GET is not served.
 */
export async function POST(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });
  if (request.headers.get("origin") !== familyEnv.siteOrigin()) return new NextResponse("Forbidden", { status: 403 });

  await destroySession();
  await clearSignInNonce();

  const lang = new URL(request.headers.get("referer") ?? "/en", request.url).pathname.startsWith("/ru") ? "ru" : "en";
  return NextResponse.redirect(new URL(`/${lang}`, new URL(request.url).origin), 303);
}
