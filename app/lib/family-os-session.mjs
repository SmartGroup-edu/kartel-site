// QA-156 H1 (R0 25.11): «Завершить сеансы» closes the site too — the edge gate (pages), family-media and the
// family editor's API ask Family OS whether this session is older than the owner's cut-off. Plain ESM + WebCrypto
// (no next/headers), so proxy.ts and the route handlers share it; tests import it directly.
//
// The answer is "ended" only on the service's explicit 401 `session_ended`. When the service is off, slow or down
// the answer is "unknown" and the caller lets the request through: the cut-off lives in Family OS, so its outage
// must not lock the family out of the heritage pages. Family OS pages still fail closed (every call carries `sat`).
import { signMediaRequest } from "./media-signature.mjs";

// Pages and the editor ask on every request. Family photos (many per page) pass cacheMs: "ok" is then remembered
// for up to 30 s per session, so an end reaches an open page's photos within 30 s. "ended" is remembered for good —
// a session never comes back.
export const PHOTO_CACHE_MS = 30_000;
const cache = new Map();

/**
 * @param {{ email: string, admin: boolean, iat: number, cacheMs?: number }} s  iat = the session's issued-at, seconds
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<{ state: "ok" | "ended" | "unknown", member: boolean }>}
 */
export async function osSessionState(s, env = process.env, fetchImpl = fetch) {
  const key = `${s.admin ? "a" : "m"}:${s.email.toLowerCase()}|${s.iat}`, hit = cache.get(key), now = Date.now();
  if (hit && (hit.state === "ended" || now - hit.at < (s.cacheMs ?? 0))) return { state: hit.state, member: hit.member };
  const out = await ask(s, env, fetchImpl);
  if (out.state !== "unknown") {
    if (cache.size > 2000) cache.clear();
    cache.set(key, { ...out, at: now });
  }
  return out;
}

async function ask({ email, admin, iat }, env, fetchImpl) {
  if (!env.FAMILY_OS_URL || !env.FAMILY_OS_SECRET) return { state: "unknown", member: false };
  const path = `/me?sat=${Number.isInteger(iat) && iat > 0 ? iat : 0}`, actor = `${admin ? "admin" : "member"}:${email.toLowerCase()}`;
  try {
    const h = await signMediaRequest({ secret: env.FAMILY_OS_SECRET, method: "GET", path, actor });
    const access = env.FAMILY_OS_ACCESS_CLIENT_ID && env.FAMILY_OS_ACCESS_CLIENT_SECRET
      ? { "CF-Access-Client-Id": env.FAMILY_OS_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": env.FAMILY_OS_ACCESS_CLIENT_SECRET } : {};
    const r = await fetchImpl(new URL(path, env.FAMILY_OS_URL), { headers: { ...h, ...access }, cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (r.status === 401) {
      const b = await r.json().catch(() => null);
      return { state: b?.error === "session_ended" ? "ended" : "unknown", member: false };
    }
    if (!r.ok) return { state: "unknown", member: false };
    const b = await r.json().catch(() => null);
    return { state: "ok", member: Boolean(b?.me) };
  } catch {
    return { state: "unknown", member: false };
  }
}
