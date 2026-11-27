import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, guestMay } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getBoard, getSprint } from "@/app/lib/family-os";
import { reviewDays, nextMonday, weekReview } from "@/app/lib/family-week-review.mjs";
import FamilyWeekReview, { type WeekReview } from "@/app/components/FamilyWeekReview";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";
import { childHome } from "@/app/lib/family-child";

// Gated like every Family OS page; the service decides who reads and who writes.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Обзор недели · Семейный кабинет" : "Weekly review · Family area", robots: { index: false, follow: false } };
}

/**
 * «Обзор недели» (bus 172 P6). Done, slipped and waiting tasks from this week's boards (Monday to today, the same
 * GET /board?date= reads as the printable week), and «Фокус следующей недели» = next week's sprint goals (the service's
 * existing three-goal store, GET /sprint?week= · POST /sprint/goals). Reads: the edge /me, /me, /people, /my-tasks
 * (shell), today's /board, one /board per earlier day of the week (0–6) and /sprint: at most 12, on a Sunday.
 * Members only (the owner who is not one gets the family 404, like «Задачи»); a child is sent back to «Мой день».
 */
export default async function FamilyReviewPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  // bus 176 P4: a guest whose sections include «Обзор недели» reads it — the adults' tasks only (the service cuts the
  // boards); names come from the boards, since a guest has no /people.
  if (!session || !(decision === "allow" || (decision === "guest" && guestMay(session, "review")))) notFound();
  const L = lang === "ru" ? "RU" : "EN";
  const state = await getOsState(session);
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.review[L]} />;
  if (!state.me && !session.guest) notFound();
  childHome(lang, state.me);
  const todayBoard = await getBoard(session);
  if (!todayBoard) return <FamilyWeekReview lang={L} review={null} sprint={null} />;
  const today = todayBoard.today, days = reviewDays(today);
  const [sprint, ...past] = await Promise.all([getSprint(session, nextMonday(today)), ...days.slice(0, -1).map((d) => getBoard(session, d))]);
  const people = session.guest ? todayBoard.members.map(({ id, name_en, name_ru, kind }) => ({ id, name_en, name_ru, kind })) : state.people;
  const review = weekReview({ boards: [...past, todayBoard], days, today, people, lang: L }) as WeekReview;
  return <FamilyWeekReview lang={L} review={review} sprint={sprint} />;
}
