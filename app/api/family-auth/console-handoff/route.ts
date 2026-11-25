import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/family-auth";
import { familyEnv } from "@/app/lib/family-env";
import { CONSOLE_HOST } from "@/app/lib/console-host.mjs";
import { mintConsoleToken, HANDOFF_TTL_S } from "@/app/lib/console-auth.mjs";
import { osSessionState } from "@/app/lib/family-os-session.mjs";

/**
 * GET /api/family-auth/console-handoff (apex) — QA-156 L2. The family session is host-only, so the owner's apex
 * session mints a 60-second token for console.kartel.org.uk, which turns it into the console's own cookie.
 * Owner only; a session ended by «Завершить сеансы» gets nothing. No session → sign in, then back to /console.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const signin = NextResponse.redirect(new URL("/en/family/signin?returnTo=%2Fconsole", origin), 303);
  const session = await getSession();
  if (!session || !familyEnv.adminEmails().includes(session.cpifSubjectId.toLowerCase())) return signin;
  const sat = Math.floor(session.issuedAt.getTime() / 1000);
  if ((await osSessionState({ email: session.email, admin: true, iat: sat })).state === "ended") return signin;
  const t = await mintConsoleToken({ email: session.email, sat, typ: "console-handoff", ttl: HANDOFF_TTL_S });
  const host = new URL(request.url).hostname;
  const target = host === "localhost" || host === "127.0.0.1" ? new URL("/api/family-auth/console", origin) : new URL(`https://${CONSOLE_HOST}/api/family-auth/console`);
  target.searchParams.set("t", t);
  return NextResponse.redirect(target, 303);
}
