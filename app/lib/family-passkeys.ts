// Passkeys on the site (bus 98/100): the four browser-facing routes share these helpers. The family-os service
// runs the ceremonies and holds the keys; the site binds a challenge to the browser and mints the session.
import { cookies } from "next/headers";
import { familyEnv } from "@/app/lib/family-env";
import { osCall, osEnabled } from "@/app/lib/family-os";
import { PK_COOKIE, pkCookieOptions as pkCookieOptionsRaw, validChallengeId } from "@/app/lib/family-passkey-rules.mjs";

const pkCookieOptions = () => ({ ...pkCookieOptionsRaw(), sameSite: "lax" as const });

export const noStore = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };
export const pjson = (status: number, body: unknown) => Response.json(body, { status, headers: noStore });

/** Feature on, OS reachable, and (writes) the site's own Origin with a JSON body. null = go ahead. */
export function passkeyGuard(req: Request): Response | null {
  if (!familyEnv.gateOn() || !familyEnv.passkeysOn() || !osEnabled()) return pjson(404, { error: "not_found" });
  if (req.headers.get("origin") !== familyEnv.siteOrigin()) return pjson(403, { error: "bad_origin" });
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) return pjson(415, { error: "json_only" });
  return null;
}

/** Call the service and hand back { status, body } — never throws. */
export async function osPk(path: string, actor: string, body: unknown = {}) {
  try {
    const r = await osCall("POST", path, actor, body);
    return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch { return { status: 503, body: { error: "unavailable" } }; }
}

/** C2: bind the challenge to this browser (__Host-, Secure, HttpOnly, Lax, Path=/, 5 minutes). */
export async function bindChallenge(id: unknown) {
  if (validChallengeId(id)) (await cookies()).set(PK_COOKIE, id as string, pkCookieOptions());
}
/** Read and clear the bound challenge in one step — it is single-use here as it is in the service. */
export async function takeChallenge(): Promise<string | null> {
  const jar = await cookies();
  const id = jar.get(PK_COOKIE)?.value ?? null;
  jar.set(PK_COOKIE, "", { ...pkCookieOptions(), maxAge: 0 });
  return validChallengeId(id) ? id : null;
}
