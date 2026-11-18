import { familyGateDecision, familyRole, mediaActor } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { forward, mediaEnabled } from "@/app/lib/family-media";
import { getOsState } from "@/app/lib/family-os";
import { FAMILY_TREE_NODES, FAMILY_TIMELINE_EVENTS } from "@/app/content/family-private";

/**
 * The family editor's API — the owner (FAMILY_ADMIN_EMAILS) and editors (FAMILY_EDITOR_EMAILS, bus 87).
 * /api is outside proxy.ts, so every request is checked here: gate on, signed in, approved, owner or editor;
 * writes must come from the site's own origin (CSRF). Keys must be existing tree nodes / chronicle entries.
 * The owner edits the draft and publishes as before. An editor's save becomes a proposal (family-media
 * POST /revisions) that nobody sees until the owner approves it; she never publishes, undoes, reads the
 * audit or decides the queue — the site refuses here and family-media refuses again on the signed actor.
 *
 *   GET  draft | audit (owner) | review
 *   PUT  person/:id | event/:id                     (owner: draft · editor: proposal)
 *   POST undo | publish (owner) · media · review/:id/approve|reject (owner) · review/:id/withdraw (editor) · review/approve-all (owner)
 */
export const dynamic = "force-dynamic";

const PERSON_IDS = new Set(FAMILY_TREE_NODES.map((n) => n.id));
const EVENT_IDS = new Set(FAMILY_TIMELINE_EVENTS.map((e) => e.id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const json = (status: number, obj: unknown) =>
  Response.json(obj, { status, headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } });
type Guard = { actor: string; role: "owner" | "editor"; session: { email?: string | null; cpifSubjectId: string } };

async function guard(req: Request): Promise<Guard | Response> {
  if (!familyEnv.gateOn()) return json(404, { error: "not_found" });
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) return json(401, { error: "unauthorized" });
  const role = familyRole(session.cpifSubjectId);
  if (role === "member") return json(403, { error: "forbidden" });
  if (req.method !== "GET" && req.headers.get("origin") !== familyEnv.siteOrigin()) return json(403, { error: "bad_origin" });
  if (!mediaEnabled()) return json(503, { error: "media_service_off" });
  return { actor: mediaActor(session.cpifSubjectId), role, session };
}
const ownerOnly = () => json(403, { error: "owner_only" });

async function relay(r: Response) {
  const text = await r.text();
  try { return json(r.status, JSON.parse(text)); } catch { return json(r.status === 200 ? 502 : r.status, { error: "upstream" }); }
}

/** The owner's queue with each author's display name (from Family OS) instead of an address. */
async function reviewQueue(g: Guard) {
  const r = await forward("GET", "/revisions?scope=pending", g.actor);
  if (!r.ok) return relay(r);
  const j = (await r.json()) as { revisions: ({ author: string } & Record<string, unknown>)[]; dims: Record<string, [number, number]> };
  const os = await getOsState(g.session);
  const people = os.status === "ok" ? os.people : [];
  const nameOf = (email: string) => { const p = people.find((x) => (x.email ?? "").toLowerCase() === email.toLowerCase()); return p ? { ru: p.name_ru, en: p.name_en } : null; };
  // decided_by is always empty for pending rows; the author's address is replaced by a display name.
  return json(200, { dims: j.dims, revisions: j.revisions.map((row) => { const { author, ...rest } = row; delete rest.decided_by; return { ...rest, author_name: nameOf(author) }; }) });
}

export async function GET(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const op = (await params).op.join("/");
  if (op === "draft") return relay(await forward("GET", "/content?state=draft", g.actor));
  if (op === "audit") return g.role === "owner" ? relay(await forward("GET", "/audit", g.actor)) : ownerOnly();
  if (op === "review") return g.role === "owner" ? reviewQueue(g) : relay(await forward("GET", "/revisions?scope=mine", g.actor));
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
  // An editor's save is a proposal: the same body, kept apart from the draft until the owner approves it.
  return relay(await forward(g.role === "owner" ? "PUT" : "POST", g.role === "owner" ? `/draft/${kind}/${id}` : `/revisions/${kind}/${id}`, g.actor, body, "application/json"));
}

export async function POST(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req);
  if (g instanceof Response) return g;
  const parts = (await params).op, op = parts.join("/");
  if (op === "undo" || op === "publish") return g.role === "owner" ? relay(await forward("POST", `/${op}`, g.actor)) : ownerOnly();
  if (op === "media") {
    const type = req.headers.get("content-type") ?? "";
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return json(415, { error: "unsupported_type" });
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return json(413, { error: "too_large" });
    return relay(await forward("POST", "/media", g.actor, buf, type));
  }
  if (op === "review/approve-all") return g.role === "owner" ? relay(await forward("POST", "/revisions/approve-all", g.actor)) : ownerOnly();
  if (parts[0] === "review" && parts.length === 3 && UUID.test(parts[1])) {
    const action = parts[2];
    if ((action === "approve" || action === "reject") && g.role !== "owner") return ownerOnly();
    if (action === "withdraw" && g.role !== "editor") return json(403, { error: "editor_only" });
    if (!["approve", "reject", "withdraw"].includes(action)) return json(404, { error: "not_found" });
    const body = action === "reject" ? await req.text() : "";
    if (body.length > 4096) return json(413, { error: "too_large" });
    return relay(await forward("POST", `/revisions/${parts[1]}/${action}`, g.actor, body, body ? "application/json" : undefined));
  }
  return json(404, { error: "not_found" });
}
