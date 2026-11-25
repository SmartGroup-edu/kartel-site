import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, familyRole } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getReminders, getMyRoutines, getMyBoard, getBoard, getPrinciple, getRecognitions, getKodeks } from "@/app/lib/family-os";
import FamilyOs from "@/app/components/FamilyOs";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { osDownNav, OS_DOWN_TITLE } from "@/app/lib/family-os-down";

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
  const L = lang === "ru" ? "RU" : "EN";
  // QA-156 M7: one calm «не отвечает» on every OS page, never a 404.
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.today[L]} nav={osDownNav(session.cpifSubjectId)} />;
  const [family, mine, tasks, myBoard, board, principle, recognitions, kodeks] = await Promise.all([
    state.admin ? getReminders(session, "family") : Promise.resolve([]),
    state.me ? getMyRoutines(session, state.me.id) : Promise.resolve(null),
    Promise.resolve([]), // council decisions are tasks now (bus 85): they come with «Мои задачи»
    state.me ? getMyBoard(session) : Promise.resolve(null),
    state.me ? getBoard(session) : Promise.resolve(null),
    // bus 86: the principle of the week (a line for everyone) and Признание (send + this week's list)
    state.me ? getPrinciple(session) : Promise.resolve(null),
    state.me ? getRecognitions(session) : Promise.resolve(null),
    state.me ? getKodeks(session) : Promise.resolve(null),
  ]);
  return <FamilyOs lang={L} view="today" state={state} reminders={reminders} familyReminders={family} mine={mine} tasks={tasks} myBoard={myBoard} board={board}
    principle={principle} recognitions={recognitions?.recognitions ?? null} principles={kodeks?.current?.body.principles ?? null} editor={familyRole(session.cpifSubjectId) === "editor"} />;
}
