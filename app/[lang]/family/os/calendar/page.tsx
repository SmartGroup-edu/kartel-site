import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, guestMay } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getCalendar } from "@/app/lib/family-os";
import FamilyCalendar from "@/app/components/FamilyCalendar";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";

// Gated like every Family OS page; the service decides who reads and who writes.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Календарь · Семейный кабинет" : "Calendar · Family area", robots: { index: false, follow: false } };
}

export default async function FamilyCalendarPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ cal?: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  // bus 176 P4: a guest whose sections include «Календарь» reads it (council and family events; no birthdays, no writes).
  if (!session || !(decision === "allow" || (decision === "guest" && guestMay(session, "calendar")))) notFound();
  const [state, cal] = await Promise.all([getOsState(session), getCalendar(session)]);
  const L = lang === "ru" ? "RU" : "EN";
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.calendar[L]} />;
  if (!state.me && !state.admin && !session.guest) notFound();
  // ?cal=month opens the month view (the mockup's deep link); the week is the default.
  const view = (await searchParams).cal === "month" ? "month" : "week";
  return <FamilyCalendar lang={lang === "ru" ? "RU" : "EN"} cal={cal} meId={state.me?.id ?? null} initialView={view} child={state.me?.kind === "child"} />;
}
