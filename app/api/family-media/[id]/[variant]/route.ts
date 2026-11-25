import { familyGateDecision, familyRole, mediaActor, sessionEndedByOwner } from "@/app/lib/family-gate";
import { destroySession } from "@/app/lib/family-auth";
import { PHOTO_CACHE_MS } from "@/app/lib/family-os-session.mjs";
import { familyEnv } from "@/app/lib/family-env";
import { fetchMedia, mediaEnabled } from "@/app/lib/family-media";

/**
 * GET /api/family-media/:id/:variant — a family photo, for signed-in approved viewers only.
 * /api is outside proxy.ts, so this route checks the session itself. Never cached anywhere
 * (private, no-store), never indexed. Viewers get only files the published content uses; the owner
 * also sees draft files (scope=admin); an editor sees those too, plus only her own hidden uploads
 * (family-media decides that on the signed "editor:" actor).
 */
export const dynamic = "force-dynamic";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VARIANT = /^(256|640|1280)\.(webp|avif)$/;
const deny = (status: number) =>
  new Response(null, { status, headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
  if (!familyEnv.gateOn() || !mediaEnabled()) return deny(404);
  const { id, variant } = await params;
  if (!ID.test(id) || !VARIANT.test(variant)) return deny(404);
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) return deny(401);
  // QA-156 H1. Many photos per page: the answer is reused for up to 30 s (PHOTO_CACHE_MS).
  if (await sessionEndedByOwner(session, { cacheMs: PHOTO_CACHE_MS })) { await destroySession(); return deny(401); }
  const role = familyRole(session.cpifSubjectId);
  const r = await fetchMedia(id, variant, role === "member" ? "published" : "admin", mediaActor(session.cpifSubjectId)).catch(() => null);
  if (!r || !r.ok || !r.body) return deny(r?.status === 404 ? 404 : 502);
  return new Response(r.body, {
    status: 200,
    headers: {
      "content-type": variant.endsWith(".avif") ? "image/avif" : "image/webp",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
      "content-disposition": "inline",
    },
  });
}
