import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, familyRole } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getPrinciple, getSprint, getCouncil, getCalendar, getBoard, getRecognitions } from "@/app/lib/family-os";
import FamilyWeek from "@/app/components/FamilyWeek";
import { weekDays, weekTasks, weekBirthdays } from "@/app/lib/family-week.mjs";

// «Неделя семьи · PDF» (bus 84/97 item 5): one A4 sheet for the council and the fridge, printed by the browser
// («Сохранить как PDF»). Built only from what THIS viewer may already see. No documents, health, notes or
// routines. Recognitions are private to sender, recipient and the recipient's parents, so they join the sheet
// only when the viewer ticks «Добавить признания» (?rec=1) — the fridge is seen by everyone at home.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Неделя семьи · Семья" : "Family week · Family", robots: { index: false, follow: false } };
}

export default async function FamilyWeekPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ rec?: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const state = await getOsState(session);
  if (state.status !== "ok" || !state.me) notFound();
  const withRec = (await searchParams).rec === "1";
  const principle = await getPrinciple(session);
  const week = principle?.week_start ?? null;
  if (!week) notFound();
  const days = weekDays(week);
  const [sprint, council, calendar, recs, ...boards] = await Promise.all([
    getSprint(session, week), getCouncil(session), getCalendar(session), withRec ? getRecognitions(session, week) : Promise.resolve(null),
    ...days.map((d) => getBoard(session, d)),
  ]);
  return (
    <FamilyWeek
      lang={lang === "ru" ? "RU" : "EN"}
      admin={state.admin}
      editor={familyRole(session.cpifSubjectId) === "editor"}
      week={week}
      principle={principle}
      goals={sprint?.goals ?? []}
      perPerson={weekTasks(boards, state.people, days)}
      birthdays={weekBirthdays(calendar?.items ?? [], week)}
      council={council ? { date: council.date } : null}
      recognitions={withRec ? recs?.recognitions ?? [] : null}
    />
  );
}
