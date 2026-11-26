import { familyGateDecision, isFamilyAdmin, sessionEndedByOwner } from "@/app/lib/family-gate";
import { destroySession } from "@/app/lib/family-auth";
import { familyEnv } from "@/app/lib/family-env";
import { accessListState } from "@/app/lib/family-access";

/**
 * POST /api/family-invite — bus 172 P4, the invite wizard's step 2: is this address on the site's access list?
 * Body { email }. The owner only (FAMILY_ADMIN_EMAILS), the site's own Origin only, never cached. Read-only: the
 * answer is one of listed / not_listed / revoked / unknown, and nothing is written. /api is outside proxy.ts, so
 * every check is made here. Everyone else gets the same 404 as an unknown route.
 */
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };
const json = (status: number, body: unknown) => Response.json(body, { status, headers });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<Response> {
  if (!familyEnv.gateOn()) return json(404, { error: "not_found" });
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session || !isFamilyAdmin(session.cpifSubjectId)) return json(404, { error: "not_found" });
  if (await sessionEndedByOwner(session)) { await destroySession(); return json(401, { error: "session_ended" }); }
  if (req.headers.get("origin") !== familyEnv.siteOrigin()) return json(403, { error: "bad_origin" });
  const text = await req.text();
  if (text.length > 1024) return json(413, { error: "too_large" });
  let email = "";
  try { const b = JSON.parse(text) as { email?: unknown }; email = typeof b.email === "string" ? b.email.trim().toLowerCase() : ""; } catch { /* below */ }
  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { error: "bad_email" });
  return json(200, { state: await accessListState(email) });
}
