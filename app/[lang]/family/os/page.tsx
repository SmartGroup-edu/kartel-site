import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getReminders, getMyRoutines, getMyBoard, getBoard, getPrinciple, getRecognitions, getKodeks, getCalendar } from "@/app/lib/family-os";
import { canRegister } from "@/app/lib/family-passkey-rules.mjs";
import FamilyOnboarding from "@/app/components/FamilyOnboarding";
import { todayModel, familyHour } from "@/app/lib/family-today.mjs";
import FamilyToday, { type TodayModel } from "@/app/components/FamilyToday";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { TodayDocs } from "@/app/components/FamilyOs";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";
import { greetingAt } from "@/app/lib/family-today.mjs";

// Gated (proxy.ts covers /family/*); never prerendered, never indexed. Data comes from family-os.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  // bus 172 P3 QA: a child's /os is «Мой день» (their menu and H1 say so). getOsState is the page's own read (cached
  // per request), so the title costs no extra Family OS call.
  let child = false;
  if (familyEnv.gateOn()) {
    const { decision, session } = await familyGateDecision();
    if (decision === "allow" && session) { const s = await getOsState(session); child = s.status === "ok" && s.me?.kind === "child"; }
  }
  const title = child ? (lang === "ru" ? "Мой день · Семья" : "My day · Family") : lang === "ru" ? "Сегодня · Семья" : "Today · Family";
  return { title, robots: { index: false, follow: false } };
}

const NOT_MEMBER = {
  EN: "You are signed in, but you are not in Family OS yet. Ask the family admin to add you.",
  RU: "Тебя ещё нет в разделе «Семья». Попроси администратора семьи добавить тебя.",
};

/**
 * «Сегодня» (bus 171). Built from what Family OS already returns — no new endpoint, no new query. A child gets no
 * family board at all (it is not fetched), and the model drops the adult blocks, so they never reach the browser.
 */
export default async function FamilyOsTodayPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const [state, reminders] = await Promise.all([getOsState(session), getReminders(session)]);
  const L = lang === "ru" ? "RU" : "EN";
  // QA-156 M7: one calm «не отвечает» on every OS page, never a 404.
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.today[L]} />;
  const now = new Date();
  const dateLine = ((d) => d.charAt(0).toUpperCase() + d.slice(1))(now.toLocaleDateString(L === "EN" ? "en-GB" : "ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }));
  if (!state.me && !state.admin) {
    // L6: the page keeps its H1 for someone who is signed in but not in Family OS yet
    return <OsDownLike title={OS_DOWN_TITLE.today[L]} line={NOT_MEMBER[L]} />;
  }
  const me = state.me;
  const child = me?.kind === "child";
  // bus 172 P4: the first-login tour, until Family OS says it is done (a service from before P4 says nothing: no tour).
  // It costs this render no Family OS call: `onboarded` comes with /me, the letter settings load in the browser.
  const onboarding = Boolean(me) && state.onboarded === false;
  const [family, routines, myBoard, board, calendar, principle, recognitions, kodeks] = await Promise.all([
    state.admin ? getReminders(session, "family") : Promise.resolve([]),
    me ? getMyRoutines(session, me.id) : Promise.resolve(null),
    me ? getMyBoard(session) : Promise.resolve(null),
    // The family board carries everyone's tasks and the parents' queue: adults only (bus 171 — enforced here).
    me && !child ? getBoard(session) : Promise.resolve(null),
    me ? getCalendar(session) : Promise.resolve(null),
    // bus 86: the principle of the week (a line for everyone) and Признание (send + this week's list)
    me ? getPrinciple(session) : Promise.resolve(null),
    me ? getRecognitions(session) : Promise.resolve(null),
    me ? getKodeks(session) : Promise.resolve(null),
  ]);
  const hour = familyHour(now);
  if (!me) {
    // The owner who is not a family member: the greeting and the family's document deadlines, as before.
    return (
      <div className="max-w-4xl pb-8">
        <h1 className="font-serif text-[24px] leading-tight min-[900px]:text-[30px]">{greetingAt(L, null, hour)}</h1>
        <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{dateLine}</p>
        {family.length > 0 && <TodayDocs lang={L} family items={family} people={state.people} />}
      </div>
    );
  }
  const model = todayModel({ lang: L, me, admin: state.admin, people: state.people, myBoard, routines, board, calendar, reminders, hour, today: now.toISOString().slice(0, 10) }) as TodayModel;
  const day = model.today;
  return (
    <>
    {onboarding && <FamilyOnboarding lang={L} me={{ id: me.id, name: L === "EN" ? me.name_en : me.name_ru, kind: me.kind }}
      passkeys={{ on: familyEnv.passkeysOn(), canAdd: canRegister(session) }} />}
    <FamilyToday lang={L} model={model} dateLine={dateLine} myBoard={myBoard} board={board} people={state.people} meId={me.id}
      principle={principle} recognitions={recognitions?.recognitions ?? null} principles={kodeks?.current?.body.principles ?? null}
      reminders={reminders} familyReminders={family} sunday={new Date(`${day}T12:00:00Z`).getUTCDay() === 0} />
    </>
  );
}

function OsDownLike({ title, line }: { title: string; line: string }) {
  return (
    <section aria-labelledby="os-outsider-h" className="max-w-4xl">
      <h1 id="os-outsider-h" className="font-serif text-[24px] leading-tight min-[900px]:text-[30px]">{title}</h1>
      <p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{line}</p>
    </section>
  );
}
