"use client";

/**
 * «Семейная доска» (Stage 3c, bus 82). Family tasks only: routines, goals, health and school never
 * reach this page (the service never sends them). The day: plan (20:30) → a parent approves → the
 * assignee accepts → in progress → done → (optional) reviewed. Live: re-read every 30 s while the tab
 * is visible; the «Кто чем занят» strip is aria-live="polite". On a phone the swimlanes fold into one
 * accordion per person (self open). Sprint progress is family totals only — no ranking, no comparison.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FamilySubNav from "./FamilySubNav";
import Disclosure from "./Disclosure";
import { familyNav } from "../content/siteNav";
import { FAMILY_MAIN, FAMILY_HEADER_MAX } from "../lib/family-nav.mjs";
import { fmtWeekRange } from "../lib/family-docs.mjs";
import { useLangToggle } from "./useLang";
import { H1, H2, META } from "../lib/typeScale";
import type { OsBoard, OsBoardMember, OsBoardTask, OsPlan, OsTemplate, OsSprint, OsSprintGoal, OsMyBoard } from "../lib/family-os";

type Lang = "EN" | "RU";
const T = {
  RU: {
    title: "Семейная доска", updated: "обновлено", today: "Семейные задачи сегодня", of: "из", ready: "готово",
    legend: { done: "Готово", in_progress: "В работе", accepted: "Принято", waiting: "Ждёт принятия" },
    strip: "Кто чем занят", since: "с", nothing: "Сейчас ничего", waitingN: (n: number) => `Ждёт принятия: ${n}`, doneOf: (d: number, n: number) => `готово ${d} из ${n}`, noTasks: "Задач сегодня нет",
    who: "Кто", parent: "родитель", adult: "взрослый", child: "ребёнок", empty: "—",
    tag: { sprint: "Спринт", rotation: "Очередь" }, cant: "Не могу", decide: "решают родители", reviewed: "Проверено", needsReview: "с проверкой", newT: "новая", by: "до",
    act: { accept: "Принимаю", start: "Начал", done: "Готово", review: "Проверено", rework: "Ещё немного" },
    reworkNote: "Что доделать", send: "Отправить", error: "Не удалось сохранить — попробуй ещё раз.",
    pauseQ: (x: string) => `Сейчас в работе: «${x}». Поставить её на паузу и начать эту?`, pauseYes: "Да, на паузу", cancel: "Отмена",
    decision: "Нужно решение", decisionNone: "Решать нечего.", reassign: "Передать", toTomorrow: "На завтра", cancelTask: "Отменить", reason: "Причина",
    carry: "Перенести на завтра?", carryHint: "Незакрытые дела сегодня. Детям ничего не подсвечивается.", carryAll: "Перенести все",
    plan: "План на завтра", planHint: "Собрано из шаблонов, очереди дел, спринта и перенесённого. Утверди до 21:00 — утром каждый увидит свои задачи.",
    planBuild: "Собрать план", planEmpty: "Пока нечего утверждать.", approveN: (n: number) => `Утвердить ${n} ${n === 1 ? "задачу" : n < 5 && n > 1 ? "задачи" : "задач"}`,
    planDone: "План на завтра утверждён.", planAuto: "План утверждён автоматически в 07:00 — только шаблоны.", addTask: "+ Добавить задачу", what: "Что сделать", whoDoes: "Кто", time: "Время", add: "Добавить", include: "Включить в план",
    planNote: "Распорядок (зубы, портфель, чтение) не требует утверждения — он идёт каждый день сам.", carried: "перенесено",
    sprint: "Спринт недели", sprintHint: "подводим итоги на совете в воскресенье в 19:00", sprintNone: "Целей на эту неделю пока нет.", sprintNote: "Прогресс — только по семье. Без рейтингов и без сравнения детей.", toCouncil: "Открыть совет",
    templates: "Шаблоны плана", tplHint: "Из них в 20:30 собирается план на завтра. Черновики не попадают в план, пока родитель не нажмёт «Утвердить шаблоны».",
    tplDraft: "черновик", tplActive: "в плане", tplApprove: (n: number) => `Утвердить шаблоны (${n})`, tplAdd: "Добавить шаблон", days: "Дни", rotation: "По очереди (2+ человека)", review: "С проверкой родителя",
    dayNames: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], everyDay: "каждый день", saved: "Сохранено.",
    notMember: "Доску видят члены семьи.", lanesAria: "Задачи по людям", col: "Колонка",
  },
  EN: {
    title: "Family board", updated: "updated", today: "Family tasks today", of: "of", ready: "done",
    legend: { done: "Done", in_progress: "In progress", accepted: "Accepted", waiting: "Waiting" },
    strip: "Who is doing what", since: "since", nothing: "Nothing right now", waitingN: (n: number) => `Waiting to accept: ${n}`, doneOf: (d: number, n: number) => `${d} of ${n} done`, noTasks: "No tasks today",
    who: "Who", parent: "parent", adult: "adult", child: "child", empty: "—",
    tag: { sprint: "Sprint", rotation: "Rota" }, cant: "Can't", decide: "parents decide", reviewed: "Checked", needsReview: "to check", newT: "new", by: "by",
    act: { accept: "Accept", start: "Start", done: "Done", review: "Checked", rework: "A bit more" },
    reworkNote: "What is left", send: "Send", error: "Could not save — please try again.",
    pauseQ: (x: string) => `In progress now: “${x}”. Pause it and start this one?`, pauseYes: "Yes, pause it", cancel: "Cancel",
    decision: "Needs a decision", decisionNone: "Nothing to decide.", reassign: "Hand over", toTomorrow: "Tomorrow", cancelTask: "Cancel task", reason: "Reason",
    carry: "Move to tomorrow?", carryHint: "Tasks still open today. Nothing turns red for children.", carryAll: "Move all",
    plan: "Plan for tomorrow", planHint: "Built from templates, the rota, the sprint and carried-over tasks. Approve by 21:00 — in the morning everyone sees their tasks.",
    planBuild: "Build the plan", planEmpty: "Nothing to approve yet.", approveN: (n: number) => `Approve ${n} task${n === 1 ? "" : "s"}`,
    planDone: "Tomorrow's plan is approved.", planAuto: "Approved automatically at 07:00 — templates only.", addTask: "+ Add a task", what: "What to do", whoDoes: "Who", time: "Time", add: "Add", include: "Include in the plan",
    planNote: "Routines (teeth, school bag, reading) need no approval — they run every day by themselves.", carried: "carried over",
    sprint: "Sprint of the week", sprintHint: "reviewed at the council on Sunday at 19:00", sprintNone: "No goals for this week yet.", sprintNote: "Progress is for the family only. No rankings, no comparing children.", toCouncil: "Open the council",
    templates: "Plan templates", tplHint: "Tomorrow's plan is built from these at 20:30. Drafts stay out of the plan until a parent presses “Approve templates”.",
    tplDraft: "draft", tplActive: "in the plan", tplApprove: (n: number) => `Approve templates (${n})`, tplAdd: "Add a template", days: "Days", rotation: "Take turns (2+ people)", review: "A parent checks it",
    dayNames: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], everyDay: "every day", saved: "Saved.",
    notMember: "The board is for family members.", lanesAria: "Tasks by person", col: "Column",
  },
} as const;
type Dict = (typeof T)[Lang];
const COLS = ["waiting", "accepted", "in_progress", "done"] as const;
type Col = (typeof COLS)[number];
const colOf = (s: OsBoardTask["state"]): Col | null => (s === "approved" || s === "declined" ? "waiting" : s === "accepted" ? "accepted" : s === "in_progress" ? "in_progress" : s === "done" || s === "reviewed" ? "done" : null);

const field = "mt-1 block min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]";
const primary = "inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]";
const panel = "rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-4";

export const osSend = (method: "POST" | "PUT" | "PATCH", path: string, body: unknown = {}) =>
  fetch(`/api/family-os/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null);
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "");
const longDate = (d: string, lang: Lang) => { const s = new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); return s.charAt(0).toUpperCase() + s.slice(1); };
const initials = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const nameOfM = (m: { name_en: string; name_ru: string }, lang: Lang) => (lang === "EN" ? m.name_en : m.name_ru);
const maskText = (mask: string, t: Dict) => (mask === "1111111" ? t.everyDay : t.dayNames.filter((_, i) => mask[i] === "1").join(", "));

/** The small tag before a title: sprint (blue) or rota (green). Plain chores carry none. */
function Tag({ task, t }: { task: { kind: string }; t: Dict }) {
  if (task.kind === "sprint") return <span className="mr-1.5 inline-block rounded-md bg-[var(--sprint-soft)] px-1.5 py-0.5 align-[1px] text-[14px] font-semibold leading-none text-[var(--sprint)]">{t.tag.sprint}</span>;
  if (task.kind === "rotation") return <span className="mr-1.5 inline-block rounded-md bg-[var(--ok-soft)] px-1.5 py-0.5 align-[1px] text-[14px] font-semibold leading-none text-[var(--ok)]">{t.tag.rotation}</span>;
  return null;
}
function Avatar({ name }: { name: string }) {
  return <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--accent)] text-[14px] font-semibold text-[var(--on-accent)]">{initials(name)}</span>;
}

