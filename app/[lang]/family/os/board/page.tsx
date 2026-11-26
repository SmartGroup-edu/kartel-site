import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getBoard, getPlan, getTemplates } from "@/app/lib/family-os";
import FamilyBoard from "@/app/components/FamilyBoard";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";

// Gated like every Family OS page. The service decides what each member sees (family tasks only);
// the plan and templates are parents-only there too, so a member simply gets null for them.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Доска · Семья" : "Board · Family", robots: { index: false, follow: false } };
}

export default async function FamilyBoardPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ date?: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const [state, board] = await Promise.all([getOsState(session), getBoard(session, (await searchParams).date)]);
  const L = lang === "ru" ? "RU" : "EN";
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.board[L]} />;
  if (!state.me && !state.admin) notFound();
  const parent = Boolean(board?.can.approve);
  const [plan, templates] = parent ? await Promise.all([getPlan(session, board!.plan?.date), getTemplates(session)]) : [null, null];
  return <FamilyBoard lang={lang === "ru" ? "RU" : "EN"} initial={board} plan={plan} templates={templates} me={state.me} />;
}
