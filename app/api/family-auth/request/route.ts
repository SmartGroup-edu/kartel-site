import { NextResponse, after } from "next/server";
import { issueSignInNonce, mintSignInLink } from "@/app/lib/family-auth";
import { signInAs } from "@/app/lib/family-access";
import { familyEnv } from "@/app/lib/family-env";
import { safeReturnTo } from "@/app/lib/family-safe-return.mjs";
import { sendSignInLink } from "@/app/lib/family-mail";
import { recordPending } from "@/app/lib/family-signin";

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
 * Rate limits live outside this function (QA-156 M1): a Vercel Firewall rule per IP on this path, and
 * kartel-mail-relay caps sign-in letters per address. Here: the site's own Origin only (no cross-site
 * form can request a link or overwrite a victim's nonce) — refused the same way for every address.
 */
export async function POST(request: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return new NextResponse("Not found", { status: 404 });
  if (request.headers.get("origin") !== familyEnv.siteOrigin()) return new NextResponse("Forbidden", { status: 403 });

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
      // The allowlist IS the user list: admins, Edge Config, or the founder seed — or (bus 176 P4) an active guest.
      const member = (await signInAs(addr)) !== null;
      // bus 165: every well-formed request is a pending sign-in in Family OS — a stranger's too, so a code typed
      // against it behaves exactly like a member's. It also supersedes older requests for the same address.
      const code = await recordPending(nonce, addr, member);
      if (!member) return;
      const url = await mintSignInLink(addr, returnTo, nonce);
      // No code when Family OS did not take the request: it could not be checked. The link still works.
      await sendSignInLink(addr, url, returnTo.startsWith("/ru") ? "ru" : "en", code);
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
