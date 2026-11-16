import { familyGateDecision, isFamilyAdmin } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { forward, mediaEnabled } from "@/app/lib/family-media";
import { FAMILY_TREE_NODES, FAMILY_TIMELINE_EVENTS } from "@/app/content/family-private";

/**
 * The family editor's API — admins only (FAMILY_ADMIN_EMAILS). /api is outside proxy.ts, so every
 * request is checked here: gate on, signed in, approved, admin; writes must come from the site's
 * own origin (CSRF). Keys must be existing tree nodes / chronicle entries — the editor adds photos
 * and stories to existing people and entries, it never creates people or changes names or text.
 *
 *   GET  draft | audit        PUT person/:id | event/:id        POST undo | publish | media
 */
export const dynamic = "force-dynamic";

const PERSON_IDS = new Set(FAMILY_TREE_NODES.map((n) => n.id));
const EVENT_IDS = new Set(FAMILY_TIMELINE_EVENTS.map((e) => e.id));
const json = (status: number, obj: unknown) =>
  Response.json(obj, { status, headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } });

async function guard(req: Request): Promise<{ actor: string } | Response> {
  if (!familyEnv.gateOn()) return json(404, { error: "not_found" });
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) return json(401, { error: "unauthorized" });
  if (!isFamilyAdmin(session.cpifSubjectId)) return json(403, { error: "forbidden" });
  if (req.method !== "GET" && req.headers.get("origin") !== familyEnv.siteOrigin()) return json(403, { error: "bad_origin" });
  if (!mediaEnabled()) return json(503, { error: "media_service_off" });
  return { actor: session.cpifSubjectId };
}

async function relay(r: Response) {
  const text = await r.text();
  try { return json(r.status, JSON.parse(text)); } catch { return json(r.status === 200 ? 502 : r.status, { error: "upstream" }); }
}

export async function GET(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const op = (await params).op.join("/");
  if (op === "draft") return relay(await forward("GET", "/content?state=draft", g.actor));
  if (op === "audit") return relay(await forward("GET", "/audit", g.actor));
  return json(404, { error: "not_found" });
}

export async function PUT(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const [kind, id, ...rest] = (await params).op;
  const known = kind === "person" ? PERSON_IDS.has(id) : kind === "event" ? EVENT_IDS.has(id) : false;
  if (rest.length || !known) return json(404, { error: "not_found" });
  const body = await req.text();
  if (body.length > 64 * 1024) return json(413, { error: "too_large" });
  return relay(await forward("PUT", `/draft/${kind}/${id}`, g.actor, body, "application/json"));
}

export async function POST(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const op = (await params).op.join("/");
  if (op === "undo") return relay(await forward("POST", "/undo", g.actor));
  if (op === "publish") return relay(await forward("POST", "/publish", g.actor));
  if (op === "media") {
    const type = req.headers.get("content-type") ?? "";
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return json(415, { error: "unsupported_type" });
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return json(413, { error: "too_large" });
    return relay(await forward("POST", "/media", g.actor, buf, type));
  }
  return json(404, { error: "not_found" });
}
