import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState } from "@/app/lib/family-os";
import FamilyOsAccess from "@/app/components/FamilyOsAccess";

// Admin only: people and guardian grants. Members get a 404 (the service also refuses their writes).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Доступы · Семья" : "Access · Family", robots: { index: false, follow: false } };
}

export default async function FamilyOsAccessPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const state = await getOsState(session);
  if (state.status !== "ok" || !state.admin) notFound();
  return <FamilyOsAccess lang={lang === "ru" ? "RU" : "EN"} people={state.people} grants={state.grants} />;
}
