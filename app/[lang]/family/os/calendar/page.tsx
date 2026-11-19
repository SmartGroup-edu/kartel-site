import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, familyRole } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getCalendar } from "@/app/lib/family-os";
import FamilyCalendar from "@/app/components/FamilyCalendar";

// Gated like every Family OS page; the service decides who reads and who writes.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Календарь · Семья" : "Calendar · Family", robots: { index: false, follow: false } };
}

export default async function FamilyCalendarPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const [state, cal] = await Promise.all([getOsState(session), getCalendar(session)]);
  if (state.status !== "ok" || (!state.me && !state.admin)) notFound();
  return <FamilyCalendar lang={lang === "ru" ? "RU" : "EN"} cal={cal} meId={state.me?.id ?? null} admin={state.admin}  editor={familyRole(session.cpifSubjectId) === "editor"} />;
}
