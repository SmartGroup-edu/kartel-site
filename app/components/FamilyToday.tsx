"use client";

/**
 * «Сегодня» (bus 171, mockup v5): «Сводка дня» with a progress ring, the KPI cards, «Мои дела на сегодня» (a tick
 * completes the item through the existing routes, optimistically), «Расписание», «Ждут решения» and «Семья сегодня»,
 * then the blocks Today already had (new tasks, principle, recognition, health, documents, council).
 * Everything comes from the server model (app/lib/family-today.mjs). A child's model has no adult blocks at all.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CalendarDays, Cake, Scale } from "lucide-react";
import { summaryLine } from "../lib/family-today.mjs";
import { avatars as avatarsOf } from "../lib/family-avatars.mjs";
import { tx, typograph } from "../lib/typograph.mjs";
import { osSend, TodayBoard } from "./FamilyBoard";
import { TodayPrinciple, TodayRecognition } from "./FamilyKodeks";
import { TodayCouncil } from "./FamilyCouncil";
import { TodayDocs } from "./FamilyOs";
import FamilyHealth from "./FamilyHealth";
import type { OsMyBoard, OsBoard, OsPerson, OsPrinciple, OsRecognition, OsKodeksPrinciple, OsReminder } from "../lib/family-os";

type Lang = "EN" | "RU";
type Item = { key: string; type: "task" | "routine"; id: string; title: string; state?: string; kind?: string; done: boolean; checkable: boolean; nudge: boolean; time: string | null; slot: string | null; inProgress: boolean };
type Sched = { key: string; kind: "council" | "event" | "birthday"; time: string | null; title: string; age: number | null };
type Decision = { key: string; type: "task" | "plan"; title: string | null; who: string; why: "declined" | "not_accepted" | "plan"; date?: string; count?: number };
type FamilyRow = { id: string; name: string; open: number; done: number; total: number; current: string | null; routines: { done: number; total: number } | null; me: boolean };
type Kpi = { id: "open" | "decisions" | "events" | "documents"; value: number; new?: number };
export type TodayModel = {
  child: boolean; adult: boolean; owner: boolean; today: string; greeting: string; name?: string | null;
  items: Item[]; newTasks: number; paused: boolean; summary: { decisions: number | null };
  kpis: Kpi[]; schedule: Sched[] | null; decisions: Decision[] | null; family: FamilyRow[] | null;
};

const T = {
  RU: {
    brief: "Сводка дня", done: "сделано", toDecisions: "Разобрать решения", kpi: { open: "Открытых задач", decisions: "Ждут решения", events: "Событий на неделе", documents: "Документы скоро истекают" },
    kpiHint: { new: (n: number) => `${n} ${n === 1 ? "новая ждёт" : n < 5 ? "новые ждут" : "новых ждут"} тебя`, none: "новых нет", decisions: "в разделе «Решения»", events: "до воскресенья", documents: "в ближайшие 3 месяца" },
    mine: "Мои дела на сегодня", allTasks: "Все задачи", schedule: "Расписание", calendar: "Календарь", waiting: "Ждут решения", open: "Открыть",
    family: "Семья сегодня", people: "Люди", you: "ты",
    task: "задача", routine: "распорядок", chore: "дело", rotation: "по очереди", inProgress: "в работе", doneChip: "готово", parents: "решают родители",
    slot: { morning: "утром", after_school: "после школы", after_dinner: "после ужина", evening: "вечером" } as Record<string, string>, by: "до",
    check: (s: string) => `Отметить: ${s}`, error: "Не удалось сохранить — попробуй ещё раз.", stillDoing: "Ещё делаешь?", finish: "Готово", goOn: "Продолжаю",
    emptyMine: "На сегодня у тебя ничего не запланировано.", paused: "День без ритма — распорядок на сегодня на паузе.", addOwn: "Добавить распорядок на своей странице", childHint: "Распорядок и дела составляют родители.",
    emptySchedule: "Сегодня в календаре ничего нет.", noCalendar: "Календарь сейчас недоступен.", allDay: "весь день",
    council: "Семейный совет", birthday: (age: number | null) => (age ? `день рождения · ${age}` : "день рождения"), event: "событие",
    emptyDecisions: "Очередь пуста — решать нечего.", declined: "не может взяться", notAccepted: "не принято вовремя", plan: (n: number) => `План на завтра ждёт утверждения · ${n} ${n === 1 ? "задача" : n < 5 ? "задачи" : "задач"}`,
    emptyFamily: "На доске пока никого нет.", famLine: (o: number, d: number) => `${o} открыто · ${d} готово`, now: "сейчас", routineOf: (d: number, n: number) => `распорядок ${d} из ${n}`,
    eventsToday: (n: number) => `${n} ${n === 1 ? "событие" : n < 5 ? "события" : "событий"} сегодня`, decisionsChip: (n: number) => `${n} ${n === 1 ? "решение ждёт" : n < 5 ? "решения ждут" : "решений ждут"}`,
    noDecisionsChip: "Решений в очереди нет", progress: (d: number, n: number) => `Сделано ${d} из ${n}`,
    hi: (n: string | null) => (n ? `Привет, ${n}!` : "Привет!"), left: (n: number) => `у тебя ${n} ${n === 1 ? "дело" : n < 5 ? "дела" : "дел"}`, allDone: "всё сделано", nothing: "дел на сегодня нет",
    heroLabel: "Сегодня", heroOf: (d: number, n: number) => `${d} из ${n}`, heroLeft: (n: number) => `Ещё ${n} — и день закрыт.`, heroDone: "Все дела на сегодня сделаны. Молодец!", heroEmpty: "На сегодня дел нет.",
    myTasks: "Мои дела", myDay: "Мой день", tapHint: "Нажми на дело, когда сделаешь.", waitParents: "ждёт решения родителей",
  },
  EN: {
    brief: "Today at a glance", done: "done", toDecisions: "Review decisions", kpi: { open: "Open tasks", decisions: "Waiting for a decision", events: "Events this week", documents: "Documents expiring soon" },
    kpiHint: { new: (n: number) => `${n} new waiting for you`, none: "nothing new", decisions: "in Decisions", events: "until Sunday", documents: "within 3 months" },
    mine: "My things for today", allTasks: "All tasks", schedule: "Schedule", calendar: "Calendar", waiting: "Waiting for a decision", open: "Open",
    family: "Family today", people: "People", you: "you",
    task: "task", routine: "routine", chore: "chore", rotation: "in turns", inProgress: "in progress", doneChip: "done", parents: "parents decide",
    slot: { morning: "in the morning", after_school: "after school", after_dinner: "after dinner", evening: "in the evening" } as Record<string, string>, by: "by",
    check: (s: string) => `Tick off: ${s}`, error: "Could not save — please try again.", stillDoing: "Still on it?", finish: "Done", goOn: "Still going",
    emptyMine: "Nothing is planned for you today.", paused: "A day without rhythm — today's routine is paused.", addOwn: "Add a routine on your page", childHint: "Your parents set up your routines and chores.",
    emptySchedule: "Nothing in the calendar today.", noCalendar: "The calendar is not available right now.", allDay: "all day",
    council: "Family council", birthday: (age: number | null) => (age ? `birthday · ${age}` : "birthday"), event: "event",
    emptyDecisions: "The queue is empty — nothing to decide.", declined: "can't take it", notAccepted: "not accepted in time", plan: (n: number) => `Tomorrow's plan waits for approval · ${n} ${n === 1 ? "task" : "tasks"}`,
    emptyFamily: "No one is on the board yet.", famLine: (o: number, d: number) => `${o} open · ${d} done`, now: "now", routineOf: (d: number, n: number) => `routine ${d} of ${n}`,
    eventsToday: (n: number) => `${n} ${n === 1 ? "event" : "events"} today`, decisionsChip: (n: number) => `${n} ${n === 1 ? "decision waits" : "decisions wait"}`,
    noDecisionsChip: "No decisions waiting", progress: (d: number, n: number) => `${d} of ${n} done`,
    hi: (n: string | null) => (n ? `Hi, ${n}!` : "Hi!"), left: (n: number) => `${n} thing${n === 1 ? "" : "s"} to do`, allDone: "all done", nothing: "nothing to do today",
    heroLabel: "Today", heroOf: (d: number, n: number) => `${d} of ${n}`, heroLeft: (n: number) => `${n} more and the day is done.`, heroDone: "Everything for today is done. Well done!", heroEmpty: "Nothing to do today.",
    myTasks: "My things", myDay: "My day", tapHint: "Tap a thing when it is done.", waitParents: "waiting for your parents",
  },
};

const CARD = "rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] p-5 shadow-[var(--fos-shadow)]";
const CARD_H = "flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]";
const MORE = "ml-auto inline-flex min-h-11 items-center gap-1 rounded-md text-[14px] font-medium text-[var(--accent)] hover:underline hover:underline-offset-4";
const ROW = "flex items-center gap-3 border-t border-[var(--border)] px-1.5 py-2.5 first:border-t-0";
const EMPTY = "px-1.5 py-5 text-center text-[14px] text-[var(--muted)]";
const PILL = { g: "bg-[var(--ok-soft)] text-[var(--ok)]", a: "bg-[var(--warn-soft)] text-[var(--fos-amber)]", b: "bg-[var(--fos-blue-soft)] text-[var(--fos-blue)]" };
const pill = (tone: keyof typeof PILL) => `whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${PILL[tone]}`;

function Ring({ done, total, label, caption }: { done: number; total: number; label: string; caption: string }) {
  const C = 239, off = C - C * (total ? done / total : 0);
  return (
    <div className="relative h-[92px] w-[92px] flex-none max-[899px]:hidden" role="img" aria-label={label}>
      <svg width="92" height="92" className="-rotate-90" aria-hidden="true">
        <circle cx="46" cy="46" r="38" stroke="rgba(255,255,255,.15)" strokeWidth="8" fill="none" />
        <circle cx="46" cy="46" r="38" stroke="var(--fos-brief-ring)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} style={{ transition: "stroke-dashoffset .5s" }} />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-center">
        <span><span className="block text-[20px] font-bold leading-none">{done}/{total}</span><small className="mt-[3px] block text-[11px] font-medium text-[var(--fos-brief-text)]">{caption}</small></span>
      </span>
    </div>
  );
}

export default function FamilyToday({ lang, model, dateLine, myBoard, board, people, meId, principle, recognitions, principles, reminders, familyReminders, sunday }: {
  lang: Lang; model: TodayModel; dateLine: string; myBoard: OsMyBoard | null; board: OsBoard | null; people: OsPerson[]; meId: string | null;
  principle: OsPrinciple | null; recognitions: OsRecognition[] | null; principles: OsKodeksPrinciple[] | null; reminders: OsReminder[]; familyReminders: OsReminder[]; sunday: boolean;
}) {
  const t = tx(T, lang);
  const router = useRouter();
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os`;
  const ty = (s: string) => (lang === "RU" ? typograph(s) : s);
  // Optimistic ticks: key → done. The server's answer replaces them on the next refresh.
  const [over, setOver] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");
  const items = model.items.map((x) => (x.key in over ? { ...x, done: over[x.key] } : x));
  const done = items.filter((x) => x.done).length;
  const decisionsN = model.summary.decisions;

  const tick = async (x: Item) => {
    const next = !x.done;
    setErr(""); setOver((o) => ({ ...o, [x.key]: next }));
    const r = x.type === "task"
      ? await osSend("POST", `tasks/${x.id}/done`)
      : await osSend("POST", `${x.kind === "rotation" ? "rotations" : "routines"}/${x.id}/check`, { date: model.today, done: next });
    if (!r?.ok) { setOver((o) => { const n = { ...o }; delete n[x.key]; return n; }); setErr(t.error); return; }
    if (x.type === "task") router.refresh();
  };
  const answer = async (x: Item, action: "done" | "continue") => {
    const r = await osSend("POST", `tasks/${x.id}/${action}`);
    if (r?.ok) router.refresh(); else setErr(t.error);
  };
  // A task has a deadline («до 18:00»); a routine has a time of day («07:30»).
  const when = (x: Item) => (x.time ? (x.type === "task" ? `${t.by} ${x.time}` : x.time) : x.slot ? t.slot[x.slot] ?? "" : "");
  const typeLabel = (x: Item) => (x.type === "task" ? t.task : x.kind === "rotation" ? t.rotation : x.kind === "chore" ? t.chore : t.routine);
  const av = model.family ? avatarsOf(model.family.map((f) => ({ id: f.id, name: f.name }))) as Map<string, { text: string; bg: string }> : null;
  const eventsToday = model.schedule?.length ?? 0;

  // bus 172 P3: a child's «Мой день» (ChildDay, below). The model already holds no adult block for a child.
  if (model.child) return <ChildDay t={t} lang={lang} model={model} items={items} done={done} tick={tick} answer={answer} err={err} when={when} dateLine={dateLine}
    myBoard={myBoard} people={people} meId={meId} principle={principle} recognitions={recognitions} principles={principles} reminders={reminders} />;

  return (
    <div data-today="" className="pb-8">
      <header className="mb-6">
        <h1 id="today-h" className="font-serif text-[24px] leading-tight min-[900px]:text-[30px]">{model.greeting}</h1>
        <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{dateLine}</p>
      </header>

      <section aria-labelledby="brief-h" data-brief="" className="grid items-center gap-6 rounded-[var(--fos-radius)] bg-[radial-gradient(120%_140%_at_0%_0%,var(--fos-brief-from)_0%,var(--fos-brief-to)_100%)] px-5 py-5 text-white shadow-[var(--fos-shadow)] min-[900px]:grid-cols-[auto_1fr_auto] min-[900px]:px-7 min-[900px]:py-6 [:root.hc_&]:border [:root.hc_&]:border-[var(--border)] [:root.hc_&]:text-[var(--foreground)]">
        <Ring done={done} total={items.length} label={t.progress(done, items.length)} caption={t.done} />
        <div>
          <h2 id="brief-h" className="font-serif text-[20px] min-[900px]:text-[24px]">{t.brief}</h2>
          <p data-summary="" aria-live="polite" className="mt-1.5 max-w-[560px] text-[15px] text-[var(--fos-brief-text)]">{summaryLine(lang, items, decisionsN)}</p>
          <ul className="mt-3.5 flex flex-wrap gap-2 text-[13px]">
            <li className="min-[900px]:hidden rounded-full border border-white/20 bg-white/10 px-3 py-1">{t.progress(done, items.length)}</li>
            {model.schedule && <li className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />{t.eventsToday(eventsToday)}</li>}
            {decisionsN !== null && <li className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1"><Scale aria-hidden="true" className="h-3.5 w-3.5" />{decisionsN ? t.decisionsChip(decisionsN) : t.noDecisionsChip}</li>}
          </ul>
        </div>
        {decisionsN ? <Link prefetch={false} href={`${base}/council`} className="inline-flex min-h-11 items-center justify-center gap-1.5 justify-self-start rounded-[10px] bg-[var(--fos-accent-2)] px-4 text-[14px] font-semibold text-[var(--fos-on-accent-2)] hover:opacity-90">{t.toDecisions}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link> : null}
      </section>

      {model.kpis.length > 0 && (
        <ul data-kpis="" className={`mt-[18px] grid grid-cols-2 gap-3 max-[899px]:[&>li:last-child:nth-child(odd)]:col-span-2 min-[900px]:gap-[18px] ${model.kpis.length >= 4 ? "min-[900px]:grid-cols-4" : "min-[900px]:grid-cols-3"}`}>
          {model.kpis.map((k) => (
            <li key={k.id} data-kpi={k.id} className={CARD}>
              <p className="text-[13px] text-[var(--muted)]">{t.kpi[k.id]}</p>
              <p className="my-1 text-[30px] font-bold leading-tight tracking-[-0.02em]">{k.value}</p>
              <p className={`text-[12px] ${k.id === "documents" ? "text-[var(--destructive)]" : k.id === "decisions" && k.value > 0 ? "text-[var(--fos-amber)]" : "text-[var(--muted)]"}`}>
                {k.id === "open" ? (k.new ? t.kpiHint.new(k.new) : t.kpiHint.none) : t.kpiHint[k.id]}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-[18px] grid gap-[18px] min-[900px]:grid-cols-[1.7fr_1fr]">
        <section aria-labelledby="mine-h" data-my-day="" className={CARD}>
          <div className="mb-2 flex items-center"><h2 id="mine-h" className={CARD_H}>{t.mine}</h2>{model.adult || model.child ? <Link prefetch={false} href={`${base}/board`} className={MORE}>{t.allTasks}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link> : null}</div>
          {model.paused && <p className="mb-2 rounded-[10px] border border-dashed border-[var(--border)] px-3 py-2 text-[14px] text-[var(--text-secondary)]">{t.paused}</p>}
          {items.length === 0 ? (
            <div className={EMPTY}>
              <p>{t.emptyMine}</p>
              {model.child ? <p className="mt-1">{t.childHint}</p> : meId ? <Link prefetch={false} href={`${base}/people/${meId}#routines-h`} className="mt-1 inline-flex min-h-11 items-center text-[var(--accent)] underline underline-offset-4">{t.addOwn}</Link> : null}
            </div>
          ) : (
            <ul>
              {items.map((x) => (
                <li key={x.key} data-item={x.type} data-done={x.done ? "1" : "0"} className={ROW}>
                  <button type="button" role="checkbox" aria-checked={x.done} aria-label={t.check(x.title)} disabled={!x.checkable || (x.type === "task" && x.done)} onClick={() => tick(x)}
                    className="grid h-11 w-11 flex-none place-items-center rounded-[10px] disabled:cursor-default">
                    <span aria-hidden="true" className={`grid h-[21px] w-[21px] place-items-center rounded-[7px] border-2 transition-colors ${x.done ? "border-[var(--ok)] bg-[var(--ok)] text-[var(--fos-on-ok)]" : "border-[var(--fos-control)]"}`}>
                      {x.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-medium ${x.done ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>{ty(x.title)}</p>
                    <p className="text-[13px] text-[var(--muted)]">{[typeLabel(x), when(x)].filter(Boolean).join(" · ")}</p>
                    {x.nudge && (
                      <div data-nudge="" className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="text-[var(--text-secondary)]">{t.stillDoing}</span>
                        <button type="button" onClick={() => answer(x, "done")} className="min-h-9 rounded-[10px] bg-[var(--fos-primary)] px-3 font-semibold text-[var(--fos-on-primary)]">{t.finish}</button>
                        <button type="button" onClick={() => answer(x, "continue")} className="min-h-9 rounded-[10px] border border-[var(--border)] bg-[var(--fos-panel)] px-3 font-semibold">{t.goOn}</button>
                      </div>
                    )}
                  </div>
                  {x.done ? <span className={pill("g")}>{t.doneChip}</span> : x.state === "declined" ? <span className={pill("a")}>{t.parents}</span> : x.inProgress ? <span className={pill("b")}>{t.inProgress}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <p role="status" aria-live="polite" className="text-[13px] text-[var(--destructive)]">{err}</p>
        </section>

        <section aria-labelledby="sched-h" data-schedule="" className={CARD}>
          <div className="mb-2 flex items-center"><h2 id="sched-h" className={CARD_H}>{t.schedule}</h2>{model.schedule && <Link prefetch={false} href={`${base}/calendar`} className={MORE}>{t.calendar}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>}</div>
          {!model.schedule ? <p className={EMPTY}>{t.noCalendar}</p> : model.schedule.length === 0 ? <p className={EMPTY}>{t.emptySchedule}</p> : (
            <ul>
              {model.schedule.map((e) => (
                <li key={e.key} data-event={e.kind} className={ROW}>
                  <span className="w-[68px] flex-none whitespace-nowrap text-[14px] font-semibold">{e.time ?? <span className="text-[12px] font-medium text-[var(--muted)]">{t.allDay}</span>}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{e.kind === "council" ? t.council : ty(e.title)}</p>
                    <p className="text-[13px] text-[var(--muted)]">{e.kind === "birthday" ? t.birthday(e.age) : e.kind === "council" ? "" : t.event}</p>
                  </div>
                  {e.kind === "birthday" && <Cake aria-hidden="true" className="h-4 w-4 text-[var(--fos-plum)]" />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {myBoard && myBoard.new.length > 0 && <TodayBoard lang={lang} data={myBoard} board={board} people={people} me={meId ? { id: meId, kind: model.child ? "child" : "adult" } : null} only="new" />}

      {model.adult && (
        <div className="mt-[18px] grid gap-[18px] min-[900px]:grid-cols-2">
          <section aria-labelledby="dec-h" data-decisions="" className={CARD}>
            <div className="mb-2 flex items-center"><h2 id="dec-h" className={CARD_H}>{t.waiting}</h2><Link prefetch={false} href={`${base}/council`} className={MORE}>{t.open}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link></div>
            {!model.decisions || model.decisions.length === 0 ? <p className={EMPTY}>{t.emptyDecisions}</p> : (
              <ul>
                {model.decisions.slice(0, 5).map((d) => (
                  <li key={d.key} data-decision={d.why} className={ROW}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{d.type === "plan" ? t.plan(d.count ?? 0) : ty(d.title ?? "")}</p>
                      {d.type === "task" && <p className="text-[13px] text-[var(--muted)]">{[d.who, d.why === "declined" ? t.declined : t.notAccepted].filter(Boolean).join(" · ")}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="fam-h" data-family-today="" className={CARD}>
            <div className="mb-2 flex items-center"><h2 id="fam-h" className={CARD_H}>{t.family}</h2><Link prefetch={false} href={`${base}/people`} className={MORE}>{t.people}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link></div>
            {!model.family || model.family.length === 0 ? <p className={EMPTY}>{t.emptyFamily}</p> : (
              <ul>
                {model.family.map((f) => (
                  <li key={f.id} data-member="" className={ROW}>
                    <span aria-hidden="true" style={{ background: av?.get(f.id)?.bg }} className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[12px] font-semibold text-white">{av?.get(f.id)?.text}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{f.name}{f.me && <span className="ml-1.5 text-[13px] font-normal text-[var(--muted)]">({t.you})</span>}</p>
                      <p className="truncate text-[13px] text-[var(--muted)]">{[t.famLine(f.open, f.done), f.routines && f.routines.total ? t.routineOf(f.routines.done, f.routines.total) : "", f.current ? `${t.now}: ${ty(f.current)}` : ""].filter(Boolean).join(" · ")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <div data-today-more="" className="max-w-4xl">
        {principle && <TodayPrinciple lang={lang} principle={principle} />}
        {meId && principles && recognitions && <TodayRecognition lang={lang} people={people} meId={meId} principles={principles} current={principle?.index ?? 0} items={recognitions} />}
        {meId && <FamilyHealth lang={lang} />}
        {reminders.length > 0 && <TodayDocs lang={lang} items={reminders} people={people} />}
        {familyReminders.length > 0 && <TodayDocs lang={lang} family items={familyReminders} people={people} />}
        {meId && <TodayCouncil lang={lang} tasks={[]} sunday={sunday} />}
      </div>
    </div>
  );
}

/**
 * bus 172 P3: a child's «Мой день» — big task cards (the tick is the same «Готово» / routine check as «Сегодня»),
 * today's schedule and the day's progress. No star counter: Family OS keeps no stars or points for anyone, so none is
 * shown. New tasks are accepted (or «Не могу») here, as on «Сегодня».
 */
