import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, familyRole } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getCouncil, getSprint } from "@/app/lib/family-os";
import FamilyCouncil from "@/app/components/FamilyCouncil";

// Gated like every Family OS page; the service decides who reads and who writes.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Совет · Семья" : "Council · Family", robots: { index: false, follow: false } };
}

export default async function FamilyCouncilPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ date?: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const [state, council] = await Promise.all([getOsState(session), getCouncil(session, (await searchParams).date)]);
  if (state.status !== "ok" || (!state.me && !state.admin)) notFound();
  // The sprint is the council's own week (Mon–Sun ending on the council Sunday).
  const sprint = council && state.me ? await getSprint(session, council.date) : null;
  return <FamilyCouncil lang={lang === "ru" ? "RU" : "EN"} council={council} people={state.people} me={state.me} admin={state.admin} sprint={sprint} editor={familyRole(session.cpifSubjectId) === "editor"} />;
}
