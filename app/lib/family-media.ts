import "server-only";
/**
 * Server-side client for kartel-family-media (family-media/ in this repo, runs on Hetzner app-01).
 *
 * DORMANT unless FAMILY_MEDIA_URL and FAMILY_MEDIA_SECRET are both set: without them the family
 * page renders exactly as before (static data only) and the editor says the service is off.
 * Every call is signed (app/lib/media-signature.mjs) and short-timeout; reads fail soft.
 */
import { signMediaRequest } from "@/app/lib/media-signature.mjs";

export type MediaRef = string | null;
export type PersonMedia = { portrait: MediaRef; altEN: string; altRU: string };
export type EventMedia = {
  dateFrom: string; dateTo: string;
  placesEN: string; placesRU: string;
  professionEN: string; professionRU: string;
  storyEN: string; storyRU: string;
  photos: { id: string; captionEN: string; captionRU: string }[];
};
/** dims: [width, height] of each referenced file (largest variant), so photos can be laid out before they load. */
export type FamilyMediaContent = { persons: Record<string, PersonMedia>; events: Record<string, EventMedia>; dims?: Record<string, [number, number]> };

export const EMPTY_MEDIA: FamilyMediaContent = { persons: {}, events: {} };

export function mediaEnabled(): boolean {
  return Boolean(process.env.FAMILY_MEDIA_URL && process.env.FAMILY_MEDIA_SECRET);
}

/**
 * Cloudflare Access service token for the tunnel hostname (second gate in front of the HMAC check).
 * Sent only when both values are set; without them requests go out exactly as before.
 */
function accessHeaders(): Record<string, string> {
  const id = process.env.FAMILY_MEDIA_ACCESS_CLIENT_ID, secret = process.env.FAMILY_MEDIA_ACCESS_CLIENT_SECRET;
  return id && secret ? { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret } : {};
}

async function call(method: string, path: string, opts: { actor?: string; body?: Uint8Array | string; contentType?: string; timeoutMs?: number } = {}) {
  const url = new URL(path, process.env.FAMILY_MEDIA_URL);
  const body = opts.body ?? "";
  const headers = await signMediaRequest({ secret: process.env.FAMILY_MEDIA_SECRET!, method, path, actor: opts.actor ?? "", body });
  return fetch(url, {
    method,
    headers: { ...headers, ...accessHeaders(), ...(opts.contentType ? { "content-type": opts.contentType } : {}) },
    body: method === "GET" ? undefined : (body as BodyInit),
    cache: "no-store",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
  });
}

/** Published content for viewers. Never throws: on any failure the page shows static data only. */
export async function getPublishedMedia(): Promise<FamilyMediaContent> {
  if (!mediaEnabled()) return EMPTY_MEDIA;
  try {
    const r = await call("GET", "/content?state=published", { timeoutMs: 2500 });
    if (!r.ok) return EMPTY_MEDIA;
    const j = (await r.json()) as { content?: FamilyMediaContent; dims?: Record<string, [number, number]> };
    return j.content ? { ...j.content, dims: j.dims ?? {} } : EMPTY_MEDIA;
  } catch {
    return EMPTY_MEDIA;
  }
}

/** Admin: the draft plus what is published. Throws on failure (the editor must say so). */
export async function getDraft(actor: string) {
  const r = await call("GET", "/content?state=draft", { actor });
  if (!r.ok) throw new Error(`media service ${r.status}`);
  return (await r.json()) as { content: FamilyMediaContent; published: { content: FamilyMediaContent; at: string | null }; dims?: Record<string, [number, number]> };
}

export async function forward(method: "GET" | "PUT" | "POST", path: string, actor: string, body?: Uint8Array | string, contentType?: string) {
  return call(method, path, { actor, body, contentType, timeoutMs: method === "POST" && path === "/media" ? 20000 : 6000 });
}

export async function fetchMedia(id: string, variant: string, scope: "published" | "admin", actor: string) {
  // The viewer's subject travels as the actor so the service can rate-limit reads per person.
  return call("GET", `/media/${id}/${variant}?scope=${scope}`, { actor, timeoutMs: 8000 });
}