function ChildDay({ t, lang, model, items, done, tick, answer, err, when, dateLine, myBoard, people, meId, principle, recognitions, principles, reminders }: {
  t: (typeof T)[Lang]; lang: Lang; model: TodayModel; items: Item[]; done: number; tick: (x: Item) => void; answer: (x: Item, a: "done" | "continue") => void; err: string;
  when: (x: Item) => string; dateLine: string; myBoard: OsMyBoard | null; people: OsPerson[]; meId: string | null;
  principle: OsPrinciple | null; recognitions: OsRecognition[] | null; principles: OsKodeksPrinciple[] | null; reminders: OsReminder[];
}) {
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os`;
  const ty = (s: string) => (lang === "RU" ? typograph(s) : s);
  const left = items.length - done;
  return (
    <div data-today="" data-child-day="" className="pb-8">
      <header className="mb-6">
        <h1 id="today-h" className="font-serif text-[24px] leading-tight min-[900px]:text-[30px]">{t.hi(model.name ?? null)}</h1>
        <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{dateLine} · {items.length === 0 ? t.nothing : left ? t.left(left) : t.allDone}</p>
      </header>
      <section aria-labelledby="kid-hero-h" data-kid-hero="" className="rounded-[22px] bg-[linear-gradient(135deg,#3b5fc4,#6a42c9_60%,#a8467f)] px-5 py-5 text-white shadow-[0_16px_40px_rgba(90,70,200,.28)] min-[900px]:px-7 min-[900px]:py-6 [:root.hc_&]:border [:root.hc_&]:border-[var(--border)] [:root.hc_&]:bg-none [:root.hc_&]:text-[var(--foreground)]">
        <h2 id="kid-hero-h" className="text-[14px] font-medium">{t.heroLabel}</h2>
        <p className="mt-1 text-[30px] font-bold leading-tight">{t.heroOf(done, items.length)}</p>
        <div aria-hidden="true" className="mt-2 h-2.5 max-w-md overflow-hidden rounded-full bg-white/25"><i className="block h-full rounded-full bg-white" style={{ width: `${items.length ? Math.round((done / items.length) * 100) : 0}%` }} /></div>
        <p aria-live="polite" className="mt-2 text-[14px]">{items.length === 0 ? t.heroEmpty : left ? t.heroLeft(left) : t.heroDone}</p>
      </section>

      {myBoard && myBoard.new.length > 0 && <TodayBoard lang={lang} data={myBoard} board={null} people={people} me={meId ? { id: meId, kind: "child" } : null} only="new" />}

      <div className="mt-[18px] grid gap-[18px] min-[900px]:grid-cols-2">
        <section aria-labelledby="kid-tasks-h" data-my-day="" className={CARD}>
          <h2 id="kid-tasks-h" className={CARD_H}>{t.myTasks}</h2>
          {model.paused && <p className="mt-2 rounded-[10px] border border-dashed border-[var(--border)] px-3 py-2 text-[14px] text-[var(--text-secondary)]">{t.paused}</p>}
          {items.length === 0 ? <div className={EMPTY}><p>{t.emptyMine}</p><p className="mt-1">{t.childHint}</p></div> : (
            <>
              <p className="mb-3 mt-0.5 text-[13px] text-[var(--muted)]">{t.tapHint}</p>
              <ul className="grid gap-2.5">
                {items.map((x) => (
                  <li key={x.key} data-item={x.type} data-done={x.done ? "1" : "0"}>
                    <button type="button" role="checkbox" aria-checked={x.done} aria-label={t.check(x.title)} disabled={!x.checkable || (x.type === "task" && x.done)} onClick={() => tick(x)} data-kid-task=""
                      className={`flex min-h-14 w-full items-center gap-3.5 rounded-2xl border-2 px-3.5 py-3 text-left text-[16px] font-semibold transition-colors disabled:cursor-default ${x.done ? "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--muted)] line-through" : "border-[var(--border)] bg-[var(--fos-panel)] text-[var(--foreground)] enabled:hover:border-[var(--fos-blue)]"}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block">{ty(x.title)}</span>
                        {(when(x) || x.state === "declined" || x.inProgress) && <span className="mt-0.5 block text-[13px] font-normal text-[var(--muted)] no-underline">{[when(x), x.state === "declined" ? t.waitParents : x.inProgress ? t.inProgress : ""].filter(Boolean).join(" · ")}</span>}
                      </span>
                      <span aria-hidden="true" className={`grid h-8 w-8 flex-none place-items-center rounded-full border-2 ${x.done ? "border-[var(--ok)] bg-[var(--ok)] text-[var(--fos-on-ok)]" : "border-[var(--fos-control)]"}`}>
                        {x.done && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                      </span>
                    </button>
                    {x.nudge && (
                      <div data-nudge="" className="mt-1.5 flex flex-wrap items-center gap-2 px-1 text-[13px]">
                        <span className="text-[var(--text-secondary)]">{t.stillDoing}</span>
                        <button type="button" onClick={() => answer(x, "done")} className="min-h-11 rounded-[10px] bg-[var(--fos-primary)] px-3 font-semibold text-[var(--fos-on-primary)]">{t.finish}</button>
                        <button type="button" onClick={() => answer(x, "continue")} className="min-h-11 rounded-[10px] border border-[var(--border)] bg-[var(--fos-panel)] px-3 font-semibold">{t.goOn}</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p role="status" aria-live="polite" className="text-[13px] text-[var(--destructive)]">{err}</p>
        </section>

        <section aria-labelledby="kid-day-h" data-schedule="" className={CARD}>
          <div className="mb-2 flex items-center"><h2 id="kid-day-h" className={CARD_H}>{t.myDay}</h2>{model.schedule && <Link prefetch={false} href={`${base}/calendar`} className={MORE}>{t.calendar}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>}</div>
          {!model.schedule ? <p className={EMPTY}>{t.noCalendar}</p> : model.schedule.length === 0 ? <p className={EMPTY}>{t.emptySchedule}</p> : (
            <ul>
              {model.schedule.map((e) => (
                <li key={e.key} data-event={e.kind} className={ROW}>
                  <span className="w-[56px] flex-none whitespace-nowrap text-[15px] font-bold">{e.time ?? <span className="text-[12px] font-medium text-[var(--muted)]">{t.allDay}</span>}</span>
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{e.kind === "council" ? t.council : e.kind === "birthday" ? `${ty(e.title)} — ${t.birthday(e.age)}` : ty(e.title)}</p>
                  {e.kind === "birthday" && <Cake aria-hidden="true" className="h-4 w-4 text-[var(--fos-plum)]" />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div data-today-more="" className="max-w-4xl">
        {principle && <TodayPrinciple lang={lang} principle={principle} link={false} />}
        {meId && principles && recognitions && <TodayRecognition lang={lang} people={people} meId={meId} principles={principles} current={principle?.index ?? 0} items={recognitions} councilLink={false} />}
        {meId && <FamilyHealth lang={lang} />}
        {reminders.length > 0 && <TodayDocs lang={lang} items={reminders} people={people} />}
      </div>
    </div>
  );
}