export default function FamilyBoard({ lang, initial, plan, templates, me, admin }: { lang: Lang; initial: OsBoard | null; plan: OsPlan | null; templates: OsTemplate[] | null; me: { id: string; kind: string } | null; admin: boolean }) {
  const t = T[lang];
  const toggleLang = useLangToggle(lang);
  const [board, setBoard] = useState(initial);
  // A server refresh (router.refresh after a write) brings a new `initial`: take it over.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) { setSeen(initial); setBoard(initial); }
  const [at, setAt] = useState<string>(initial?.now ?? "");
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/family-os/board${initial ? `?date=${initial.date}` : ""}`, { credentials: "same-origin", cache: "no-store" }).catch(() => null);
    if (r?.ok) { const b = (await r.json()) as OsBoard; setBoard(b); setAt(b.now); }
  }, [initial]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") refresh(); };
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [refresh]);

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} />
      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin={admin} os active="board" />
        {!board ? <p role="status" className="mt-10 max-w-4xl rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p> : (
          <div className="pb-8" data-board="">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h1 className={H1}>{t.title}</h1>
                <p className={`${META} mt-2 text-[16px]`} suppressHydrationWarning>{longDate(board.date, lang)}{at ? ` · ${t.updated} ${at}` : ""}</p>
              </div>
              <Progress t={t} p={board.progress} />
            </div>
            <Strip t={t} lang={lang} members={board.members} meId={me?.id ?? null} />
            <Lanes t={t} lang={lang} board={board} me={me} onChange={refresh} />
            {board.needs_decision && board.needs_decision.length > 0 && <Decisions t={t} lang={lang} tasks={board.needs_decision} members={board.members} onChange={refresh} />}
            {board.carry_offer && board.carry_offer.length > 0 && <CarryOffer t={t} lang={lang} tasks={board.carry_offer} members={board.members} onChange={refresh} />}
            <div className={`mt-8 grid gap-5 ${board.can.approve ? "lg:grid-cols-[1.35fr_1fr]" : ""}`}>
              {board.can.approve && board.plan && <PlanPanel key={`${board.plan.date}:${board.plan.approved}:${plan?.tasks.length ?? 0}`} t={t} lang={lang} summary={board.plan} plan={plan} members={board.members} />}
              <SprintPanel t={t} lang={lang} weekStart={board.sprint.week_start} goals={board.sprint.goals} />
            </div>
            {board.can.approve && templates && <Templates t={t} lang={lang} templates={templates} members={board.members} />}
          </div>
        )}
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}

function Progress({ t, p }: { t: Dict; p: OsBoard["progress"] }) {
  const pc = (n: number) => (p.total ? `${(n / p.total) * 100}%` : "0%");
  const seg: [Col, string, number][] = [["done", "var(--ok)", p.done], ["in_progress", "var(--accent)", p.in_progress], ["accepted", "var(--sprint)", p.accepted], ["waiting", "var(--wait-border)", p.waiting]];
  return (
    <div data-progress="" className="w-full max-w-sm">
      <p className="flex items-baseline justify-between text-[14px] text-[var(--muted)]"><span>{t.today}</span><span><b className="font-serif text-[22px] font-normal text-[var(--foreground)]">{p.done}</b> {t.of} {p.total} {t.ready}</span></p>
      <div role="img" aria-label={seg.map(([k, , n]) => `${t.legend[k]} ${n}`).join(", ")} className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[var(--surface)]">
        {seg.map(([k, c, n]) => <i key={k} className="block h-full" style={{ width: pc(n), background: c }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-[var(--muted)]" aria-hidden="true">
        {seg.map(([k, c, n]) => <li key={k}><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-[0px]" style={{ background: c }} />{t.legend[k]} {n}</li>)}
      </ul>
    </div>
  );
}

function Strip({ t, lang, members, meId }: { t: Dict; lang: Lang; members: OsBoardMember[]; meId: string | null }) {
  return (
    <section aria-labelledby="strip-h" className="mt-8">
      <h2 id="strip-h" className="font-serif text-[22px] text-[var(--foreground)]">{t.strip}</h2>
      <ul aria-live="polite" data-strip="" className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {members.map((m) => (
          <li key={m.id} data-who={m.current ? "busy" : m.waiting ? "waiting" : "free"} className={`rounded-xl border px-3 py-3 ${m.current ? "border-[var(--accent)] shadow-[inset_3px_0_0_var(--accent)]" : "border-[var(--border)]"}`}>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]"><Avatar name={nameOfM(m, lang)} />{nameOfM(m, lang)}{m.id === meId ? <span className="font-normal text-[var(--muted)]">· {lang === "EN" ? "you" : "ты"}</span> : null}</p>
            {m.current ? (
              <>
                <p className="mt-2 text-[15px] font-semibold leading-snug text-[var(--accent)]"><span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--accent)] align-[1px] motion-safe:animate-pulse" />{m.current.title}</p>
                <p className="mt-1 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{m.current.started_at ? `${t.since} ${hhmm(m.current.started_at)}` : ""}{m.current.kind === "sprint" ? ` · ${t.tag.sprint.toLowerCase()}` : ""}</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[15px] text-[var(--text-secondary)]">{m.waiting ? t.waitingN(m.waiting) : m.total ? t.nothing : t.noTasks}</p>
                {m.total > 0 && <p className="mt-1 text-[14px] text-[var(--muted)]">{t.doneOf(m.done, m.total)}</p>}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One card on the board; the person's own primary move (and a parent's review) right on it. */
function Card({ t, task, me, onChange, canReview }: { t: Dict; task: OsBoardTask; me: { id: string } | null; onChange: () => void; canReview: boolean }) {
  const col = colOf(task.state);
  const mine = me?.id === task.assignee_id;
  const cls = task.state === "declined" ? "border-[var(--warn-border)] bg-[var(--warn-soft)]"
    : col === "done" ? "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
    : col === "in_progress" ? "border-[var(--accent)] shadow-[inset_3px_0_0_var(--accent)]"
    : task.state === "approved" ? "border-dashed border-[var(--wait-border)]" : "border-[var(--border)]";
  const meta = task.state === "declined" ? `«${t.cant}»${task.decline_reason ? ` — ${task.decline_reason}` : ""} · ${t.decide}`
    : task.state === "in_progress" ? `${t.since} ${hhmm(task.started_at)}`
    : task.state === "reviewed" ? t.reviewed
    : [task.state === "approved" ? t.newT : "", task.due_time ? `${t.by} ${task.due_time}` : "", task.needs_review && col !== "done" ? t.needsReview : ""].filter(Boolean).join(" · ");
  return (
    <li data-card={task.state} className={`rounded-lg border px-3 py-2 text-[15px] leading-snug ${cls}`}>
      <p className={col === "done" ? "text-[var(--muted)]" : "text-[var(--foreground)]"}>{col === "done" && <span aria-hidden="true" className="mr-1 font-bold text-[var(--ok)]">✓</span>}<Tag task={task} t={t} />{task.title}</p>
      {meta && <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{meta}</p>}
      {mine && ["approved", "accepted", "in_progress"].includes(task.state) && <Move t={t} task={task} onChange={onChange} compact />}
      {canReview && task.state === "done" && task.needs_review && <Review t={t} task={task} onChange={onChange} />}
    </li>
  );
}

/** The one primary move for my task: Принимаю → Начал → Готово. Starting a second task asks to pause the first. */
export function Move({ t, task, onChange, compact = false }: { t: Dict; task: OsBoardTask; onChange: () => void; compact?: boolean }) {
  const [ask, setAsk] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const action = task.state === "approved" ? "accept" : task.state === "accepted" ? "start" : "done";
  const go = async (body: unknown = {}) => {
    setErr(false);
    const r = await osSend("POST", `tasks/${task.id}/${action}`, body);
    if (r?.status === 409) { const j = await r.json().catch(() => ({})); if (j.error === "one_in_progress") { setAsk(j.title ?? ""); return; } }
    if (!r?.ok) { setErr(true); return; }
    setAsk(null); onChange();
  };
  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      {ask === null ? (
        <button type="button" onClick={() => go()} className={`${action === "done" ? primary : btn} ${compact ? "w-full" : ""}`}>{t.act[action]}</button>
      ) : (
        <div role="alertdialog" aria-label={t.pauseQ(ask)} className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-[15px] text-[var(--foreground)]">{t.pauseQ(ask)}</p>
          <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => go({ pause_other: true })}>{t.pauseYes}</button><button type="button" className={btn} onClick={() => setAsk(null)}>{t.cancel}</button></div>
        </div>
      )}
      {err && <p role="status" className="mt-1 text-[14px] text-[var(--muted)]">{t.error}</p>}
    </div>
  );
}

function Review({ t, task, onChange }: { t: Dict; task: OsBoardTask; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState(false);
  const go = async (action: "review" | "rework") => { const r = await osSend("POST", `tasks/${task.id}/${action}`, action === "rework" ? { note } : {}); if (r?.ok) onChange(); else setErr(true); };
  return (
    <div className="mt-2 grid gap-2">
      {!open ? (
        <div className="grid grid-cols-2 gap-2"><button type="button" className={primary} onClick={() => go("review")}>{t.act.review}</button><button type="button" className={btn} onClick={() => setOpen(true)}>{t.act.rework}</button></div>
      ) : (
        <>
          <label className={label}>{t.reworkNote}<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} className={field} /></label>
          <div className="flex gap-2"><button type="button" className={primary} onClick={() => go("rework")}>{t.send}</button><button type="button" className={btn} onClick={() => setOpen(false)}>{t.cancel}</button></div>
        </>
      )}
      {err && <p role="status" className="text-[14px] text-[var(--muted)]">{t.error}</p>}
    </div>
  );
}

function Lanes({ t, lang, board, me, onChange }: { t: Dict; lang: Lang; board: OsBoard; me: { id: string; kind: string } | null; onChange: () => void }) {
  const counts = Object.fromEntries(COLS.map((c) => [c, board.tasks.filter((x) => colOf(x.state) === c).length])) as Record<Col, number>;
  const role = (m: OsBoardMember) => (m.kind === "child" ? t.child : t.adult);
  const sorted = [...board.members].sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0));
  const cards = (m: OsBoardMember, c: Col) => board.tasks.filter((x) => x.assignee_id === m.id && colOf(x.state) === c);
  const canReview = board.can.approve;
  return (
    <section aria-label={t.lanesAria} className="mt-8">
      {/* Wide screens: person × 4 columns */}
      <div data-lanes="" className="hidden overflow-hidden rounded-xl border border-[var(--border)] lg:block">
        <div aria-hidden="true" className="grid grid-cols-[200px_repeat(4,1fr)] border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="px-3.5 py-2.5 text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{t.who}</div>
          {COLS.map((c) => <div key={c} className="px-3.5 py-2.5 text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{t.legend[c]} <span className="ml-1 font-medium normal-case tracking-normal">{counts[c]}</span></div>)}
        </div>
        {sorted.map((m) => (
          <div key={m.id} data-lane="" className={`grid border-b border-[var(--border)] last:border-b-0 ${m.total ? "grid-cols-[200px_repeat(4,1fr)]" : "grid-cols-[200px_1fr]"}`}>
            <div className="flex items-start gap-2.5 border-r border-[var(--border)] p-3">
              <Avatar name={nameOfM(m, lang)} />
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-[var(--foreground)]">{nameOfM(m, lang)}</h3>
                <p className="text-[14px] text-[var(--muted)]">{role(m)}{m.total ? ` · ${m.done} ${t.of} ${m.total}` : ""}</p>
                {m.total > 0 && <div className="mt-2 h-1 w-28 overflow-hidden rounded-full bg-[var(--surface)]"><i className="block h-full bg-[var(--ok)]" style={{ width: `${(m.done / m.total) * 100}%` }} /></div>}
              </div>
            </div>
            {m.total ? COLS.map((c) => {
              const list = cards(m, c);
              return (
                <div key={c} className="border-r border-[var(--border)] p-3 last:border-r-0">
                  {list.length ? <ul aria-label={`${nameOfM(m, lang)} — ${t.legend[c]}`} className="grid gap-2">{list.map((x) => <Card key={x.id} t={t} task={x} me={me} onChange={onChange} canReview={canReview} />)}</ul>
                    : <span className="text-[14px] text-[var(--muted)]" aria-hidden="true">{t.empty}</span>}
                </div>
              );
            }) : <div className="p-3 text-[14px] text-[var(--muted)]">{t.noTasks}</div>}
          </div>
        ))}
      </div>
      {/* Phone / tablet: one accordion per person, self open */}
      <div data-accordion="" className="grid gap-2 lg:hidden">
        {sorted.map((m) => (
          <details key={m.id} open={m.id === me?.id} className="group rounded-xl border border-[var(--border)] px-3">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
              <Avatar name={nameOfM(m, lang)} />
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold text-[var(--foreground)]">{nameOfM(m, lang)}</span><span className="block text-[14px] text-[var(--muted)]">{m.total ? t.doneOf(m.done, m.total) : t.noTasks}</span></span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90 motion-reduce:transition-none"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </summary>
            <div className="grid gap-3 pb-3">
              {COLS.map((c) => { const list = cards(m, c); return list.length ? (
                <div key={c}><h3 className="text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{t.legend[c]}</h3>
                  <ul className="mt-1.5 grid gap-2">{list.map((x) => <Card key={x.id} t={t} task={x} me={me} onChange={onChange} canReview={canReview} />)}</ul></div>
              ) : null; })}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function AssigneeSelect({ members, lang, value, onChange, labelText }: { members: OsBoardMember[]; lang: Lang; value: string; onChange: (v: string) => void; labelText: string }) {
  return <label className={label}>{labelText}<select value={value} onChange={(e) => onChange(e.target.value)} className={field}>{members.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, lang)}</option>)}</select></label>;
}

function Decisions({ t, lang, tasks, members, onChange }: { t: Dict; lang: Lang; tasks: OsBoardTask[]; members: OsBoardMember[]; onChange: () => void }) {
  return (
    <section aria-labelledby="decide-h" data-decisions="" className="mt-8">
      <h2 id="decide-h" className="font-serif text-[22px] text-[var(--foreground)]">{t.decision} <span className="text-[16px] text-[var(--muted)]">{tasks.length}</span></h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">{tasks.map((x) => <DecisionRow key={x.id} t={t} lang={lang} task={x} members={members} onChange={onChange} />)}</ul>
    </section>
  );
}
function DecisionRow({ t, lang, task, members, onChange }: { t: Dict; lang: Lang; task: OsBoardTask; members: OsBoardMember[]; onChange: () => void }) {
  const [to, setTo] = useState(members.find((m) => m.id !== task.assignee_id)?.id ?? task.assignee_id);
  const [err, setErr] = useState(false);
  const who = members.find((m) => m.id === task.assignee_id);
  const go = async (action: "reassign" | "carry" | "cancel") => { const r = await osSend("POST", `tasks/${task.id}/${action}`, action === "reassign" ? { assignee_id: to } : {}); if (r?.ok) onChange(); else setErr(true); };
  return (
    <li className="rounded-xl border border-[var(--warn-border)] bg-[var(--warn-soft)] p-4">
      <p className="text-[16px] font-semibold text-[var(--foreground)]">{who ? `${nameOfM(who, lang)}: ` : ""}«{task.title}»</p>
      <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{t.reason}: {task.decline_reason || "—"}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <AssigneeSelect members={members} lang={lang} value={to} onChange={setTo} labelText={t.whoDoes} />
        <button type="button" className={primary} onClick={() => go("reassign")}>{t.reassign}</button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" className={btn} onClick={() => go("carry")}>{t.toTomorrow}</button><button type="button" className={btn} onClick={() => go("cancel")}>{t.cancelTask}</button></div>
      {err && <p role="status" className="mt-1 text-[14px] text-[var(--muted)]">{t.error}</p>}
    </li>
  );
}

function CarryOffer({ t, lang, tasks, members, onChange }: { t: Dict; lang: Lang; tasks: OsBoardTask[]; members: OsBoardMember[]; onChange: () => void }) {
  const [err, setErr] = useState(false);
  const carry = async (ids: string[]) => { const rs = await Promise.all(ids.map((id) => osSend("POST", `tasks/${id}/carry`))); if (rs.every((r) => r?.ok)) onChange(); else { setErr(true); onChange(); } };
  return (
    <section aria-labelledby="carry-h" data-carry="" className={`mt-8 ${panel}`}>
      <h2 id="carry-h" className="font-serif text-[22px] text-[var(--foreground)]">{t.carry}</h2>
      <p className={`${META} mt-1`}>{t.carryHint}</p>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {tasks.map((x) => { const w = members.find((m) => m.id === x.assignee_id); return (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-[15px] text-[var(--foreground)]"><Tag task={x} t={t} />{x.title}{w ? <span className="text-[var(--muted)]"> · {nameOfM(w, lang)}</span> : null}</span>
            <button type="button" className={btn} onClick={() => carry([x.id])}>{t.toTomorrow}</button>
          </li>); })}
      </ul>
      {tasks.length > 1 && <button type="button" className={`${primary} mt-3`} onClick={() => carry(tasks.map((x) => x.id))}>{t.carryAll}</button>}
      {err && <p role="status" className="mt-1 text-[14px] text-[var(--muted)]">{t.error}</p>}
    </section>
  );
}

type Row = { id: string; include: boolean; assignee_id: string; due_time: string };
function PlanPanel({ t, lang, summary, plan, members }: { t: Dict; lang: Lang; summary: NonNullable<OsBoard["plan"]>; plan: OsPlan | null; members: OsBoardMember[] }) {
  const router = useRouter();
  const tasks = plan?.tasks ?? [];
  const [rows, setRows] = useState<Row[]>(tasks.map((x) => ({ id: x.id, include: true, assignee_id: x.assignee_id, due_time: x.due_time ?? "" })));
  const [msg, setMsg] = useState("");
  const set = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const n = rows.filter((r) => r.include).length;
  const approve = async () => { const r = await osSend("PUT", `plan/${summary.date}`, { items: rows }); setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh(); };
  const build = async () => { const r = await osSend("POST", `plan/${summary.date}/build`); setMsg(r?.ok ? "" : t.error); if (r?.ok) router.refresh(); };
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
    const r = await osSend("POST", `plan/${summary.date}/tasks`, { title: String(f.get("title") ?? "").trim(), assignee_id: f.get("assignee_id"), due_time: f.get("due_time") || null });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { form.reset(); router.refresh(); }
  };
  return (
    <section aria-labelledby="plan-h" data-plan="" className={panel}>
      <h2 id="plan-h" className="font-serif text-[22px] text-[var(--foreground)]" suppressHydrationWarning>{t.plan} — {longDate(summary.date, lang).replace(/^./, (c) => c.toLowerCase())}</h2>
      {summary.approved ? <p role="status" className="mt-2 text-[16px] text-[var(--foreground)]">{summary.auto ? t.planAuto : t.planDone}</p> : (
        <>
          <p className={`${META} mt-1`}>{t.planHint}</p>
          {tasks.length === 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-[16px] text-[var(--text-secondary)]">{t.planEmpty}</p><button type="button" className={btn} onClick={build}>{t.planBuild}</button></div>
          ) : (
            <ul data-plan-rows="" className="mt-2 divide-y divide-[var(--border)]">
              {tasks.map((x) => { const r = rows.find((y) => y.id === x.id)!; return (
                <li key={x.id} data-plan-row={r.include ? "in" : "out"} className="grid grid-cols-[44px_1fr] items-center gap-x-2 gap-y-2 py-2.5 sm:grid-cols-[44px_1fr_170px_110px]">
                  <label className="grid h-11 w-11 cursor-pointer place-items-center"><input type="checkbox" checked={r.include} onChange={(e) => set(x.id, { include: e.target.checked })} aria-label={`${t.include}: ${x.title}`} className="h-5 w-5 accent-[var(--accent)]" /></label>
                  <span className={`text-[15px] ${r.include ? "text-[var(--foreground)]" : "text-[var(--muted)] line-through"}`}><Tag task={x} t={t} />{x.title}{x.origin === "carry" && <span className="text-[14px] text-[var(--muted)]"> ({t.carried})</span>}</span>
                  <select aria-label={`${t.whoDoes}: ${x.title}`} value={r.assignee_id} onChange={(e) => set(x.id, { assignee_id: e.target.value })} className={`${field} col-start-2 mt-0 sm:col-start-auto`}>{members.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, lang)}</option>)}</select>
                  <input type="time" aria-label={`${t.time}: ${x.title}`} value={r.due_time} onChange={(e) => set(x.id, { due_time: e.target.value })} className={`${field} col-start-2 mt-0 sm:col-start-auto`} />
                </li>); })}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {tasks.length > 0 && <button type="button" className={primary} onClick={approve}>{t.approveN(n)}</button>}
            <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
          </div>
        </>
      )}
      <Disclosure summary={t.addTask} className="mt-4">
        <form onSubmit={add} className="mt-3 grid gap-3 sm:grid-cols-[1fr_170px_110px]">
          <label className={label}>{t.what}<input name="title" required maxLength={160} className={field} /></label>
          <label className={label}>{t.whoDoes}<select name="assignee_id" className={field}>{members.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, lang)}</option>)}</select></label>
          <label className={label}>{t.time}<input name="due_time" type="time" className={field} /></label>
          <div className="sm:col-span-3"><button type="submit" className={primary}>{t.add}</button></div>
        </form>
      </Disclosure>
      <p className={`${META} mt-3`}>{t.planNote}</p>
    </section>
  );
}

export function SprintPanel({ t, lang, weekStart, goals }: { t: Dict; lang: Lang; weekStart: string; goals: OsSprintGoal[] }) {
  const end = new Date(Date.parse(`${weekStart}T12:00:00Z`) + 6 * 86400_000).toISOString().slice(0, 10);
  return (
    <section aria-labelledby="sprint-h" data-sprint="" className={panel}>
      <h2 id="sprint-h" className="font-serif text-[22px] text-[var(--foreground)]">{t.sprint}</h2>
      <p className={`${META} mt-1`} suppressHydrationWarning>{fmtWeekRange(weekStart, end, lang)} · {t.sprintHint}</p>
      {goals.length === 0 ? <p className="mt-3 text-[16px] text-[var(--text-secondary)]">{t.sprintNone}</p> : (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {goals.map((g) => (
            <li key={g.id} data-goal="" className="py-3">
              <p className="flex items-center justify-between gap-3 text-[15px]"><b className="font-semibold text-[var(--foreground)]">{g.title}</b><span className="text-[14px] text-[var(--muted)]">{g.done} {t.of} {g.total}</span></p>
              <div role="img" aria-label={`${g.done} ${t.of} ${g.total}`} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface)]"><i className="block h-full bg-[var(--sprint)]" style={{ width: g.total ? `${(g.done / g.total) * 100}%` : "0%" }} /></div>
            </li>
          ))}
        </ul>
      )}
      <p className={`${META} mt-3`}>{t.sprintNote}</p>
      <Link href={`/${lang === "EN" ? "en" : "ru"}/family/os/council`} className="mt-1 inline-flex min-h-11 items-center text-[15px] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.toCouncil}</Link>
    </section>
  );
}

function Templates({ t, lang, templates, members }: { t: Dict; lang: Lang; templates: OsTemplate[]; members: OsBoardMember[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [rot, setRot] = useState(false);
  const drafts = templates.filter((x) => !x.active);
  const nameById = (id: string) => { const m = members.find((x) => x.id === id); return m ? nameOfM(m, lang) : "—"; };
  const activate = async () => { const r = await osSend("POST", "templates/activate", { ids: drafts.map((x) => x.id) }); setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh(); };
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
    const mask = [0, 1, 2, 3, 4, 5, 6].map((i) => (f.get(`d${i}`) ? "1" : "0")).join("");
    const who = f.getAll("who").map(String);
    const r = await osSend("POST", "templates", { title: String(f.get("title") ?? "").trim(), mask, ...(rot ? { members: who } : { assignee_id: who[0] }), due_time: f.get("due_time") || null, needs_review: Boolean(f.get("needs_review")) });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { form.reset(); setRot(false); router.refresh(); }
  };
  return (
    <section aria-labelledby="tpl-h" data-templates="" className="mt-10">
      <h2 id="tpl-h" className={H2}>{t.templates}</h2>
      <p className={`${META} mt-2 max-w-[68ch]`}>{t.tplHint}</p>
      {templates.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {templates.map((x) => (
            <li key={x.id} data-template={x.active ? "active" : "draft"} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <span className="text-[16px] text-[var(--foreground)]">{x.title}<span className="block text-[14px] text-[var(--muted)]">{maskText(x.mask, t)}{x.due_time ? ` · ${x.due_time}` : ""} · {x.members?.length ? x.members.map(nameById).join(" → ") : nameById(x.assignee_id ?? "")}</span></span>
              <span className={`rounded-full px-2.5 py-1 text-[14px] ${x.active ? "bg-[var(--ok-soft)] text-[var(--ok)]" : "border border-[var(--border)] text-[var(--muted)]"}`}>{x.active ? t.tplActive : t.tplDraft}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {drafts.length > 0 && <button type="button" className={primary} onClick={activate}>{t.tplApprove(drafts.length)}</button>}
        <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
      </div>
      <Disclosure summary={t.tplAdd} className="mt-4">
        <form onSubmit={add} className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className={`${label} sm:col-span-2`}>{t.what}<input name="title" required maxLength={160} className={field} /></label>
          <fieldset className="sm:col-span-2"><legend className={label}>{t.days}</legend>
            <div className="mt-1 flex flex-wrap gap-1">{t.dayNames.map((d, i) => <label key={d} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-2 text-[15px]"><input type="checkbox" name={`d${i}`} defaultChecked className="h-4 w-4 accent-[var(--accent)]" />{d}</label>)}</div>
          </fieldset>
          <label className="flex min-h-11 items-center gap-3 text-[16px] sm:col-span-2"><input type="checkbox" checked={rot} onChange={(e) => setRot(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />{t.rotation}</label>
          <label className={label}>{t.whoDoes}<select name="who" multiple={rot} required className={`${field} ${rot ? "min-h-28" : ""}`}>{members.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, lang)}</option>)}</select></label>
          <label className={label}>{t.time}<input name="due_time" type="time" className={field} /></label>
          <label className="flex min-h-11 items-center gap-3 text-[16px] sm:col-span-2"><input type="checkbox" name="needs_review" className="h-5 w-5 accent-[var(--accent)]" />{t.review}</label>
          <div className="sm:col-span-2"><button type="submit" className={primary}>{t.add}</button></div>
        </form>
      </Disclosure>
    </section>
  );
}

/** Today: «Новые задачи» (Принимаю / Не могу / Принять все) above «Мои задачи» (one primary move each); parents also get the plan line from 20:30. */
export function TodayBoard({ lang, data, plan }: { lang: Lang; data: OsMyBoard; plan: OsBoard["plan"] | null }) {
  const t = T[lang];
  const router = useRouter();
  const [err, setErr] = useState(false);
  const done = data.mine.filter((x) => x.state === "done" || x.state === "reviewed").length;
  const L = lang === "EN"
    ? { newH: "New tasks", wait: (n: number) => `${n} waiting for you`, all: (n: number) => `Accept all (${n})`, mineH: "My tasks", of: (d: number, n: number) => `${d} of ${n} done`, why: "Why can't you?", planLine: (n: number) => `Tomorrow's plan is ready — ${n} to approve`, open: "Open and approve", chip: { accepted: "Accepted", in_progress: "In progress", done: "Done", reviewed: "Checked", declined: "Parents decide" } }
    : { newH: "Новые задачи", wait: (n: number) => `${n} ждут тебя`, all: (n: number) => `Принять все (${n})`, mineH: "Мои задачи", of: (d: number, n: number) => `${d} из ${n} готово`, why: "Почему не можешь?", planLine: (n: number) => `План на завтра готов — утвердить: ${n}`, open: "Открыть и утвердить", chip: { accepted: "Принято", in_progress: "В работе", done: "Готово", reviewed: "Проверено", declined: "Решают родители" } };
  const acceptAll = async () => { const r = await osSend("POST", "tasks/accept-all"); if (r?.ok) router.refresh(); else setErr(true); };
  if (!data.new.length && !data.mine.length && !(plan && !plan.approved && plan.proposed > 0 && plan.ready)) return null;
  return (
    <div data-today-board="">
      {plan && !plan.approved && plan.proposed > 0 && plan.ready && (
        <p data-plan-line="" className="mt-8 flex flex-wrap items-center gap-x-3 rounded-xl border border-[var(--border)] px-4 py-3 text-[16px] text-[var(--foreground)]">{L.planLine(plan.proposed)}
          <Link href={`/${lang === "EN" ? "en" : "ru"}/family/os/board#plan-h`} className={`${primary} ml-auto`}>{L.open}</Link></p>
      )}
      {data.new.length > 0 && (
        <section aria-labelledby="new-h" data-new-tasks="" className="mt-8">
          <h2 id="new-h" className="flex items-baseline justify-between gap-3 font-serif text-[22px] text-[var(--foreground)]">{L.newH}<span className="font-sans text-[14px] text-[var(--muted)]">{L.wait(data.new.length)}</span></h2>
          <ul className="mt-2 grid gap-3">{data.new.map((x) => <NewTask key={x.id} t={t} why={L.why} task={x} onChange={() => router.refresh()} />)}</ul>
          {data.new.length > 1 && <button type="button" className={`${btn} mt-3 w-full`} onClick={acceptAll}>{L.all(data.new.length)}</button>}
          {err && <p role="status" className="mt-1 text-[14px] text-[var(--muted)]">{t.error}</p>}
        </section>
      )}
      {data.mine.length > 0 && (
        <section aria-labelledby="mine-h" data-my-tasks="" className="mt-8">
          <h2 id="mine-h" className="flex items-baseline justify-between gap-3 font-serif text-[22px] text-[var(--foreground)]">{L.mineH}<span className="font-sans text-[14px] text-[var(--muted)]">{L.of(done, data.mine.length)}</span></h2>
          <ul className="mt-2 grid gap-3">
            {data.mine.map((x) => (
              <li key={x.id} data-mine={x.state} className={`rounded-xl border p-3.5 ${x.state === "in_progress" ? "border-[var(--accent)] shadow-[inset_3px_0_0_var(--accent)]" : x.state === "done" || x.state === "reviewed" ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[16px] font-semibold text-[var(--foreground)]"><Tag task={x} t={t} />{x.title}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[14px] font-medium ${x.state === "in_progress" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : x.state === "done" || x.state === "reviewed" ? "bg-[var(--ok-soft)] text-[var(--ok)]" : "bg-[var(--surface)] text-[var(--muted)]"}`}>{L.chip[x.state as keyof typeof L.chip]}</span>
                </div>
                {(x.due_time || x.started_at) && <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{x.state === "in_progress" && x.started_at ? `${t.since} ${hhmm(x.started_at)}` : x.due_time ? `${t.by} ${x.due_time}` : ""}</p>}
                {x.rework_note && <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{t.act.rework}: {x.rework_note}</p>}
                {(x.state === "accepted" || x.state === "in_progress") && <Move t={t} task={x} onChange={() => router.refresh()} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function NewTask({ t, why, task, onChange }: { t: Dict; why: string; task: OsBoardTask; onChange: () => void }) {
  const [cant, setCant] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState(false);
  const go = async (action: "accept" | "decline") => { const r = await osSend("POST", `tasks/${task.id}/${action}`, action === "decline" ? { reason } : {}); if (r?.ok) onChange(); else setErr(true); };
  return (
    <li data-new-task="" className="rounded-xl border border-[var(--border)] p-3.5">
      <p className="text-[16px] font-semibold text-[var(--foreground)]"><Tag task={task} t={t} />{task.title}</p>
      {task.due_time && <p className="mt-0.5 text-[14px] text-[var(--muted)]">{t.by} {task.due_time}</p>}
      {!cant ? (
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className={primary} onClick={() => go("accept")}>{t.act.accept}</button><button type="button" className={btn} onClick={() => setCant(true)}>{t.cant}</button></div>
      ) : (
        <div className="mt-3 grid gap-2">
          <label className={label}>{why}<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} required className={field} /></label>
          <div className="grid grid-cols-2 gap-2"><button type="button" className={primary} disabled={!reason.trim()} onClick={() => go("decline")}>{t.send}</button><button type="button" className={btn} onClick={() => setCant(false)}>{t.cancel}</button></div>
        </div>
      )}
      {err && <p role="status" className="mt-1 text-[14px] text-[var(--muted)]">{t.error}</p>}
    </li>
  );
}

/** Council: «Цели спринта» for the council's week (1–3, adults edit) and the review block (family totals). */
export function CouncilSprint({ lang, sprint }: { lang: Lang; sprint: OsSprint }) {
  const t = T[lang];
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const L = lang === "EN"
    ? { head: "Sprint goals", review: "Sprint review", reviewLine: (d: number, n: number) => `The family closed ${d} of ${n} sprint tasks this week.`, add: "Add a goal", goal: "Goal", save: "Save", archive: "Remove", max: "Three goals at most." }
    : { head: "Цели спринта", review: "Итоги спринта", reviewLine: (d: number, n: number) => `За неделю семья закрыла ${d} из ${n} задач спринта.`, add: "Добавить цель", goal: "Цель", save: "Сохранить", archive: "Убрать", max: "Не больше трёх целей." };
  const totals = sprint.goals.reduce((a, g) => ({ d: a.d + g.done, n: a.n + g.total }), { d: 0, n: 0 });
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
    const r = await osSend("POST", "sprint/goals", { title: String(f.get("title") ?? "").trim(), week_start: sprint.week_start });
    setMsg(r?.ok ? t.saved : r?.status === 409 ? L.max : t.error); if (r?.ok) { form.reset(); router.refresh(); }
  };
  const patch = async (id: string, body: unknown) => { const r = await osSend("PATCH", `sprint/goals/${id}`, body); setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh(); };
  return (
    <section aria-labelledby="sprint-goals-h" data-council-sprint="" className="mt-10">
      <h2 id="sprint-goals-h" className={H2}>{L.head}</h2>
      {sprint.goals.length === 0 ? <p className={`${META} mt-2`}>{t.sprintNone}</p> : (
        <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {sprint.goals.map((g) => (
            <li key={g.id} data-goal="" className="py-3">
              {sprint.can.write ? (
                <form onSubmit={(e) => { e.preventDefault(); patch(g.id, { title: String(new FormData(e.currentTarget).get("title") ?? "").trim() }); }} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <label className={label}>{L.goal}<input name="title" defaultValue={g.title} required maxLength={160} className={field} /></label>
                  <button type="submit" className={btn}>{L.save}</button>
                  <button type="button" className={btn} onClick={() => patch(g.id, { archived: true })}>{L.archive}</button>
                </form>
              ) : <p className="text-[16px] font-semibold text-[var(--foreground)]">{g.title}</p>}
              <p className="mt-1 text-[14px] text-[var(--muted)]">{g.done} {t.of} {g.total}</p>
            </li>
          ))}
        </ul>
      )}
      {sprint.can.write && sprint.goals.length < 3 && (
        <form onSubmit={add} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className={label}>{L.add}<input name="title" required maxLength={160} className={field} /></label>
          <button type="submit" className={primary}>{L.add}</button>
        </form>
      )}
      <span role="status" aria-live="polite" className="mt-1 block text-[14px] text-[var(--muted)]">{msg}</span>
      <div data-sprint-review="" className={`mt-6 ${panel}`}>
        <h3 className="font-serif text-[20px] text-[var(--foreground)]">{L.review}</h3>
        <p className="mt-1 text-[16px] text-[var(--foreground)]">{totals.n ? L.reviewLine(totals.d, totals.n) : t.sprintNone}</p>
        <p className={`${META} mt-1`}>{t.sprintNote}</p>
      </div>
    </section>
  );
}
