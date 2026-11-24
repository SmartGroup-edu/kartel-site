/**
 * Family OS actions from the browser (Stage 2a documents; Stage 2 routines, retype, admin access). Every request: family gate + signed-in,
 * approved session; writes also need the site's own Origin. The service decides who may read what
 * (and logs it) — this route only forwards with the signed actor. Never cached.
 */
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { osEnabled, osActor } from "@/app/lib/family-os";
import { signMediaRequest } from "@/app/lib/media-signature.mjs";

export const dynamic = "force-dynamic";
const ID = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const MAX_UPLOAD = 4 * 1024 * 1024; // Vercel's body limit is 4.5 MB
const headers = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff" };
const json = (status: number, body: unknown) => Response.json(body, { status, headers });

async function guard(req: Request, write: boolean) {
  if (!familyEnv.gateOn() || !osEnabled()) return json(404, { error: "not_found" });
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) return json(401, { error: "unauthorized" });
  if (write && req.headers.get("origin") !== familyEnv.siteOrigin()) return json(403, { error: "bad_origin" });
  return { actor: osActor(session) };
}

async function forward(method: string, path: string, actor: string, body: Uint8Array | string = "", extra: Record<string, string> = {}) {
  const h = await signMediaRequest({ secret: process.env.FAMILY_OS_SECRET!, method, path, actor, body });
  const id = process.env.FAMILY_OS_ACCESS_CLIENT_ID, secret = process.env.FAMILY_OS_ACCESS_CLIENT_SECRET;
  return fetch(new URL(path, process.env.FAMILY_OS_URL), {
    method, cache: "no-store", signal: AbortSignal.timeout(20000), body: method === "GET" ? undefined : (body as BodyInit),
    headers: { ...h, ...extra, ...(id && secret ? { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret } : {}) },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req, false);
  if (g instanceof Response) return g;
  const path = "/" + (await params).op.join("/");
  if (!new RegExp(`^/documents/${ID}/files/${ID}$`).test(path)) return json(404, { error: "not_found" });
  const r = await forward("GET", path, g.actor);
  if (!r.ok || !r.body) return json(r.status === 403 ? 403 : 404, { error: "not_found" });
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(r.body, {
    status: 200,
    headers: { ...headers, "content-type": r.headers.get("content-type") ?? "application/octet-stream",
      // sandbox: a served PDF/image can never run script on this origin
      "content-security-policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "content-disposition": download ? "attachment" : "inline" },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req, true);
  if (g instanceof Response) return g;
  const path = "/" + (await params).op.join("/");
  if (new RegExp(`^/documents/${ID}/files$`).test(path)) {
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_UPLOAD) return json(413, { error: "too_large" });
    const name = (req.headers.get("x-file-name") ?? "").slice(0, 400);
    const r = await forward("POST", path, g.actor, buf, { "x-file-name": name });
    return json(r.status, await r.json().catch(() => ({})));
  }
  if (new RegExp(`^/(people/${ID}/(documents|routines|pauses)|documents/${ID}/(reveal|copied)|(routines|rotations)/${ID}/check|people|grants|rotations)$`).test(path)) return forwardJson(req, "POST", path, g.actor);
  return json(404, { error: "not_found" });
}

/** JSON writes: small bodies only; the service authorises (admin-only routes refuse members there). */
async function forwardJson(req: Request, method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, actor: string) {
  const text = method === "DELETE" ? "" : await req.text();
  if (text.length > 16 * 1024) return json(413, { error: "too_large" });
  const r = await forward(method, path, actor, text, text ? { "content-type": "application/json" } : {});
  return json(r.status, await r.json().catch(() => ({})));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req, true);
  if (g instanceof Response) return g;
  const path = "/" + (await params).op.join("/");
  if (!new RegExp(`^/((routines|documents|people|grants|pauses|rotations)/${ID}|rules/[a-z_]{1,40})$`).test(path)) return json(404, { error: "not_found" });
  return forwardJson(req, "PATCH", path, g.actor);
}

export async function PUT(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req, true);
  if (g instanceof Response) return g;
  const path = "/" + (await params).op.join("/");
  if (!new RegExp(`^/people/${ID}/prefs$`).test(path)) return json(404, { error: "not_found" });
  return forwardJson(req, "PUT", path, g.actor);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req, true);
  if (g instanceof Response) return g;
  const path = "/" + (await params).op.join("/");
  if (!new RegExp(`^/grants/${ID}$`).test(path)) return json(404, { error: "not_found" });
  return forwardJson(req, "DELETE", path, g.actor);
}
