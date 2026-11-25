import { headers } from "next/headers";
import NotFoundView from "@/app/components/NotFoundView";
import { newRef, refLogLine } from "@/app/lib/family-ref.mjs";
import { familyEnv } from "@/app/lib/family-env";
import { familyGateDecision, isFamilyAdmin, familyRole } from "@/app/lib/family-gate";
import { getOsNav } from "@/app/lib/family-os";

// Family not-found (bus 97 item 6). A Server Component: it gets no params, so the edge gate forwards the
// language and a route class (no ids). The code is made here and written to the server log once, so the
// page and the log line always agree.
// bus 157b D11: a signed-in family viewer keeps the family layout here (sub-nav + «Выйти»); the tabs are the
// ones they see on every other family page. Anyone else gets the plain site 404 body.
export default async function FamilyNotFound() {
  const h = await headers();
  const lang = h.get("x-kartel-locale") === "ru" ? "ru" : "en";
  const ref = newRef();
  console.warn(refLogLine("not-found", ref, h.get("x-family-route") ?? ""));
  let family: { admin: boolean; editor: boolean; os: boolean } | null = null;
  if (familyEnv.gateOn()) {
    const { decision, session } = await familyGateDecision();
    if (decision === "allow" && session) {
      const sub = session.cpifSubjectId;
      family = { admin: isFamilyAdmin(sub), editor: familyRole(sub) === "editor", os: (await getOsNav(session)).os };
    }
  }
  return <NotFoundView lang={lang} refCode={ref} family={family} />;
}
