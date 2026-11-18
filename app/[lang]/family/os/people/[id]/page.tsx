import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, familyRole } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { canRegister } from "@/app/lib/family-passkey-rules.mjs";
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
  // Passkeys «Вход» (bus 98/100): the person, a parent of a child, or the owner. Adding needs a fresh link session.
  const subject = state.people.find((x) => x.id === id);
  const self = state.me?.id === id;
  const parentOfChild = subject?.kind === "child" && state.grants.some((g) => g.guardian_id === state.me?.id && g.child_id === id && g.relation === "parent");
  const passkeys = familyEnv.passkeysOn() && (self || parentOfChild || state.admin) ? { self, canAdd: self && canRegister(session) } : null;
  return <FamilyOsPerson passkeys={passkeys} lang={lang === "ru" ? "RU" : "EN"} state={state} profile={page.profile} documents={page.documents} routines={page.routines} prefs={page.prefs} pauses={page.pauses} goals={page.goals} notes={page.notes} ics={page.ics} editor={familyRole(session.cpifSubjectId) === "editor"} />;
}
