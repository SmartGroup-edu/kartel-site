import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState } from "@/app/lib/family-os";
import FamilyOs from "@/app/components/FamilyOs";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";

// Gated (proxy.ts covers /family/*); never prerendered, never indexed. Data comes from family-os.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Люди · Семья" : "People · Family", robots: { index: false, follow: false } };
}

export default async function FamilyOsPeoplePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const L = lang === "ru" ? "RU" : "EN";
  const state = await getOsState(session);
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.people[L]} />;
  return <FamilyOs lang={L} state={state} />;
}
