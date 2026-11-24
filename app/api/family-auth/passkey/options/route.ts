import { passkeyGuard, osPk, bindChallenge, pjson } from "@/app/lib/family-passkeys";

/** POST — sign-in step 1. No email in; the same answer for everyone (bus 98 §5). */
export async function POST(req: Request): Promise<Response> {
  const g = passkeyGuard(req); if (g) return g;
  const r = await osPk("/passkeys/auth/options", "auth:passkey");
  if (r.status !== 200) return pjson(503, { error: "unavailable" });
  await bindChallenge(r.body.challenge_id);
  return pjson(200, { options: r.body.options });
}
