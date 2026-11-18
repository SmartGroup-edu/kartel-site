import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, familyRole } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getPersonPage } from "@/app/lib/family-os";
import FamilyOsPerson from "@/app/components/FamilyOsPerson";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params;
  // "<display name> · Семья" (bus 68 #5). Only for a signed-in, approved viewer; otherwise generic.
  let name: string | null = null;
  if (familyEnv.gateOn()) {
    const { decision, session } = await familyGateDecision();
    if (decision === "allow" && session) {
      const page = await getPersonPage(session, id);
      if (page) name = lang === "ru" ? page.profile.person.name_ru : page.profile.person.name_en;
    }
  }
  const family = lang === "ru" ? "Семья" : "Family";
  return { title: name ? `${name} · ${family}` : family, robots: { index: false, follow: false } };
}

export default async function FamilyOsPersonPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const [state, page] = await Promise.all([getOsState(session), getPersonPage(session, id)]);
  if (state.status !== "ok" || !page) notFound();
  return <FamilyOsPerson lang={lang === "ru" ? "RU" : "EN"} state={state} profile={page.profile} documents={page.documents} routines={page.routines} editor={familyRole(session.cpifSubjectId) === "editor"} />;
}
