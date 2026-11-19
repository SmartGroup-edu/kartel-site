import { after } from "next/server";
import { passkeyGuard, osPk, takeChallenge, pjson } from "@/app/lib/family-passkeys";
import { createSession } from "@/app/lib/family-auth";
import { isViewerApproved } from "@/app/lib/family-access";
import { noteSignIn } from "@/app/lib/family-os";
import { safeReturnTo } from "@/app/lib/family-safe-return.mjs";

/**
 * POST { response, returnTo } — sign-in step 2. The service verifies the key and returns the email; the site then
 * re-checks the allowlist (removing someone blocks a passkey at once, as it blocks a link) and mints the same
 * session as the link does, marked amr = "pk". Every failure is the same 401 with no reason.
 */
export async function POST(req: Request): Promise<Response> {
  const g = passkeyGuard(req); if (g) return g;
  const fail = () => pjson(401, { error: "failed" });
  const challengeId = await takeChallenge();
  const b = (await req.json().catch(() => null)) as { response?: unknown; returnTo?: unknown } | null;
  if (!challengeId || !b?.response) return fail();
  const r = await osPk("/passkeys/auth/verify", "auth:passkey", { challenge_id: challengeId, response: b.response });
  const email = typeof r.body.email === "string" ? r.body.email.toLowerCase() : "";
  if (r.status !== 200 || !email || !(await isViewerApproved(email, email))) return fail();
  await createSession({ email, name: null, amr: "pk" });
  after(() => noteSignIn(email));
  const rt = typeof b.returnTo === "string" ? b.returnTo : "";
  return pjson(200, { ok: true, returnTo: safeReturnTo(rt, rt.startsWith("/ru") ? "/ru/family" : "/en/family") });
}
