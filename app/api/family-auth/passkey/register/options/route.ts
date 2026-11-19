import { passkeyGuard, osPk, bindChallenge, pjson } from "@/app/lib/family-passkeys";
import { familyGateDecision } from "@/app/lib/family-gate";
import { osActor } from "@/app/lib/family-os";
import { canRegister } from "@/app/lib/family-passkey-rules.mjs";

/** POST — add a key, step 1: an approved viewer whose session came from the email link ≤ 15 minutes ago. */
export async function POST(req: Request): Promise<Response> {
  const g = passkeyGuard(req); if (g) return g;
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) return pjson(401, { error: "unauthorized" });
  if (!canRegister(session)) return pjson(403, { error: "reauth" });
  const r = await osPk("/passkeys/register/options", osActor(session));
  if (r.status !== 200) return pjson(r.status === 429 || r.status === 409 ? r.status : 503, { error: String(r.body.error ?? "unavailable") });
  await bindChallenge(r.body.challenge_id);
  return pjson(200, { options: r.body.options });
}
