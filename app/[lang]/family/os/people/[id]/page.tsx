import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getPersonPage } from "@/app/lib/family-os";
import FamilyOsPerson from "@/app/components/FamilyOsPerson";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Человек · Семья" : "Person · Family", robots: { index: false, follow: false } };
}

export default async function FamilyOsPersonPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const [state, page] = await Promise.all([getOsState(session), getPersonPage(session, id)]);
  if (state.status !== "ok" || !page) notFound();
  return <FamilyOsPerson lang={lang === "ru" ? "RU" : "EN"} state={state} profile={page.profile} documents={page.documents} />;
}
