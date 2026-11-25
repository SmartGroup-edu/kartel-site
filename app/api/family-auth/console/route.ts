import { NextResponse } from "next/server";
import { familyEnv } from "@/app/lib/family-env";
import { consoleSessionCookie } from "@/app/lib/family-cookie.mjs";
import { mintConsoleToken, verifyConsoleToken, consoleAdmins } from "@/app/lib/console-auth.mjs";

/**
 * GET /api/family-auth/console?t=… (console.kartel.org.uk) — QA-156 L2. Turns the apex hand-off token into the
 * console's own host-only cookie, valid until the apex session would have expired. Every failure → the apex
 * hand-off again (which sends a signed-out owner to sign in).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });
  const url = new URL(request.url);
  const h = await verifyConsoleToken(url.searchParams.get("t"), "console-handoff");
  if (!h || !consoleAdmins().includes(h.email)) return NextResponse.redirect(new URL("https://kartel.org.uk/en/family/signin?returnTo=%2Fconsole"), 303);
  const ttl = Math.max(60, h.sat + familyEnv.sessionMaxAgeSeconds() - Math.floor(Date.now() / 1000));
  const token = await mintConsoleToken({ email: h.email, sat: h.sat, typ: "console", ttl });
  const res = NextResponse.redirect(new URL("/console", url.origin), 303);
  res.cookies.set(consoleSessionCookie(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });
  return res;
}
