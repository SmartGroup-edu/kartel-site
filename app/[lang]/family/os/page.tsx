import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getReminders } from "@/app/lib/family-os";
import FamilyOs from "@/app/components/FamilyOs";

// Gated (proxy.ts covers /family/*); never prerendered, never indexed. Data comes from family-os.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Сегодня · Семья" : "Today · Family", robots: { index: false, follow: false } };
}

export default async function FamilyOsTodayPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const [state, reminders] = await Promise.all([getOsState(session), getReminders(session)]);
  return <FamilyOs lang={lang === "ru" ? "RU" : "EN"} view="today" state={state} reminders={reminders} />;
}
