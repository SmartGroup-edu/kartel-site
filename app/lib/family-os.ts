import "server-only";
/**
 * Server-side client for kartel-family-os (family-os/ in this repo, Hetzner app-01).
 *
 * DORMANT unless FAMILY_OS_URL and FAMILY_OS_SECRET are both set. Every call is HMAC-signed with the
 * same scheme as family-media (app/lib/media-signature.mjs) and carries the actor as
 * "admin:<email>" or "member:<email>" — the service authorises on that, so only this server can say
 * who is asking. Optional Cloudflare Access service token: FAMILY_OS_ACCESS_CLIENT_ID / _SECRET.
 */
import { signMediaRequest } from "@/app/lib/media-signature.mjs";
import { isFamilyAdmin } from "@/app/lib/family-gate";

export type OsPerson = { id: string; name_en: string; name_ru: string; kind: "adult" | "child"; email?: string };
export type OsGrant = { id: string; guardian_id: string; child_id: string; relation: "parent" | "relative"; scopes: ("routines" | "health" | "education")[] };
export type OsState =
  | { status: "off" }
  | { status: "error" }
  | { status: "ok"; admin: boolean; me: Omit<OsPerson, "email"> | null; people: OsPerson[]; grants: OsGrant[] };

export function osEnabled(): boolean {
  return Boolean(process.env.FAMILY_OS_URL && process.env.FAMILY_OS_SECRET);
}

export function osActor(session: { email?: string | null; cpifSubjectId: string }): string {
  const email = (session.email ?? session.cpifSubjectId).toLowerCase();
  return `${isFamilyAdmin(session.cpifSubjectId) ? "admin" : "member"}:${email}`;
}

function accessHeaders(): Record<string, string> {
  const id = process.env.FAMILY_OS_ACCESS_CLIENT_ID, secret = process.env.FAMILY_OS_ACCESS_CLIENT_SECRET;
  return id && secret ? { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret } : {};
}

export async function osCall(method: "GET" | "POST" | "DELETE", path: string, actor: string, body?: unknown) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const headers = await signMediaRequest({ secret: process.env.FAMILY_OS_SECRET!, method, path, actor, body: raw });
  return fetch(new URL(path, process.env.FAMILY_OS_URL), {
    method,
    headers: { ...headers, ...accessHeaders(), ...(raw ? { "content-type": "application/json" } : {}) },
    body: raw || undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
}

/** Who I am and who is in the family. Never throws: the page shows a calm error state instead. */
export async function getOsState(session: { email?: string | null; cpifSubjectId: string }): Promise<OsState> {
  if (!osEnabled()) return { status: "off" };
  const actor = osActor(session);
  try {
    const meRes = await osCall("GET", "/me", actor);
    if (!meRes.ok) return { status: "error" };
    const { me, admin } = (await meRes.json()) as { me: OsPerson | null; admin: boolean };
    if (!me && !admin) return { status: "ok", admin, me: null, people: [], grants: [] };
    const pRes = await osCall("GET", "/people", actor);
    if (!pRes.ok) return { status: "error" };
    const { people, grants } = (await pRes.json()) as { people: OsPerson[]; grants: OsGrant[] };
    return { status: "ok", admin, me, people, grants };
  } catch {
    return { status: "error" };
  }
}
