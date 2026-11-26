import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getCouncil, getSprint, getRecognitions, getKodeks, getBoard, getPlan } from "@/app/lib/family-os";
import { pendingDecisions, acceptedDecisions } from "@/app/lib/family-decisions.mjs";
import FamilyCouncil, { type PendingDecision, type AcceptedDecision } from "@/app/components/FamilyCouncil";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";
import { childHome } from "@/app/lib/family-child";

// Gated like every Family OS page; the service decides who reads and who writes.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Решения · Семейный кабинет" : "Decisions · Family area", robots: { index: false, follow: false } };
}

/**
 * «Решения» (bus 172 P3). «Ждут голоса» is the board's queue for parents (needs_decision + tomorrow's plan); «Принято»
 * is the council's decisions and the plan stamps. Reads: /me, /people, /my-tasks (shell), /council, and for an adult
 * member /board, /sprint, /recognitions, /kodeks — plus /plan only for a parent while the plan waits: at most 10.
 * A child never gets here (their menu is «Мой день» + «Календарь»).
 */
export default async function FamilyCouncilPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ date?: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const state = await getOsState(session);
  const L = lang === "ru" ? "RU" : "EN";
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.council[L]} />;
  if (!state.me && !state.admin) notFound();
  childHome(lang, state.me);
  const council = await getCouncil(session, (await searchParams).date);
  // The sprint is the council's own week (Mon–Sun ending on the council Sunday).
  // bus 86: the council's week (Mon–Sun ending on its Sunday) — its recognitions, as one list; principle texts for the pick.
  const [sprint, recs, kodeks, board] = council && state.me ? await Promise.all([getSprint(session, council.date), getRecognitions(session, council.agenda.from), getKodeks(session), getBoard(session)]) : [null, null, null, null];
  const p = board?.plan;
  const plan = board?.can.approve && p && p.ready && !p.approved && p.proposed > 0 ? await getPlan(session, p.date) : null;
  const parent = Boolean(board?.can.approve);
  const pending = state.me ? pendingDecisions({ board, plan, people: state.people, lang: L }) as PendingDecision[] | null : [];
  const accepted = acceptedDecisions({ board, council, people: state.people, lang: L }) as AcceptedDecision[];
  return <FamilyCouncil lang={L} council={council} people={state.people} me={state.me} sprint={sprint}
    recognitions={recs?.recognitions ?? null} principles={kodeks?.current?.body.principles ?? null} pending={pending} accepted={accepted} parent={parent} />;
}
