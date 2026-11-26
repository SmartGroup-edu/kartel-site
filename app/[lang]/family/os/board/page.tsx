import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getBoard, getPlan, getTemplates } from "@/app/lib/family-os";
import FamilyBoard from "@/app/components/FamilyBoard";
import { childBoardView } from "@/app/lib/family-kanban.mjs";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";
import { childHome } from "@/app/lib/family-child";

// Gated like every Family OS page. The service decides what each member sees (family tasks only);
// the plan and templates are parents-only there too, so a member simply gets null for them.
// bus 172 P2: a child sees only their own tasks — cut here, on the server, before anything reaches the browser.
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
  // bus 172 P3: who is asking first — a child is sent to «Мой день» before the family board is even asked for.
  const state = await getOsState(session);
  const L = lang === "ru" ? "RU" : "EN";
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.board[L]} />;
  if (!state.me && !state.admin) notFound();
  childHome(lang, state.me);
  const read = await getBoard(session, (await searchParams).date);
  // the P2 cut stays as a second wall (the proxy keeps it too)
  const board = state.me?.kind === "child" && read ? childBoardView(read, state.me.id) : read;
  const parent = Boolean(board?.can.approve);
  const [plan, templates] = parent ? await Promise.all([getPlan(session, board!.plan?.date), getTemplates(session)]) : [null, null];
  return <FamilyBoard lang={lang === "ru" ? "RU" : "EN"} initial={board} plan={plan} templates={templates} me={state.me} />;
}
