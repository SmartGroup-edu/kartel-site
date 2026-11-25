import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, familyRole } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getKodeks, getPrinciple } from "@/app/lib/family-os";
import FamilyKodeks from "@/app/components/FamilyKodeks";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { osDownNav, OS_DOWN_TITLE } from "@/app/lib/family-os-down";

// Кодекс семьи (bus 86): gated like every Family OS page; members read, parents add versions (the service decides).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Кодекс · Семья" : "Code · Family", robots: { index: false, follow: false } };
}

export default async function FamilyKodeksPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const state = await getOsState(session);
  const L = lang === "ru" ? "RU" : "EN";
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.kodeks[L]} nav={osDownNav(session.cpifSubjectId)} />;
  if (!state.me) notFound();
  const [kodeks, principle] = await Promise.all([getKodeks(session), getPrinciple(session)]);
  return <FamilyKodeks lang={lang === "ru" ? "RU" : "EN"} kodeks={kodeks} admin={state.admin} principle={principle} editor={familyRole(session.cpifSubjectId) === "editor"} />;
}
