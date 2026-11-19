/**
 * Family OS actions from the browser (Stage 2a documents; Stage 2 routines, retype, admin access; Stage 3c board). Every request: family gate + signed-in,
 * approved session; writes also need the site's own Origin. The service decides who may read what
 * (and logs it) — this route only forwards with the signed actor. Never cached.
 */
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { osEnabled, osActor, withSat } from "@/app/lib/family-os";
import { destroySession } from "@/app/lib/family-auth";
import { endedHref } from "@/app/lib/family-ended";
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
  return { actor: osActor(session), session };
}

type Who = { actor: string; session: { issuedAt?: Date | null } };
/** Signs the call as the viewer; the path carries the session's issued-at (`sat`, go-live R1). */
async function forward(method: string, rawPath: string, who: Who, body: Uint8Array | string = "", extra: Record<string, string> = {}) {
  const path = withSat(rawPath, who.session), actor = who.actor;
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
  // Board reads for the 30 s live refresh (bus 82): JSON, only these paths, only a date/week query.
  if (new RegExp(`^/tasks/${ID}$`).test(path)) { const r = await forward("GET", path, g); return json(r.status, await r.json().catch(() => ({}))); }
  // Passkeys (bus 98/100): the person's own keys and a person's keys for a parent or the owner — JSON only.
  if (new RegExp(`^/(passkeys/mine|people/${ID}/passkeys)$`).test(path)) { const r = await forward("GET", path, g); return json(r.status, await r.json().catch(() => ({}))); }
  if (/^\/(board|my-tasks|plan|sprint)$/.test(path)) {
    const q = new URL(req.url).searchParams, d = q.get("date") ?? q.get("week");
    const key = q.has("week") ? "week" : "date";
    const full = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${path}?${key}=${d}` : path;
    const r = await forward("GET", full, g);
    return json(r.status, await r.json().catch(() => ({})));
  }
  if (!new RegExp(`^/(documents/${ID}/files/${ID}|tasks/${ID}/photo)$`).test(path)) return json(404, { error: "not_found" }); // bus 97 item 4: the review photo (parents only — the service decides)
  const r = await forward("GET", path, g);
  if (r.status === 401) {
    // A document opened in its own tab: on session_ended go straight to sign-in with the calm message.
    const res = await ended(401, await r.json().catch(() => ({})));
    if ((await res.clone().json().catch(() => null))?.error !== "session_ended") return res;
    const from = new URL(req.headers.get("referer") ?? "/ru/family", req.url).pathname;
    return Response.redirect(new URL(endedHref(from.startsWith("/") ? from : "/ru/family"), req.url), 303);
  }
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
  // bus 97 item 4: the optional review photo — raw bytes, same limits as document files.
  if (new RegExp(`^/tasks/${ID}/photo$`).test(path)) {
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_UPLOAD) return json(413, { error: "too_large" });
    const r = await forward("POST", path, g, buf);
    return json(r.status, await r.json().catch(() => ({})));
  }
  if (new RegExp(`^/documents/${ID}/files$`).test(path)) {
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_UPLOAD) return json(413, { error: "too_large" });
    const name = (req.headers.get("x-file-name") ?? "").slice(0, 400);
    const r = await forward("POST", path, g, buf, { "x-file-name": name });
    return json(r.status, await r.json().catch(() => ({})));
  }
  if (new RegExp(`^/(people/${ID}/(documents|routines|pauses|goals|notes|ics)|documents/${ID}/(reveal|copied)|(routines|rotations)/${ID}/check|people|grants|rotations|events|council/\\d{4}-\\d{2}-\\d{2}/tasks|goals/${ID}/checkins|tasks/accept-all|tasks/${ID}/(accept|decline|start|done|continue|review|rework|reassign|cancel|carry)|plan/\\d{4}-\\d{2}-\\d{2}/(build|tasks)|templates|templates/activate|sprint/goals|sprint/goals/${ID}/tasks|kodeks|recognitions|people/${ID}/invite|passkeys/${ID}/(revoke|clear-flag)|people/${ID}/end-sessions|sessions/end-all)$`).test(path)) return forwardJson(req, "POST", path, g);
  return json(404, { error: "not_found" });
}

/**
 * Go-live R1: the owner ended this person's sessions — the service refused a sensitive route. End the site
 * session too, so the next page asks for a fresh sign-in; the browser shows the calm «войди снова» message.
 */
async function ended(status: number, body: Record<string, unknown>) {
  if (status === 401 && body?.error === "session_ended") { await destroySession(); return json(401, { error: "session_ended" }); }
  return json(status, body);
}

/** JSON writes: small bodies only; the service authorises (admin-only routes refuse members there). */
async function forwardJson(req: Request, method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, who: Who) {
  const text = method === "DELETE" ? "" : await req.text();
  if (text.length > 16 * 1024) return json(413, { error: "too_large" });
  const r = await forward(method, path, who, text, text ? { "content-type": "application/json" } : {});
  return ended(r.status, await r.json().catch(() => ({})));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req, true);
  if (g instanceof Response) return g;
  const path = "/" + (await params).op.join("/");
  if (!new RegExp(`^/((routines|documents|people|grants|pauses|rotations|goals|events|templates|sprint/goals|passkeys)/${ID}|plan/\\d{4}-\\d{2}-\\d{2}/tasks/${ID}|rules/[a-z_]{1,40})$`).test(path)) return json(404, { error: "not_found" });
  return forwardJson(req, "PATCH", path, g);
}

export async function PUT(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req, true);
  if (g instanceof Response) return g;
  const path = "/" + (await params).op.join("/");
  if (!new RegExp(`^/(people/${ID}/prefs|council/\\d{4}-\\d{2}-\\d{2}|plan/\\d{4}-\\d{2}-\\d{2}|principle/\\d{4}-\\d{2}-\\d{2})$`).test(path)) return json(404, { error: "not_found" });
  return forwardJson(req, "PUT", path, g);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ op: string[] }> }) {
  const g = await guard(req, true);
  if (g instanceof Response) return g;
  const path = "/" + (await params).op.join("/");
  if (!new RegExp(`^/(grants/${ID}|people/${ID}/ics)$`).test(path)) return json(404, { error: "not_found" });
  return forwardJson(req, "DELETE", path, g);
}
