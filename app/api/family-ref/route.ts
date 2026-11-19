import { getSession } from "@/app/lib/family-auth";
import { familyEnv } from "@/app/lib/family-env";
import { REF_RE, refLogLine } from "@/app/lib/family-ref.mjs";

// Bus 97 item 6: a client-side error on a Family OS page has no server digest, so the error page makes a
// code and reports it here; this writes the one log line. Signed-in visitors only; a fixed shape only —
// the code and the page's route CLASS, never a message, stack or id. Always 204, so it reveals nothing.
export async function POST(request: Request): Promise<Response> {
  const none = new Response(null, { status: 204 });
  if (request.headers.get("origin") !== new URL(familyEnv.siteOrigin()).origin) return none;
  if (!(await getSession())) return none;
  const body = (await request.json().catch(() => null)) as { ref?: unknown; route?: unknown } | null;
  const ref = typeof body?.ref === "string" ? body.ref : "";
  const route = typeof body?.route === "string" ? body.route.slice(0, 200) : "";
  if (!REF_RE.test(ref) || Object.keys(body ?? {}).some((k) => k !== "ref" && k !== "route")) return none;
  console.warn(refLogLine("client-error", ref, route));
  return none;
}
