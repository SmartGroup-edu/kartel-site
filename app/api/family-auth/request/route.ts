import { NextResponse, after } from "next/server";
import { issueSignInNonce, mintSignInLink } from "@/app/lib/family-auth";
import { isViewerApproved } from "@/app/lib/family-access";
import { familyEnv } from "@/app/lib/family-env";
import { safeReturnTo } from "@/app/lib/family-safe-return";
import { sendSignInLink } from "@/app/lib/family-mail";

/**
 * POST /api/family-auth/request — ask for a sign-in link.
 * Body: form-encoded or JSON { email, returnTo? }. Inert (404) while FAMILY_GATE ≠ "on".
 *
 * NO ACCOUNT ENUMERATION — in body, headers, or timing:
 *   - the body is identical whatever the address;
 *   - a nonce cookie is set for EVERY request, so Set-Cookie does not reveal membership;
 *   - the allowlist lookup, link signing and mail send all run in after(), once the response has
 *     gone, so response time does not depend on whether the address is a member.
 * Only the server log distinguishes the cases.
 *
 * NOT RATE LIMITED IN CODE — and it cannot be at this architecture (no KV/Redis/DB; in-memory
 * counters do not survive serverless invocations). A Vercel Firewall rule on this path is a
 * PRECONDITION OF GOING LIVE, not a follow-up. See docs/standalone-auth-design.md §5.
 */
export async function POST(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });

  let email = "";
  let returnToRaw: string | null = null;

  const ctype = request.headers.get("content-type") ?? "";
  const wantsJson = ctype.includes("application/json");
  try {
    if (wantsJson) {
      const body = (await request.json()) as { email?: unknown; returnTo?: unknown };
      email = typeof body.email === "string" ? body.email : "";
      returnToRaw = typeof body.returnTo === "string" ? body.returnTo : null;
    } else {
      const form = await request.formData();
      email = String(form.get("email") ?? "");
      const rt = form.get("returnTo");
      returnToRaw = rt === null ? null : String(rt);
    }
  } catch {
    // Malformed body → same answer as everything else.
  }

  const addr = email.trim().toLowerCase();
  const returnTo = safeReturnTo(returnToRaw);
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) && addr.length <= 254;

  // Unconditional: every request gets a nonce cookie of the same name, shape and lifetime.
  const nonce = await issueSignInNonce();

  after(async () => {
    if (!looksLikeEmail) return;
    try {
      // The allowlist IS the user list: admins, Edge Config, or the founder seed.
      if (!(await isViewerApproved(addr, addr))) return;
      const url = await mintSignInLink(addr, returnTo, nonce);
      await sendSignInLink(addr, url);
    } catch {
      // Never surfaced — a failure here must not reveal membership. No address in the log.
      console.error("[family-auth/request] send failed");
    }
  });

  // Same answer either way — the shape depends only on how the caller asked, never on the result.
  if (wantsJson) {
    return NextResponse.json(
      { ok: true, message: "If that address may access this area, a sign-in link is on its way." },
      { status: 202 },
    );
  }

  // Plain HTML form POST → back to the sign-in landing, which renders the "check your email" copy.
  const lang = returnTo.startsWith("/ru") ? "ru" : "en";
  const back = new URL(`/${lang}/family/signin`, new URL(request.url).origin);
  back.searchParams.set("sent", "1");
  back.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(back, 303);
}
