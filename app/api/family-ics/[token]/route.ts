/**
 * Personal calendar feed (Family OS Stage 3b, bus 79). Calendar apps fetch it without a session, so
 * the URL's token is the credential: the site only forwards it, signed as "system:ics"; the service
 * looks it up by SHA-256 and serves that person's feed. The person can change or switch off the link
 * at any time («Календарь в телефоне» on their page). Never cached, never indexed.
 */
import { osEnabled } from "@/app/lib/family-os";
import { signMediaRequest } from "@/app/lib/media-signature.mjs";

export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff" };

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!osEnabled() || !/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response("Not found", { status: 404, headers });
  const path = `/ics/${token}`;
  const h = await signMediaRequest({ secret: process.env.FAMILY_OS_SECRET!, method: "GET", path, actor: "system:ics", body: "" });
  const id = process.env.FAMILY_OS_ACCESS_CLIENT_ID, secret = process.env.FAMILY_OS_ACCESS_CLIENT_SECRET;
  const r = await fetch(new URL(path, process.env.FAMILY_OS_URL), { cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { ...h, ...(id && secret ? { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret } : {}) } }).catch(() => null);
  if (!r?.ok) return new Response("Not found", { status: r?.status === 429 ? 429 : 404, headers });
  return new Response(await r.text(), { status: 200, headers: { ...headers, "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="kartel-family.ics"' } });
}
