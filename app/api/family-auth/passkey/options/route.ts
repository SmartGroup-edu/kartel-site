import { createHmac } from "node:crypto";
import { passkeyGuard, osPk, bindChallenge, pjson } from "@/app/lib/family-passkeys";

/**
 * QA-156 M5: who is asking, for the service's per-client challenge cap — an HMAC of the client IP under the
 * service secret, so neither the service nor its log ever sees the address. Vercel sets x-forwarded-for.
 */
function clientKey(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.FAMILY_OS_SECRET ?? "").update(`pk-client:${ip}`).digest("hex").slice(0, 32);
}

/** POST — sign-in step 1. No email in; the same answer for everyone (bus 98 §5). */
export async function POST(req: Request): Promise<Response> {
  const g = passkeyGuard(req); if (g) return g;
  const r = await osPk("/passkeys/auth/options", "auth:passkey", { client: clientKey(req) });
  if (r.status === 429) return pjson(429, { error: "rate_limited" });
  if (r.status !== 200) return pjson(503, { error: "unavailable" });
  await bindChallenge(r.body.challenge_id);
  return pjson(200, { options: r.body.options });
}
