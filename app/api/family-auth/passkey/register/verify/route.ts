import { passkeyGuard, osPk, takeChallenge, pjson } from "@/app/lib/family-passkeys";
import { familyGateDecision } from "@/app/lib/family-gate";
import { osActor, withSat } from "@/app/lib/family-os";
import { destroySession } from "@/app/lib/family-auth";
import { canRegister } from "@/app/lib/family-passkey-rules.mjs";

/** POST { response } — add a key, step 2. Same checks as step 1; the device kind comes from the User-Agent. */
export async function POST(req: Request): Promise<Response> {
  const g = passkeyGuard(req); if (g) return g;
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) return pjson(401, { error: "unauthorized" });
  if (!canRegister(session)) return pjson(403, { error: "reauth" });
  const challengeId = await takeChallenge();
  const b = (await req.json().catch(() => null)) as { response?: unknown } | null;
  if (!challengeId || !b?.response) return pjson(400, { error: "failed" });
  const r = await osPk(withSat("/passkeys/register/verify", session), osActor(session), { challenge_id: challengeId, response: b.response, ua: (req.headers.get("user-agent") ?? "").slice(0, 300) });
  if (r.status === 401 && r.body.error === "session_ended") { await destroySession(); return pjson(401, { error: "session_ended" }); }
  return r.status === 201 ? pjson(201, { ok: true }) : pjson(r.status === 429 ? 429 : 400, { error: "failed" });
}
