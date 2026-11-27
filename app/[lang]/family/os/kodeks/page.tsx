import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, guestMay } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getKodeks, getPrinciple } from "@/app/lib/family-os";
import FamilyKodeks from "@/app/components/FamilyKodeks";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";
import { childHome } from "@/app/lib/family-child";

// Кодекс семьи (bus 86): gated like every Family OS page; members read, parents add versions (the service decides).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Кодекс · Семейный кабинет" : "Code · Family area", robots: { index: false, follow: false } };
}

export default async function FamilyKodeksPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  // bus 176 P4: a guest whose sections include «Документы и правила» reads the Кодекс (no names in its history, no edit).
  if (!session || !(decision === "allow" || (decision === "guest" && guestMay(session, "kodeks")))) notFound();
  const state = await getOsState(session);
  const L = lang === "ru" ? "RU" : "EN";
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.kodeks[L]} />;
  if (!state.me && !session.guest) notFound();
  childHome(lang, state.me);
  const [kodeks, principle] = await Promise.all([getKodeks(session), getPrinciple(session)]);
  return <FamilyKodeks lang={lang === "ru" ? "RU" : "EN"} kodeks={kodeks} principle={principle} />;
}
