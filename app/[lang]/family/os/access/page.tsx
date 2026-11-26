import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { canRegister } from "@/app/lib/family-passkey-rules.mjs";
import { getOsState, getRules, getAdoption } from "@/app/lib/family-os";
import FamilyOsAccess from "@/app/components/FamilyOsAccess";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";

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
  // The edge already lets only the owner reach this page; with the service silent they get the calm state too.
  const L = lang === "ru" ? "RU" : "EN";
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.access[L]} />;
  if (!state.admin) notFound();
  const [rules, adoption] = await Promise.all([getRules(session), getAdoption(session)]);
  return <FamilyOsAccess lang={lang === "ru" ? "RU" : "EN"} people={state.people} grants={state.grants} rules={rules} adoption={adoption} ownKeys={familyEnv.passkeysOn() && !state.me ? { canAdd: canRegister(session) } : null} />;
}
