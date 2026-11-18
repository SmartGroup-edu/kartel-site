"use client";

/**
 * «Семейная доска» (Stage 3c, bus 82; amended by 83 and 84). Family tasks only: routines, goals, health
 * and school never reach this page (the service never sends them). A child's routines appear only as one
 * count line, and only to the child and their routines guardians. The day: plan (20:30) → one parent
 * approves (the first approval wins) → the assignee accepts (by 12:00, else «Нужно решение») → in progress
 * → done → reviewed by the accountable person. Adults' tasks are proposals. Joint tasks show in every
 * participant's lane and count once. Live: re-read every 30 s while visible; the strip is aria-live.
 * Phone: lanes fold into one accordion per person (self open). Sprint progress: family totals only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
import { H2, H1, META } from "../lib/typeScale";
import { avatars as avatarsOf } from "../lib/family-avatars.mjs";
import type { OsBoard, OsBoardMember, OsBoardTask, OsPlan, OsTemplate, OsSprint, OsSprintGoal, OsMyBoard, OsApprovalStamp, OsWhenSlot, OsDeclineCode, OsTaskHistory } from "../lib/family-os";

type Lang = "EN" | "RU";
type Person = { id: string; name_en: string; name_ru: string; kind: "adult" | "child" };
const T = {
  RU: {
    title: "Семейная доска", updated: "обновлено", today: "Семейные задачи сегодня", of: "из", ready: "готово", noneToday: "Сегодня семейных задач нет.",
    barText: (p: OsBoard["progress"]) => `Готово ${p.done} из ${p.total}: в работе ${p.in_progress}, принято ${p.accepted}, ждёт ${p.waiting}`,
    legend: { done: "Готово", in_progress: "В работе", accepted: "Принято", waiting: "Ждёт принятия" },
    stamp: (who: string, at: string) => `План утверждён — ${who} в ${at}`, stampAuto: (at: string) => `Утверждён автоматически по шаблону в ${at}`,
    strip: "Кто чем занят", since: "с", nothing: "Сейчас ничего", waitingN: (n: number) => `Ждёт принятия: ${n}`, acceptBy: "принять до 12:00", doneOf: (d: number, n: number) => `готово ${d} из ${n}`, noTasks: "Сегодня задач нет", nearest: "ближайшее",
    who: "Кто", adult: "взрослый", child: "ребёнок", empty: "—", with: "вместе с", routineLine: (d: number, n: number) => `Распорядок ${d}\u00a0из\u00a0${n}`, routineNote: "видят только сам ребёнок и родители",
    tag: { sprint: "Спринт", rotation: "Очередь", council: "Совет" }, cant: "Не могу", decide: "решают родители", reviewedBy: (n: string) => `Проверено · ${n}`, reviewed: "Проверено", needsReview: "с проверкой", newT: "новая", by: "до", est: (m: number) => `~${m} мин`,
    slot: { morning: "утром", after_school: "после школы", after_dinner: "после ужина", evening: "вечером" } as Record<OsWhenSlot, string>,
    act: { accept: "Принимаю", start: "Начал", done: "Готово", review: "Проверено", rework: "Ещё немного", pause: "Пауза" },
    reasons: { lessons: "Уроки", away: "Не буду дома", unwell: "Плохо себя чувствую", other: "Другое…" } as Record<OsDeclineCode, string>, whyCant: "Почему не можешь?", otherText: "Своими словами",
    reworkNote: "Что доделать", send: "Отправить", error: "Не удалось сохранить — попробуй ещё раз.",
    pauseQ: (x: string) => `Сейчас в работе: «${x}». Поставить её на паузу и начать эту?`, pauseYes: "Да, на паузу", cancel: "Отмена", busy: "Кто-то из участников сейчас занят другим делом.",
    nudgeQ: "Ещё в работе?", nudgeGoOn: "Продолжаю",
    inbox: (n: number) => `Нужно твоё решение: ${n}`, inboxGo: "Разобрать", inboxClose: "Свернуть", calm: "Сегодня ничего не требует твоего решения.", calmAll: "Все задачи приняты.",
    inboxCant: (who: string, x: string) => `${who}: не может — «${x}»`, inboxLate: (who: string, x: string) => `${who}: не принято к 12:00 — «${x}»`, inboxPlan: "План на завтра — утвердить до 21:00",
    view: "Вид", board: "Доска", list: "Список", filter: "Чьи задачи", mine: "Мои", kids: "Дети", all: "Все",
    summary: (n: number, w: number, d: number | null) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "задача" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "задачи" : "задач"} · ${w} ждут принятия${d === null ? "" : ` · ${d} ждёт решения`}`,
    decision: "Нужно решение", lateWhy: "Не принято к 12:00", reassign: "Передать", toTomorrow: "На завтра", cancelTask: "Снять", reason: "Причина",
    carry: "Перенести на завтра?", carryHint: "Незакрытые дела сегодня. Детям ничего не подсвечивается.", carryAll: "Перенести все",
    plan: "План на завтра", planHint: "Собрано из шаблонов, очереди дел, спринта и перенесённого. Утверди до 21:00 — утром каждый увидит свои задачи.",
    planBuild: "Собрать план", planEmpty: "Пока нечего утверждать.", approveN: (n: number) => `Утвердить ${n} ${n % 10 === 1 && n % 100 !== 11 ? "задачу" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "задачи" : "задач"}`,
    edit: "Изменить", editDone: "Готово", remove: "Убрать", editNote: "Изменения записываются; узнают только те, кого они касаются.",
    addTask: "+ Добавить задачу", what: "Что сделать", whoDoes: "Кто", together: "Вместе с", nobody: "— никто —", time: "Время", when: "Когда", anyTime: "без времени", estimate: "Оценка, мин", add: "Добавить", include: "Включить в план",
    planNote: "Распорядок (зубы, портфель, чтение) не требует утверждения — он идёт каждый день сам.", carried: "перенесено",
    sprint: "Спринт недели", sprintHint: "подводим итоги на совете в воскресенье в 19:00", sprintNone: "Целей спринта на эту неделю пока нет.", sprintNote: "Прогресс — только по семье. Без рейтингов и без сравнения детей.", toCouncil: "Открыть совет",
    templates: "Шаблоны плана", tplHint: "Из них в 20:30 собирается план на завтра. Черновики не попадают в план, пока родитель не нажмёт «Утвердить шаблоны».",
    tplDraft: "черновик", tplActive: "в плане", tplApprove: (n: number) => `Утвердить шаблоны (${n})`, tplAdd: "Добавить шаблон", days: "Дни", rotation: "По очереди (2+ человека)", review: "С проверкой родителя",
    dayNames: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], everyDay: "каждый день", saved: "Сохранено.",
    notMember: "Доску видят члены семьи.", lanesAria: "Задачи по людям", stateSr: { approved: "ждёт принятия", declined: "не может — решают родители", accepted: "принято", in_progress: "в работе", done: "готово", reviewed: "проверено" } as Record<string, string>,
    drawer: { close: "Закрыть", assignee: "Исполнитель", accountable: "Ответственный", due: "Срок · оценка", history: "История", reviewNote: "Проверяет ответственный, а не исполнитель.", none: "—",
      photo: "Фото к проверке — по желанию", photoHint: "Его увидят только родители. Через 7 дней оно удалится само.", photoAdd: "Добавить фото", photoReplace: "Заменить фото", photoAdded: (d: string) => `Фото добавлено. Удалится ${d}.`, photoErr: "Не удалось отправить фото — попробуй ещё раз.", photoBig: "Фото больше 4 МБ — выбери поменьше.", photoKind: "Подойдёт JPEG, PNG или HEIC.", photoSeen: (d: string) => `Фото к проверке · удалится ${d}`, photoAlt: "Фото к задаче" },
    step: { proposed: "Предложено", approved: "Утверждено", accepted: "Принято", started: "Начато", paused: "Пауза", continued: "Продолжено", done: "Готово", reviewed: "Проверено", declined: "Не может", edited: "Изменено", carried_over: "Перенесено на завтра", cancelled: "Снято" } as Record<string, string>,
    origin: { template: "из шаблона", rotation: "по очереди", sprint: "из спринта", carry: "перенесено", adhoc: "добавлено" } as Record<string, string>,
    actor: { auto: "автоматически", system: "система", admin: "администратор" } as Record<string, string>, todayW: "сегодня", yesterday: "вчера",
  },
  EN: {
    title: "Family board", updated: "updated", today: "Family tasks today", of: "of", ready: "done", noneToday: "No family tasks today.",
    barText: (p: OsBoard["progress"]) => `Done ${p.done} of ${p.total}: in progress ${p.in_progress}, accepted ${p.accepted}, waiting ${p.waiting}`,
    legend: { done: "Done", in_progress: "In progress", accepted: "Accepted", waiting: "Waiting" },
    stamp: (who: string, at: string) => `Plan approved — ${who} at ${at}`, stampAuto: (at: string) => `Approved automatically from the templates at ${at}`,
    strip: "Who is doing what", since: "since", nothing: "Nothing right now", waitingN: (n: number) => `Waiting to accept: ${n}`, acceptBy: "accept by 12:00", doneOf: (d: number, n: number) => `${d} of ${n} done`, noTasks: "No tasks today", nearest: "next",
    who: "Who", adult: "adult", child: "child", empty: "—", with: "with", routineLine: (d: number, n: number) => `Routine ${d}\u00a0of\u00a0${n}`, routineNote: "seen only by the child and the parents",
    tag: { sprint: "Sprint", rotation: "Rota", council: "Council" }, cant: "Can't", decide: "parents decide", reviewedBy: (n: string) => `Checked · ${n}`, reviewed: "Checked", needsReview: "to check", newT: "new", by: "by", est: (m: number) => `~${m} min`,
    slot: { morning: "in the morning", after_school: "after school", after_dinner: "after dinner", evening: "in the evening" } as Record<OsWhenSlot, string>,
    act: { accept: "Accept", start: "Start", done: "Done", review: "Checked", rework: "A bit more", pause: "Pause" },
    reasons: { lessons: "Homework", away: "Not at home", unwell: "Not feeling well", other: "Other…" } as Record<OsDeclineCode, string>, whyCant: "Why can't you?", otherText: "In your own words",
    reworkNote: "What is left", send: "Send", error: "Could not save — please try again.",
    pauseQ: (x: string) => `In progress now: “${x}”. Pause it and start this one?`, pauseYes: "Yes, pause it", cancel: "Cancel", busy: "Someone doing this with you is busy with another task.",
    nudgeQ: "Still on it?", nudgeGoOn: "Still going",
    inbox: (n: number) => `Needs your decision: ${n}`, inboxGo: "Sort it out", inboxClose: "Collapse", calm: "Nothing needs your decision today.", calmAll: "Every task is accepted.",
    inboxCant: (who: string, x: string) => `${who} can't — “${x}”`, inboxLate: (who: string, x: string) => `${who}: not accepted by 12:00 — “${x}”`, inboxPlan: "Tomorrow's plan — approve by 21:00",
    view: "View", board: "Board", list: "List", filter: "Whose tasks", mine: "Mine", kids: "Children", all: "All",
    summary: (n: number, w: number, d: number | null) => `${n} task${n === 1 ? "" : "s"} · ${w} waiting to accept${d === null ? "" : ` · ${d} to decide`}`,
    decision: "Needs a decision", lateWhy: "Not accepted by 12:00", reassign: "Hand over", toTomorrow: "Tomorrow", cancelTask: "Remove", reason: "Reason",
    carry: "Move to tomorrow?", carryHint: "Tasks still open today. Nothing turns red for children.", carryAll: "Move all",
    plan: "Plan for tomorrow", planHint: "Built from templates, the rota, the sprint and carried-over tasks. Approve by 21:00 — in the morning everyone sees their tasks.",
    planBuild: "Build the plan", planEmpty: "Nothing to approve yet.", approveN: (n: number) => `Approve ${n} task${n === 1 ? "" : "s"}`,
    edit: "Change", editDone: "Done", remove: "Remove", editNote: "Changes are logged; only the people they affect are told.",
    addTask: "+ Add a task", what: "What to do", whoDoes: "Who", together: "Together with", nobody: "— nobody —", time: "Time", when: "When", anyTime: "any time", estimate: "Estimate, min", add: "Add", include: "Include in the plan",
    planNote: "Routines (teeth, school bag, reading) need no approval — they run every day by themselves.", carried: "carried over",
    sprint: "Sprint of the week", sprintHint: "reviewed at the council on Sunday at 19:00", sprintNone: "No sprint goals for this week yet.", sprintNote: "Progress is for the family only. No rankings, no comparing children.", toCouncil: "Open the council",
    templates: "Plan templates", tplHint: "Tomorrow's plan is built from these at 20:30. Drafts stay out of the plan until a parent presses “Approve templates”.",
    tplDraft: "draft", tplActive: "in the plan", tplApprove: (n: number) => `Approve templates (${n})`, tplAdd: "Add a template", days: "Days", rotation: "Take turns (2+ people)", review: "A parent checks it",
    dayNames: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], everyDay: "every day", saved: "Saved.",
    notMember: "The board is for family members.", lanesAria: "Tasks by person", stateSr: { approved: "waiting to accept", declined: "can't — parents decide", accepted: "accepted", in_progress: "in progress", done: "done", reviewed: "checked" } as Record<string, string>,
    drawer: { close: "Close", assignee: "Assignee", accountable: "Accountable", due: "When · estimate", history: "History", reviewNote: "The accountable person checks it, not the assignee.", none: "—",
      photo: "Photo for the check — optional", photoHint: "Only parents will see it. It deletes itself after 7 days.", photoAdd: "Add a photo", photoReplace: "Replace the photo", photoAdded: (d: string) => `Photo added. It will be deleted on ${d}.`, photoErr: "Could not send the photo — please try again.", photoBig: "The photo is over 4 MB — choose a smaller one.", photoKind: "JPEG, PNG or HEIC.", photoSeen: (d: string) => `Photo for the check · deleted on ${d}`, photoAlt: "Photo for the task" },
    step: { proposed: "Proposed", approved: "Approved", accepted: "Accepted", started: "Started", paused: "Paused", continued: "Still going", done: "Done", reviewed: "Checked", declined: "Can't", edited: "Changed", carried_over: "Moved to tomorrow", cancelled: "Removed" } as Record<string, string>,
    origin: { template: "from a template", rotation: "from the rota", sprint: "from the sprint", carry: "carried over", adhoc: "added" } as Record<string, string>,
    actor: { auto: "automatically", system: "system", admin: "admin" } as Record<string, string>, todayW: "today", yesterday: "yesterday",
  },
};
type Dict = (typeof T)["RU"];
const COLS = ["waiting", "accepted", "in_progress", "done"] as const;
type Col = (typeof COLS)[number];
const colOf = (s: OsBoardTask["state"]): Col | null => (s === "approved" || s === "declined" ? "waiting" : s === "accepted" ? "accepted" : s === "in_progress" ? "in_progress" : s === "done" || s === "reviewed" ? "done" : null);
const SLOT_MIN: Record<OsWhenSlot, number> = { morning: 480, after_school: 960, after_dinner: 1170, evening: 1230 };
const minuteOf = (t: { due_time: string | null; when_slot: OsWhenSlot | null }) => (t.due_time ? Number(t.due_time.slice(0, 2)) * 60 + Number(t.due_time.slice(3)) : t.when_slot ? SLOT_MIN[t.when_slot] : 1440);
const parts = (t: OsBoardTask) => [t.assignee_id, ...(t.co_ids ?? [])];

const field = "mt-1 block min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]";
const primary = "inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60";
const panel = "rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-4";
const seg = (on: boolean) => `inline-flex min-h-11 items-center px-3.5 text-[15px] ${on ? "bg-[var(--accent)] font-medium text-[var(--on-accent)]" : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"}`;

export const osSend = (method: "POST" | "PUT" | "PATCH", path: string, body: unknown = {}) =>
  fetch(`/api/family-os/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null);
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "");
const longDate = (d: string, lang: Lang) => { const s = new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); return s.charAt(0).toUpperCase() + s.slice(1); };
const shortDate = (d: string, lang: Lang) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const nameOfM = (m: { name_en: string; name_ru: string } | undefined, lang: Lang) => (!m ? "—" : lang === "EN" ? m.name_en : m.name_ru);
const maskText = (mask: string, t: Dict) => (mask === "1111111" ? t.everyDay : t.dayNames.filter((_, i) => mask[i] === "1").join(", "));
/** «до 19:30» · «после ужина» — human times, never a bare machine time. */
const whenText = (x: { due_time: string | null; when_slot: OsWhenSlot | null }, t: Dict) => (x.due_time ? `${t.by} ${x.due_time}` : x.when_slot ? t.slot[x.when_slot] : "");

/** Avatars (bus 85 M2): colour fixed per id, letters from the display name in the UI language (app/lib/family-avatars.mjs). */
const avatarsFor = (people: Person[], lang: Lang) => avatarsOf(people.map((p) => ({ id: p.id, name: nameOfM(p, lang) }))) as Map<string, { text: string; bg: string }>;
type Avatars = ReturnType<typeof avatarsFor>;
function Avatar({ id, av }: { id: string; av: Avatars }) {
  const a = av.get(id);
  return <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full text-[14px] font-semibold text-white" style={{ background: a?.bg ?? "#7b1e2d" }}>{a?.text ?? "?"}</span>;
}

/** The small tag before a title: sprint (blue) or rota (green). Plain chores carry none. */
function Tag({ task, t }: { task: { kind: string; origin?: string }; t: Dict }) {
  if (task.origin === "council") return <span className="mr-1.5 inline-block rounded-md bg-[var(--surface)] px-1.5 py-0.5 align-[1px] text-[14px] font-semibold leading-none text-[var(--accent)] ring-1 ring-[var(--border)]">{t.tag.council}</span>;
  if (task.kind === "sprint") return <span className="mr-1.5 inline-block rounded-md bg-[var(--sprint-soft)] px-1.5 py-0.5 align-[1px] text-[14px] font-semibold leading-none text-[var(--sprint)]">{t.tag.sprint}</span>;
  if (task.kind === "rotation") return <span className="mr-1.5 inline-block rounded-md bg-[var(--ok-soft)] px-1.5 py-0.5 align-[1px] text-[14px] font-semibold leading-none text-[var(--ok)]">{t.tag.rotation}</span>;
  return null;
}

type Ctx = { t: Dict; lang: Lang; me: { id: string; kind: string } | null; people: Person[]; av: Avatars; parent: boolean; onChange: () => void; open: (id: string) => void };
const withText = (task: OsBoardTask, lane: string | null, c: Ctx) => { const others = parts(task).filter((x) => x !== lane); return others.length ? `${c.t.with} ${others.map((x) => nameOfM(c.people.find((p) => p.id === x), c.lang)).join(", ")}` : ""; };

export default function FamilyBoard({ lang, initial, plan, templates, me, admin, editor = false }: { lang: Lang; initial: OsBoard | null; plan: OsPlan | null; templates: OsTemplate[] | null; me: { id: string; kind: string } | null; admin: boolean; editor?: boolean }) {
  const t = T[lang];
  const toggleLang = useLangToggle(lang);
  const [board, setBoard] = useState(initial);
  // A server refresh (router.refresh after a write) brings a new `initial`: take it over.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) { setSeen(initial); setBoard(initial); }
  const [at, setAt] = useState<string>(initial?.now ?? "");
  const [view, setView] = useState<"board" | "list">("board");
  const [who, setWho] = useState<"mine" | "kids" | "all">("all");
  const [drawer, setDrawer] = useState<string | null>(null);
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

  const people: Person[] = board?.members ?? [];
  const av = avatarsFor(people, lang);
  const parent = Boolean(board?.can.approve);
  const c: Ctx = { t, lang, me, people, av, parent, onChange: refresh, open: setDrawer };
  const decisions = decisionCount(board);
  const shown = (m: OsBoardMember) => who === "all" || (who === "mine" ? m.id === me?.id : m.kind === "child");
  const tasks = board ? board.tasks.filter((x) => who === "all" || (who === "mine" ? parts(x).includes(me?.id ?? "") : parts(x).some((p) => people.find((q) => q.id === p)?.kind === "child"))) : [];

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} />
      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin={admin} editor={editor} os active="board" badge={parent ? decisions : 0} />
        {!board ? <p role="status" className="mt-10 max-w-4xl rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p> : (
          <div className="pb-8" data-board="">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h1 className={H1}>{t.title}</h1>
                <p data-stamp="" className={`${META} mt-2 text-[16px]`} suppressHydrationWarning>
                  {longDate(board.date, lang)}{board.approval ? ` · ${stampText(board.approval, c)}` : ""}{at ? ` · ${t.updated} ${at}` : ""}
                </p>
              </div>
              <Progress t={t} p={board.progress} />
            </div>
            {parent && <Inbox c={c} board={board} />}
            <Toolbar c={c} view={view} setView={setView} who={who} setWho={setWho} tasks={tasks} decisions={parent ? decisions : null} />
            <Strip c={c} members={board.members.filter(shown)} />
            {view === "board" ? <Lanes c={c} board={board} members={board.members.filter(shown)} /> : <ListView c={c} tasks={tasks} />}
            {board.carry_offer && board.carry_offer.length > 0 && <CarryOffer c={c} tasks={board.carry_offer} />}
            <div className={`mt-8 grid gap-5 ${parent && board.plan ? "lg:grid-cols-[1.35fr_1fr]" : ""}`}>
              {parent && board.plan && <PlanPanel key={`${board.plan.date}:${board.plan.approved}:${plan?.tasks.length ?? 0}:${plan?.approval?.at ?? ""}`} c={c} summary={board.plan} plan={plan} />}
              <SprintPanel t={t} lang={lang} weekStart={board.sprint.week_start} goals={board.sprint.goals} />
            </div>
            {parent && templates && <Templates c={c} templates={templates} />}
          </div>
        )}
        {drawer && board && <Drawer c={c} id={drawer} onClose={() => setDrawer(null)} />}
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}

const decisionCount = (b: OsBoard | null) => (b?.needs_decision?.length ?? 0) + (b?.plan && b.plan.ready && !b.plan.approved && b.plan.proposed > 0 ? 1 : 0);
function stampText(a: OsApprovalStamp, c: Ctx) {
  if (a.auto) return c.t.stampAuto(a.at ?? "07:00");
  const by = a.by && c.t.actor[a.by] ? c.t.actor[a.by] : nameOfM(c.people.find((p) => p.id === a.by), c.lang);
  return c.t.stamp(by, a.at ?? "");
}

function Progress({ t, p }: { t: Dict; p: OsBoard["progress"] }) {
  if (!p.total) return <p data-progress="" className={`${META} text-[16px]`}>{t.noneToday}</p>;
  const pc = (n: number) => `${(n / p.total) * 100}%`;
  // «Принято» neutral taupe, «Ждёт» a dashed outline (bus 85 M5) — blue stays for «Спринт» only.
  const segs: [Col, string, number][] = [["done", "var(--ok)", p.done], ["in_progress", "var(--accent)", p.in_progress], ["accepted", "var(--wait-border)", p.accepted], ["waiting", "transparent", p.waiting]];
  const dashed = (k: Col) => (k === "waiting" ? { border: "1.5px dashed var(--wait-border)", boxSizing: "border-box" as const } : {});
  return (
    <div data-progress="" className="w-full max-w-sm">
      <p className="flex items-baseline justify-between text-[14px] text-[var(--muted)]"><span>{t.today}</span><span><b className="font-serif text-[22px] font-normal text-[var(--foreground)]">{p.done}</b> {t.of} {p.total} {t.ready}</span></p>
      <div aria-hidden="true" className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[var(--surface)]">{segs.map(([k, col, n]) => <i key={k} data-seg={k} className="block h-full rounded-[2px]" style={{ width: pc(n), background: col, ...(n ? dashed(k) : {}) }} />)}</div>
      {/* the text equivalent of the bar — state is never colour-only */}
      <p data-bar-text="" className="mt-2 text-[14px] text-[var(--text-secondary)]">{t.barText(p)}</p>
    </div>
  );
}

/** Parents: «Нужно твоё решение: N» with one-line items, or a calm line when there is nothing to decide. */
function Inbox({ c, board, startOpen = false }: { c: Ctx; board: OsBoard; startOpen?: boolean }) {
  const { t } = c;
  const [open, setOpen] = useState(startOpen);
  const items: string[] = (board.needs_decision ?? []).map((x) => { const w = nameOfM(c.people.find((p) => p.id === x.assignee_id), c.lang); return x.why === "not_accepted" ? t.inboxLate(w, x.title) : t.inboxCant(w, x.title); });
  const planDue = board.plan && board.plan.ready && !board.plan.approved && board.plan.proposed > 0;
  if (planDue) items.push(t.inboxPlan);
  if (!items.length) return (
    <p data-inbox="calm" className="mt-6 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--ok-soft)] px-4 py-3 text-[15px] text-[var(--ok)]">
      <span aria-hidden="true" className="font-bold">✓</span>{t.calm}{board.progress.waiting === 0 && board.progress.total > 0 ? ` ${t.calmAll}` : ""}
    </p>
  );
  // «Разобрать» opens the decisions right here, full width (bus 85 L7 — no second «Нужно решение» block below).
  const decisions = board.needs_decision ?? [];
  return (
    <section data-inbox="open" aria-labelledby="inbox-h" className="mt-6 rounded-xl border border-[var(--warn-border)] bg-[var(--warn-soft)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="inbox-h" className="text-[15px] font-semibold text-[var(--foreground)]">{t.inbox(items.length)}</h2>
        <ul className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-[15px] text-[var(--text-secondary)]">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
        {decisions.length > 0
          ? <button type="button" aria-expanded={open} aria-controls="decide-list" onClick={() => setOpen(!open)} className={primary}>{open ? t.inboxClose : t.inboxGo}</button>
          : <a href="#plan-h" className={primary}>{t.inboxGo}</a>}
      </div>
      {open && decisions.length > 0 && (
        <ul id="decide-list" data-decisions="" aria-label={t.decision} className="mt-3 grid gap-3 md:grid-cols-2">{decisions.map((x) => <DecisionRow key={x.id} c={c} task={x} />)}</ul>
      )}
    </section>
  );
}

function Toolbar({ c, view, setView, who, setWho, tasks, decisions }: { c: Ctx; view: "board" | "list"; setView: (v: "board" | "list") => void; who: "mine" | "kids" | "all"; setWho: (v: "mine" | "kids" | "all") => void; tasks: OsBoardTask[]; decisions: number | null }) {
  const { t } = c;
  const filters: ["mine" | "kids" | "all", string][] = c.parent ? [["mine", t.mine], ["kids", t.kids], ["all", t.all]] : [["mine", t.mine], ["all", t.all]];
  return (
    <div data-toolbar="" className="mt-6 flex flex-wrap items-center gap-3">
      <div role="group" aria-label={t.view} className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
        {(["board", "list"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={seg(view === v)}>{v === "board" ? t.board : t.list}</button>)}
      </div>
      <div role="group" aria-label={t.filter} className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
        {filters.map(([v, l]) => <button key={v} type="button" aria-pressed={who === v} onClick={() => setWho(v)} className={seg(who === v)}>{l}</button>)}
      </div>
      <p data-summary="" className="text-[14px] text-[var(--muted)]">{t.summary(tasks.length, tasks.filter((x) => x.state === "approved").length, decisions)}</p>
    </div>
  );
}

function Strip({ c, members }: { c: Ctx; members: OsBoardMember[] }) {
  const { t, lang } = c;
  return (
    <section aria-labelledby="strip-h" className="mt-8">
      <h2 id="strip-h" className="font-serif text-[22px] text-[var(--foreground)]">{t.strip}</h2>
      <ul aria-live="polite" data-strip="" className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {members.map((m) => (
          <li key={m.id} data-who={m.current ? "busy" : m.waiting ? "waiting" : "free"} data-self={m.id === c.me?.id ? "" : undefined}
            className={`rounded-xl border px-3 py-3 ${m.current ? "border-[var(--accent)] shadow-[inset_3px_0_0_var(--accent)]" : "border-[var(--border)]"} ${m.id === c.me?.id ? "ring-2 ring-[var(--muted-light)] ring-offset-1 ring-offset-[var(--background)]" : ""}`}>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]"><Avatar id={m.id} av={c.av} /><span className="min-w-0 flex-1">{nameOfM(m, lang)}</span>{m.id === c.me?.id ? <span data-you="" className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[14px] font-medium text-[var(--text-secondary)]">{lang === "EN" ? "You" : "Ты"}</span> : null}</p>
            {m.current ? (
              <>
                <p className="mt-2 text-[15px] font-semibold leading-snug text-[var(--accent)]"><span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--accent)] align-[1px] motion-safe:animate-pulse" />{m.current.title}</p>
                <p className="mt-1 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{[m.current.started_at ? `${t.since} ${hhmm(m.current.started_at)}` : "", m.current.co_ids.length ? `${t.with} ${m.current.co_ids.map((x) => nameOfM(c.people.find((p) => p.id === x), lang)).join(", ")}` : "", m.current.kind === "sprint" ? t.tag.sprint.toLowerCase() : ""].filter(Boolean).join(" · ")}</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[15px] text-[var(--text-secondary)]">{m.waiting ? t.waitingN(m.waiting) : m.total ? t.nothing : t.noTasks}</p>
                {m.waiting > 0 && m.kind === "child" ? <p className="mt-1 text-[14px] text-[var(--muted)]">{t.acceptBy}</p> : m.total > 0 ? <p className="mt-1 text-[14px] text-[var(--muted)]">{t.doneOf(m.done, m.total)}</p> : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One card: tag, title, meta; the state in words for screen readers; the card opens the drawer. */
function Card({ c, task, lane }: { c: Ctx; task: OsBoardTask; lane: string }) {
  const { t } = c;
  const col = colOf(task.state);
  const mine = parts(task).includes(c.me?.id ?? "");
  const cls = task.state === "declined" ? "border-[var(--warn-border)] bg-[var(--warn-soft)]"
    : col === "done" ? "border-[var(--border)] bg-[var(--surface)]"
    : col === "in_progress" ? "border-[var(--accent)] shadow-[inset_3px_0_0_var(--accent)]"
    : task.state === "approved" ? "border-dashed border-[var(--wait-border)]" : "border-[var(--border)]";
  const reviewer = task.reviewed_by ? (t.actor[task.reviewed_by] ?? nameOfM(c.people.find((p) => p.id === task.reviewed_by), c.lang)) : "";
  const meta = task.state === "declined" ? [`«${t.cant}»${task.decline_code ? ` — ${task.decline_code === "other" ? task.decline_reason : t.reasons[task.decline_code]}` : ""}`, t.decide]
    : task.state === "in_progress" ? [`${t.since} ${hhmm(task.started_at)}`, withText(task, lane, c)]
    : task.state === "reviewed" ? [reviewer ? t.reviewedBy(reviewer) : t.reviewed, withText(task, lane, c)]
    : [task.state === "approved" ? t.newT : "", whenText(task, t), withText(task, lane, c), task.needs_review && col !== "done" ? t.needsReview : ""];
  const descId = `st-${lane}-${task.id}`;
  return (
    <li data-card={task.state} className={`rounded-lg border px-3 py-2 text-[15px] leading-snug ${cls}`}>
      <button type="button" onClick={() => c.open(task.id)} aria-describedby={`col-${col} ${descId}`} className="block min-h-11 w-full text-left">
        <span className={`block ${col === "done" ? "text-[var(--muted)]" : "text-[var(--foreground)]"}`}>{col === "done" && <span aria-hidden="true" className="mr-1 font-bold text-[var(--ok)]">✓</span>}<Tag task={task} t={t} />{task.title}</span>
        {meta.filter(Boolean).length > 0 && <span className="mt-0.5 block text-[14px] text-[var(--muted)]" suppressHydrationWarning>{meta.filter(Boolean).join(" · ")}</span>}
      </button>
      <span id={descId} className="sr-only">{t.stateSr[task.state] ?? ""}</span>
      {/* in lanes only the compact «Готово» for one's own running task; every other move is in the drawer (bus 85 L6) */}
      {mine && task.state === "in_progress" && <QuickDone c={c} task={task} />}
    </li>
  );
}

/** The one primary move for my task: Принимаю → Начал → Готово. Starting a second task asks to pause the first. */
function Move({ c, task, compact = false, onDone }: { c: Ctx; task: OsBoardTask; compact?: boolean; onDone?: () => void }) {
  const { t } = c;
  const [ask, setAsk] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const action = task.state === "approved" ? "accept" : task.state === "accepted" ? "start" : "done";
  const go = async (body: unknown = {}) => {
    setErr("");
    const r = await osSend("POST", `tasks/${task.id}/${action}`, body);
    if (r?.status === 409) { const j = await r.json().catch(() => ({})); if (j.error === "one_in_progress") { setAsk(j.title ?? ""); return; } if (j.error === "participant_busy") { setErr(t.busy); return; } }
    if (!r?.ok) { setErr(t.error); return; }
    setAsk(null); c.onChange(); onDone?.();
  };
  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      {ask === null ? (
        <button type="button" onClick={() => go()} className={`${action === "done" ? primary : btn} ${compact ? "w-full" : ""}`}>{t.act[action]}</button>
      ) : (
        <div role="group" aria-label={t.pauseQ(ask)} className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-[15px] text-[var(--foreground)]">{t.pauseQ(ask)}</p>
          <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => go({ pause_other: true })}>{t.pauseYes}</button><button type="button" className={btn} onClick={() => setAsk(null)}>{t.cancel}</button></div>
        </div>
      )}
      {err && <p role="status" className="mt-1 text-[14px] text-[var(--muted)]">{err}</p>}
    </div>
  );
}

/** A compact ✓ inside a lane card: one's own running task → «Готово». Full-size buttons stay on Today. */
function QuickDone({ c, task }: { c: Ctx; task: OsBoardTask }) {
  const [err, setErr] = useState(false);
  const go = async () => { const r = await osSend("POST", `tasks/${task.id}/done`); if (r?.ok) c.onChange(); else setErr(true); };
  return (
    <div className="mt-1 flex justify-end">
      <button type="button" data-quick-done="" onClick={go} aria-label={`${c.t.act.done}: ${task.title}`} title={c.t.act.done}
        className="grid h-11 w-11 place-items-center rounded-full border border-[var(--accent)] text-[18px] font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--on-accent)]">✓</button>
      {err && <p role="status" className="sr-only">{c.t.error}</p>}
    </div>
  );
}

/** «Не могу»: inline chips (no modal); free text only for «Другое…». */
function Decline({ c, task, onCancel }: { c: Ctx; task: OsBoardTask; onCancel: () => void }) {
  const { t } = c;
  const [code, setCode] = useState<OsDeclineCode | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState(false);
  const send = async () => { const r = await osSend("POST", `tasks/${task.id}/decline`, code === "other" ? { code, text } : { code }); if (r?.ok) c.onChange(); else setErr(true); };
  return (
    <div data-decline="" className="mt-3 grid gap-2">
      <p className="text-[15px] font-medium text-[var(--foreground)]">{t.whyCant}</p>
      <div role="radiogroup" aria-label={t.whyCant} className="flex flex-wrap gap-2">
        {(Object.keys(t.reasons) as OsDeclineCode[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={code === k} onClick={() => setCode(k)}
            className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-[15px] ${code === k ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--foreground)]"}`}>{t.reasons[k]}</button>
        ))}
      </div>
      {code === "other" && <label className={label}>{t.otherText}<input value={text} onChange={(e) => setText(e.target.value)} maxLength={140} className={field} /></label>}
      <div className="grid grid-cols-2 gap-2"><button type="button" className={btn} onClick={onCancel}>{t.cancel}</button><button type="button" className={primary} disabled={!code || (code === "other" && !text.trim())} onClick={send}>{t.send}</button></div>
      {err && <p role="status" className="text-[14px] text-[var(--muted)]">{t.error}</p>}
    </div>
  );
}

function Review({ c, task }: { c: Ctx; task: OsBoardTask }) {
  const { t } = c;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState(false);
  const go = async (action: "review" | "rework") => { const r = await osSend("POST", `tasks/${task.id}/${action}`, action === "rework" ? { note } : {}); if (r?.ok) c.onChange(); else setErr(true); };
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

function PersonHead({ c, m }: { c: Ctx; m: OsBoardMember }) {
  const { t, lang } = c;
  return (
    <div className="min-w-0">
      <h3 className="text-[15px] font-semibold text-[var(--foreground)]">{nameOfM(m, lang)}</h3>
      <p className="text-[14px] text-[var(--muted)]">{m.kind === "child" ? t.child : t.adult}{m.total ? ` · ${m.done} ${t.of} ${m.total}` : ""}</p>
      {m.total > 0 && <div aria-hidden="true" className="mt-2 h-1 w-28 overflow-hidden rounded-full bg-[var(--surface)]"><i className="block h-full bg-[var(--ok)]" style={{ width: `${(m.done / m.total) * 100}%` }} /></div>}
      {m.routines && <RoutineLine t={t} r={m.routines} />}
    </div>
  );
}
/** A child's routines as one count — only ever present for the child and their routines guardians.
 *  A <div>, not a <p>: the global unlayered `p { text-wrap: pretty }` beats Tailwind's layered `whitespace-nowrap`. */
function RoutineLine({ t, r }: { t: Dict; r: { done: number; total: number } }) {
  if (!r.total) return null; // nothing scheduled today: no empty line (bus 84)
  return (
    <div data-routine-line="" className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap text-[14px] text-[var(--muted)]">
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v7h-9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      {t.routineLine(r.done, r.total)}<span className="sr-only"> ({t.routineNote})</span>
    </div>
  );
}
const nextText = (m: OsBoardMember, c: Ctx) => (m.next ? `${c.t.noTasks} · ${c.t.nearest}: ${m.next.title}, ${shortDate(m.next.date, c.lang)}${whenText(m.next, c.t) ? ` ${whenText(m.next, c.t)}` : ""}` : c.t.noTasks);

function Lanes({ c, board, members }: { c: Ctx; board: OsBoard; members: OsBoardMember[] }) {
  const { t, lang } = c;
  const counts = Object.fromEntries(COLS.map((k) => [k, board.tasks.filter((x) => colOf(x.state) === k).length])) as Record<Col, number>;
  const sorted = [...members].sort((a, b) => (a.id === c.me?.id ? -1 : b.id === c.me?.id ? 1 : 0));
  const busy = sorted.filter((m) => m.total), idle = sorted.filter((m) => !m.total);
  const cards = (m: OsBoardMember, k: Col) => board.tasks.filter((x) => parts(x).includes(m.id) && colOf(x.state) === k);
  return (
    <section aria-label={t.lanesAria} className="mt-8">
      {/* Wide screens: person × 4 columns; the column header is each card's label (aria-describedby). */}
      <div data-lanes="" className="hidden overflow-hidden rounded-xl border border-[var(--border)] lg:block">
        <div className="grid grid-cols-[200px_repeat(4,1fr)] border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="px-3.5 py-2.5 text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{t.who}</div>
          {COLS.map((k) => <div key={k} id={`col-${k}`} className="px-3.5 py-2.5 text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{t.legend[k]} <span className="ml-1 font-medium normal-case tracking-normal">{counts[k]}</span></div>)}
        </div>
        {busy.map((m) => (
          <div key={m.id} data-lane="" className="grid grid-cols-[200px_repeat(4,1fr)] border-b border-[var(--border)] last:border-b-0">
            <div className="flex items-start gap-2.5 border-r border-[var(--border)] p-3"><Avatar id={m.id} av={c.av} /><PersonHead c={c} m={m} /></div>
            {COLS.map((k) => { const list = cards(m, k); return (
              <div key={k} className="border-r border-[var(--border)] p-3 last:border-r-0">
                {list.length ? <ul aria-label={`${nameOfM(m, lang)} — ${t.legend[k]}`} className="grid gap-2">{list.map((x) => <Card key={x.id} c={c} task={x} lane={m.id} />)}</ul>
                  : <span className="text-[14px] text-[var(--muted)]" aria-hidden="true">{t.empty}</span>}
              </div>); })}
          </div>
        ))}
        {/* members with nothing today: one compact full-width row each */}
        {idle.map((m) => (
          <div key={m.id} data-lane="idle" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] px-3 py-2.5 last:border-b-0">
            <Avatar id={m.id} av={c.av} /><span className="text-[15px] font-semibold text-[var(--foreground)]">{nameOfM(m, lang)}</span>
            <span className="text-[14px] text-[var(--muted)]">{nextText(m, c)}</span>
            {m.routines && <RoutineLine t={t} r={m.routines} />}
          </div>
        ))}
      </div>
      {/* Phone / tablet: one accordion per person, self open */}
      <div data-accordion="" className="grid gap-2 lg:hidden">
        {sorted.map((m) => m.total ? (
          <details key={m.id} open={m.id === c.me?.id} className="group rounded-xl border border-[var(--border)] px-3">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
              <Avatar id={m.id} av={c.av} />
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold text-[var(--foreground)]">{nameOfM(m, lang)}</span><span className="block text-[14px] text-[var(--muted)]">{t.doneOf(m.done, m.total)}</span></span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90 motion-reduce:transition-none"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </summary>
            <div className="grid gap-3 pb-3">
              {m.routines && <RoutineLine t={t} r={m.routines} />}
              {COLS.map((k) => { const list = cards(m, k); return list.length ? (
                <div key={k}><h4 id={`col-${k}`} className="text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{t.legend[k]}</h4>
                  <ul className="mt-1.5 grid gap-2">{list.map((x) => <Card key={x.id} c={c} task={x} lane={m.id} />)}</ul></div>
              ) : null; })}
            </div>
          </details>
        ) : (
          <p key={m.id} data-lane="idle" className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2.5 text-[14px] text-[var(--muted)]">
            <Avatar id={m.id} av={c.av} /><span className="text-[15px] font-semibold text-[var(--foreground)]">{nameOfM(m, lang)}</span>{nextText(m, c)}
          </p>
        ))}
      </div>
    </section>
  );
}

/** «Список»: one row per task, sorted by time (a clock time or a human slot). */
function ListView({ c, tasks }: { c: Ctx; tasks: OsBoardTask[] }) {
  const { t, lang } = c;
  const sorted = [...tasks].sort((a, b) => minuteOf(a) - minuteOf(b));
  return (
    <ul data-list="" className="mt-8 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
      {sorted.map((x) => (
        <li key={x.id} data-row={x.state}>
          <button type="button" onClick={() => c.open(x.id)} className="grid min-h-14 w-full grid-cols-[96px_1fr] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-left sm:grid-cols-[120px_1fr_200px_140px]">
            <span className="text-[14px] text-[var(--muted)]">{whenText(x, t) || "—"}</span>
            <span className="text-[15px] text-[var(--foreground)]"><Tag task={x} t={t} />{x.title}</span>
            <span className="col-start-2 text-[14px] text-[var(--text-secondary)] sm:col-start-auto">{parts(x).map((p) => nameOfM(c.people.find((q) => q.id === p), lang)).join(", ")}</span>
            <span className="col-start-2 text-[14px] text-[var(--muted)] sm:col-start-auto">{t.stateSr[x.state] ?? ""}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The task drawer: facts, actions, history. Side panel on wide screens, a full sheet on a phone. */
function Drawer({ c, id, onClose }: { c: Ctx; id: string; onClose: () => void }) {
  const { t, lang } = c;
  const [data, setData] = useState<{ task: OsBoardTask; can: string[]; history: OsTaskHistory; photo?: OsTaskPhoto } | null>(null);
  const [declining, setDeclining] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  const load = useCallback(() => {
    fetch(`/api/family-os/tasks/${id}`, { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setData(d); }).catch(() => {});
  }, [id]);
  // Once per opened task: focus the close button, Esc closes, focus returns to the card on close.
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", k);
    load();
    return () => { document.removeEventListener("keydown", k); back?.focus?.(); };
  }, [load]);
  const inner: Ctx = { ...c, onChange: () => { c.onChange(); load(); setDeclining(false); } };
  const x = data?.task;
  const name = (pid: string | null) => (!pid ? t.drawer.none : t.actor[pid] ?? nameOfM(c.people.find((p) => p.id === pid), lang));
  const dayLabel = (iso: string) => { const d = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/London" }); const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const y = new Date(Date.parse(`${today}T12:00:00Z`) - 86400_000).toISOString().slice(0, 10); return d === today ? t.todayW : d === y ? t.yesterday : shortDate(d, lang); };
  const can = new Set(data?.can ?? []);  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label={t.drawer.close} tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div role="dialog" aria-modal="true" aria-labelledby="drawer-h" data-drawer="" className="relative flex h-full w-full flex-col overflow-y-auto bg-[var(--background)] p-5 shadow-xl sm:max-w-md">
        <div className="flex items-start justify-between gap-3">
          <h2 id="drawer-h" className="font-serif text-[24px] leading-tight text-[var(--foreground)]">{x ? <><Tag task={x} t={t} />{x.title}</> : "…"}</h2>
          <button ref={closeRef} type="button" onClick={onClose} className={btn}>{t.drawer.close}</button>
        </div>
        {x && (
          <>
            <p className="mt-2"><StateChip t={t} state={x.state} /></p>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><dt className="text-[14px] text-[var(--muted)]">{t.drawer.assignee}</dt><dd className="text-[15px] font-semibold text-[var(--foreground)]">{name(x.assignee_id)}{x.co_ids.length ? <span className="block font-normal text-[var(--text-secondary)]">{t.with} {x.co_ids.map(name).join(", ")}</span> : null}</dd></div>
              <div><dt className="text-[14px] text-[var(--muted)]">{t.drawer.accountable}</dt><dd className="text-[15px] font-semibold text-[var(--foreground)]">{name(x.accountable_id)}</dd></div>
              <div><dt className="text-[14px] text-[var(--muted)]">{t.drawer.due}</dt><dd className="text-[15px] font-semibold text-[var(--foreground)]">{[whenText(x, t), x.estimate_min ? t.est(x.estimate_min) : ""].filter(Boolean).join(" · ") || t.drawer.none}</dd></div>
            </dl>
            {x.rework_note && <p className="mt-3 text-[15px] text-[var(--text-secondary)]">{t.act.rework}: {x.rework_note}</p>}
            {/* exactly the moves the service allows this viewer (bus 85 #9) */}
            {declining ? <Decline c={inner} task={x} onCancel={() => setDeclining(false)} /> : <DrawerActions c={inner} task={x} can={can} onDecline={() => setDeclining(true)} />}
            {(can.has("review") || can.has("rework")) && <Review c={inner} task={x} />}
            {x.needs_review && <p className={`${META} mt-3`}>{t.drawer.reviewNote}</p>}
            {x.needs_review && data?.photo && (data.photo.can_add || data.photo.has) && <TaskPhoto c={inner} task={x} photo={data.photo} onDone={load} />}
            <h3 className="mt-6 font-serif text-[20px] text-[var(--foreground)]">{t.drawer.history}</h3>
            <ol data-history="" className="mt-2 grid gap-2 border-l border-[var(--border)] pl-4">
              {[...(data?.history ?? [])].reverse().map((h, i) => (
                <li key={i} className="text-[15px] text-[var(--foreground)]" suppressHydrationWarning>
                  {t.step[h.step] ?? h.step}{h.step === "proposed" && h.origin ? ` ${t.origin[h.origin]}` : ""}
                  <span className="block text-[14px] text-[var(--muted)]">{dayLabel(h.at)}, {hhmm(h.at)} · {name(h.by)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

type OsTaskPhoto = { can_add: boolean; has?: boolean; delete_after?: string };

/** bus 97 item 4: the optional photo for a task on review. Never required. Parents see it (with the date it
 *  deletes itself); the person doing the task may add or replace it but is not shown it back. */
function TaskPhoto({ c, task, photo, onDone }: { c: Ctx; task: OsBoardTask; photo: OsTaskPhoto; onDone: () => void }) {
  const { t, lang } = c;
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState(0); // bumps the image URL after a replace
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) return setMsg(t.drawer.photoBig);
    setBusy(true); setMsg("");
    const r = await fetch(`/api/family-os/tasks/${task.id}/photo`, { method: "POST", body: f, credentials: "same-origin", cache: "no-store" }).catch(() => null);
    setBusy(false);
    if (r?.status === 201) { const d = ((await r.json().catch(() => ({}))) as { delete_after?: string }).delete_after; setMsg(d ? t.drawer.photoAdded(day(d)) : ""); setV((n) => n + 1); onDone(); }
    else setMsg(r?.status === 413 ? t.drawer.photoBig : r?.status === 415 ? t.drawer.photoKind : t.drawer.photoErr);
  };
  return (
    <section aria-labelledby={`photo-${task.id}`} data-task-photo="" className="mt-4 rounded-lg border border-[var(--border)] px-4 py-3">
      <h3 id={`photo-${task.id}`} className="text-[16px] font-semibold text-[var(--foreground)]">{t.drawer.photo}</h3>
      {photo.has && photo.delete_after && (
        <figure className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request image behind the family gate; never optimised or cached */}
          <img src={`/api/family-os/tasks/${task.id}/photo?v=${v}`} alt={t.drawer.photoAlt} className="max-h-72 w-auto rounded-md border border-[var(--border)]" />
          <figcaption className="mt-1 text-[14px] text-[var(--text-secondary)]">{t.drawer.photoSeen(day(photo.delete_after))}</figcaption>
        </figure>
      )}
      {photo.can_add && (
        <>
          <p className="mt-1 text-[15px] text-[var(--text-secondary)]">{t.drawer.photoHint}</p>
          <label className={`${btn} mt-3 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)] ${busy ? "opacity-60" : ""}`}>
            {photo.has ? t.drawer.photoReplace : t.drawer.photoAdd}
            <input type="file" accept="image/jpeg,image/png,image/heic,.heic" onChange={pick} disabled={busy} className="sr-only" data-photo-input="" />
          </label>
        </>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-[14px] text-[var(--text-secondary)]">{msg}</p>
    </section>
  );
}

function StateChip({ t, state }: { t: Dict; state: OsBoardTask["state"] }) {
  const tone = state === "in_progress" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : state === "done" || state === "reviewed" ? "bg-[var(--ok-soft)] text-[var(--ok)]"
    : state === "declined" ? "bg-[var(--warn-soft)] text-[var(--foreground)] ring-1 ring-[var(--warn-border)]" : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)]";
  return <span data-state-chip={state} className={`inline-flex items-center rounded-full px-2.5 py-1 text-[14px] font-medium ${tone}`}>{((x) => x.charAt(0).toUpperCase() + x.slice(1))(t.stateSr[state] ?? state)}</span>;
}

/** The drawer's moves, from the service's `can` list: the primary move (with the pause prompt), then Не могу ·
 *  Готово · Пауза · Передать… · На завтра · Снять — whichever this viewer may make now. */
function DrawerActions({ c, task, can, onDecline }: { c: Ctx; task: OsBoardTask; can: Set<string>; onDecline: () => void }) {
  const { t } = c;
  const [to, setTo] = useState(c.people.find((m) => m.id !== task.assignee_id)?.id ?? task.assignee_id);
  const [err, setErr] = useState(false);
  const go = async (action: string, body: unknown = {}) => { setErr(false); const r = await osSend("POST", `tasks/${task.id}/${action}`, body); if (r?.ok) c.onChange(); else setErr(true); };
  const primary = (task.state === "approved" && can.has("accept")) || (task.state === "accepted" && can.has("start")) || (task.state === "in_progress" && can.has("done"));
  const extra: [string, string][] = [];
  if (can.has("done") && task.state === "accepted") extra.push(["done", t.act.done]);
  if (can.has("pause")) extra.push(["pause", t.act.pause]);
  if (can.has("carry")) extra.push(["carry", t.toTomorrow]);
  if (can.has("cancel")) extra.push(["cancel", t.cancelTask]);
  if (!primary && !extra.length && !can.has("decline") && !can.has("reassign")) return null;
  return (
    <div data-drawer-actions="" className="mt-4 grid gap-2">
      {primary && <Move c={c} task={task} />}
      {(can.has("decline") || extra.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {can.has("decline") && <button type="button" className={btn} onClick={onDecline}>{t.cant}</button>}
          {extra.map(([a, l]) => <button key={a} type="button" className={btn} onClick={() => go(a)}>{l}</button>)}
        </div>
      )}
      {can.has("reassign") && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <AssigneeSelect c={c} value={to} onChange={setTo} labelText={t.whoDoes} />
          <button type="button" className={btn} onClick={() => go("reassign", { assignee_id: to })}>{t.reassign}</button>
        </div>
      )}
      {err && <p role="status" className="text-[14px] text-[var(--muted)]">{t.error}</p>}
    </div>
  );
}

function AssigneeSelect({ c, value, onChange, labelText }: { c: Ctx; value: string; onChange: (v: string) => void; labelText: string }) {
  return <label className={label}>{labelText}<select value={value} onChange={(e) => onChange(e.target.value)} className={field}>{c.people.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, c.lang)}</option>)}</select></label>;
}

function DecisionRow({ c, task }: { c: Ctx; task: OsBoardTask }) {
  const { t, lang } = c;
  const [to, setTo] = useState(c.people.find((m) => m.id !== task.assignee_id)?.id ?? task.assignee_id);
  const [err, setErr] = useState(false);
  const who = c.people.find((m) => m.id === task.assignee_id);
  const go = async (action: "reassign" | "carry" | "cancel") => { const r = await osSend("POST", `tasks/${task.id}/${action}`, action === "reassign" ? { assignee_id: to } : {}); if (r?.ok) c.onChange(); else setErr(true); };
  const why = task.why === "not_accepted" ? t.lateWhy : task.decline_code === "other" ? task.decline_reason : task.decline_code ? t.reasons[task.decline_code] : "—";
  return (
    <li data-decision={task.why ?? "declined"} className="rounded-xl border border-[var(--warn-border)] bg-[var(--warn-soft)] p-4">
      <p className="text-[16px] font-semibold text-[var(--foreground)]">{who ? `${nameOfM(who, lang)}: ` : ""}«{task.title}»</p>
      <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{t.reason}: {why}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <AssigneeSelect c={c} value={to} onChange={setTo} labelText={t.whoDoes} />
        <button type="button" className={primary} onClick={() => go("reassign")}>{t.reassign}</button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" className={btn} onClick={() => go("carry")}>{t.toTomorrow}</button><button type="button" className={btn} onClick={() => go("cancel")}>{t.cancelTask}</button></div>
      {err && <p role="status" className="mt-1 text-[14px] text-[var(--muted)]">{t.error}</p>}
    </li>
  );
}

function CarryOffer({ c, tasks }: { c: Ctx; tasks: OsBoardTask[] }) {
  const { t, lang } = c;
  const [err, setErr] = useState(false);
  const carry = async (ids: string[]) => { const rs = await Promise.all(ids.map((id) => osSend("POST", `tasks/${id}/carry`))); if (!rs.every((r) => r?.ok)) setErr(true); c.onChange(); };
  return (
    <section aria-labelledby="carry-h" data-carry="" className={`mt-8 ${panel}`}>
      <h2 id="carry-h" className="font-serif text-[22px] text-[var(--foreground)]">{t.carry}</h2>
      <p className={`${META} mt-1`}>{t.carryHint}</p>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {tasks.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-[15px] text-[var(--foreground)]"><Tag task={x} t={t} />{x.title}<span className="text-[var(--muted)]"> · {parts(x).map((p) => nameOfM(c.people.find((m) => m.id === p), lang)).join(", ")}</span></span>
            <button type="button" className={btn} onClick={() => carry([x.id])}>{t.toTomorrow}</button>
          </li>))}
      </ul>
      {tasks.length > 1 && <button type="button" className={`${primary} mt-3`} onClick={() => carry(tasks.map((x) => x.id))}>{t.carryAll}</button>}
      {err && <p role="status" className="mt-1 text-[14px] text-[var(--muted)]">{t.error}</p>}
    </section>
  );
}

/** Time OR a human slot, plus an optional estimate — the shared «когда» inputs. */
function WhenInputs({ c, prefix = "" }: { c: Ctx; prefix?: string }) {
  const { t } = c;
  return (
    <>
      <label className={label}>{t.time}<input name={`${prefix}due_time`} type="time" className={field} /></label>
      <label className={label}>{t.when}<select name={`${prefix}when_slot`} defaultValue="" className={field}><option value="">{t.anyTime}</option>{(Object.keys(t.slot) as OsWhenSlot[]).map((k) => <option key={k} value={k}>{t.slot[k]}</option>)}</select></label>
      <label className={label}>{t.estimate}<input name={`${prefix}estimate_min`} type="number" min={1} max={600} inputMode="numeric" className={field} /></label>
    </>
  );
}
const whenBody = (f: FormData) => ({ due_time: f.get("due_time") || null, when_slot: f.get("due_time") ? null : f.get("when_slot") || null, estimate_min: f.get("estimate_min") ? Number(f.get("estimate_min")) : null });

type Row = { id: string; include: boolean; assignee_id: string; due_time: string };
function PlanPanel({ c, summary, plan }: { c: Ctx; summary: NonNullable<OsBoard["plan"]>; plan: OsPlan | null }) {
  const { t, lang } = c;
  const router = useRouter();
  const tasks = plan?.tasks ?? [];
  const approved = Boolean(plan?.approval ?? summary.approved);
  const [rows, setRows] = useState<Row[]>(tasks.map((x) => ({ id: x.id, include: true, assignee_id: x.assignee_id, due_time: x.due_time ?? "" })));
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const n = rows.filter((r) => r.include).length;
  const approve = async () => {
    const r = await osSend("PUT", `plan/${summary.date}`, { items: rows });
    if (r?.status === 409) { const j = await r.json().catch(() => ({})); setMsg(j.approval ? stampText(j.approval, c) : t.error); router.refresh(); return; }
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh();
  };
  const edit = async (id: string, body: unknown) => { const r = await osSend("PATCH", `plan/${summary.date}/tasks/${id}`, body); setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh(); };
  const build = async () => { const r = await osSend("POST", `plan/${summary.date}/build`); setMsg(r?.ok ? "" : t.error); if (r?.ok) router.refresh(); };
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
    const co = String(f.get("co_id") ?? "");
    const r = await osSend("POST", `plan/${summary.date}/tasks`, { title: String(f.get("title") ?? "").trim(), assignee_id: f.get("assignee_id"), co_ids: co && co !== f.get("assignee_id") ? [co] : [], ...whenBody(f) });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { form.reset(); router.refresh(); }
  };
  const nameById = (id: string) => nameOfM(c.people.find((p) => p.id === id), lang);
  return (
    <section aria-labelledby="plan-h" data-plan="" className={`${panel} scroll-mt-24`}>
      <h2 id="plan-h" className="font-serif text-[22px] text-[var(--foreground)]" suppressHydrationWarning>{t.plan} — {longDate(summary.date, lang).replace(/^./, (ch) => ch.toLowerCase())}</h2>
      {approved ? (
        <>
          <p role="status" data-plan-stamp="" className="mt-2 text-[16px] text-[var(--foreground)]">{plan?.approval ? stampText(plan.approval, c) : t.saved}</p>
          <ul data-plan-approved="" className="mt-2 divide-y divide-[var(--border)]">
            {tasks.map((x) => (
              <li key={x.id} className="grid gap-2 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="text-[15px] text-[var(--foreground)]"><Tag task={x} t={t} />{x.title}<span className="text-[var(--muted)]"> · {parts(x).map(nameById).join(", ")}{whenText(x, t) ? ` · ${whenText(x, t)}` : ""}</span></span>
                {editing && (
                  <span className="flex flex-wrap gap-2">
                    <select aria-label={`${t.whoDoes}: ${x.title}`} defaultValue={x.assignee_id} onChange={(e) => edit(x.id, { assignee_id: e.target.value })} className={`${field} mt-0 w-auto`}>{c.people.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, lang)}</option>)}</select>
                    <button type="button" className={btn} onClick={() => edit(x.id, { include: false })}>{t.remove}</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={btn} aria-pressed={editing} onClick={() => setEditing(!editing)}>{editing ? t.editDone : t.edit}</button>
            <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
          </div>
          {editing && <p className={`${META} mt-2`}>{t.editNote}</p>}
        </>
      ) : (
        <>
          <p className={`${META} mt-1`}>{t.planHint}</p>
          {tasks.length === 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-[16px] text-[var(--text-secondary)]">{t.planEmpty}</p><button type="button" className={btn} onClick={build}>{t.planBuild}</button></div>
          ) : (
            <ul data-plan-rows="" className="mt-2 divide-y divide-[var(--border)]">
              {tasks.map((x) => { const r = rows.find((y) => y.id === x.id)!; return (
                <li key={x.id} data-plan-row={r.include ? "in" : "out"} className="grid grid-cols-[44px_1fr] items-center gap-x-2 gap-y-2 py-2.5 xl:grid-cols-[44px_1fr_minmax(22ch,auto)_120px]">
                  <label className="grid h-11 w-11 cursor-pointer place-items-center"><input type="checkbox" checked={r.include} onChange={(e) => set(x.id, { include: e.target.checked })} aria-label={`${t.include}: ${x.title}`} className="h-5 w-5 accent-[var(--accent)]" /></label>
                  <span className={`text-[15px] ${r.include ? "text-[var(--foreground)]" : "text-[var(--muted)] line-through"}`}><Tag task={x} t={t} />{x.title}{x.co_ids.length ? <span className="text-[14px] text-[var(--muted)]"> · {t.with} {x.co_ids.map(nameById).join(", ")}</span> : null}{x.when_slot && !r.due_time ? <span className="text-[14px] text-[var(--muted)]"> · {t.slot[x.when_slot]}</span> : null}{x.origin === "carry" && <span className="text-[14px] text-[var(--muted)]"> ({t.carried})</span>}</span>
                  <select aria-label={`${t.whoDoes}: ${x.title}`} value={r.assignee_id} onChange={(e) => set(x.id, { assignee_id: e.target.value })} className={`${field} col-start-2 mt-0 min-w-[22ch] xl:col-start-auto`}>{c.people.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, lang)}</option>)}</select>
                  <input type="time" aria-label={`${t.time}: ${x.title}`} value={r.due_time} onChange={(e) => set(x.id, { due_time: e.target.value })} className={`${field} col-start-2 mt-0 max-w-[10rem] xl:col-start-auto xl:max-w-none`} />
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
        <form onSubmit={add} className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className={`${label} sm:col-span-3`}>{t.what}<input name="title" required maxLength={160} className={field} /></label>
          <label className={label}>{t.whoDoes}<select name="assignee_id" className={field}>{c.people.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, lang)}</option>)}</select></label>
          <label className={label}>{t.together}<select name="co_id" defaultValue="" className={field}><option value="">{t.nobody}</option>{c.people.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, lang)}</option>)}</select></label>
          <span className="hidden sm:block" />
          <WhenInputs c={c} />
          <div className="sm:col-span-3"><button type="submit" className={primary}>{t.add}</button></div>
        </form>
      </Disclosure>
      <p className={`${META} mt-3`}>{t.planNote}</p>
    </section>
  );
}

/** Family totals only. With no goals this collapses to one muted line (no empty tiles). */
export function SprintPanel({ t, lang, weekStart, goals }: { t: Dict; lang: Lang; weekStart: string; goals: OsSprintGoal[] }) {
  const end = new Date(Date.parse(`${weekStart}T12:00:00Z`) + 6 * 86400_000).toISOString().slice(0, 10);
  if (!goals.length) return (
    <p data-sprint="empty" className={`${META} self-start text-[15px]`}>{t.sprintNone} <Link href={`/${lang === "EN" ? "en" : "ru"}/family/os/council`} className="inline-flex min-h-11 items-center underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.toCouncil}</Link></p>
  );
  return (
    <section aria-labelledby="sprint-h" data-sprint="" className={panel}>
      <h2 id="sprint-h" className="font-serif text-[22px] text-[var(--foreground)]">{t.sprint}</h2>
      <p className={`${META} mt-1`} suppressHydrationWarning>{fmtWeekRange(weekStart, end, lang)} · {t.sprintHint}</p>
      <ul className="mt-2 divide-y divide-[var(--border)]">
        {goals.map((g) => (
          <li key={g.id} data-goal="" className="py-3">
            <p className="flex items-center justify-between gap-3 text-[15px]"><b className="font-semibold text-[var(--foreground)]">{g.title}</b><span className="text-[14px] text-[var(--muted)]">{g.done} {t.of} {g.total}</span></p>
            <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface)]"><i className="block h-full bg-[var(--sprint)]" style={{ width: g.total ? `${(g.done / g.total) * 100}%` : "0%" }} /></div>
          </li>
        ))}
      </ul>
      <p className={`${META} mt-3`}>{t.sprintNote}</p>
      <Link href={`/${lang === "EN" ? "en" : "ru"}/family/os/council`} className="mt-1 inline-flex min-h-11 items-center text-[15px] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.toCouncil}</Link>
    </section>
  );
}

function Templates({ c, templates }: { c: Ctx; templates: OsTemplate[] }) {
  const { t, lang } = c;
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [rot, setRot] = useState(false);
  const drafts = templates.filter((x) => !x.active);
  const nameById = (id: string) => nameOfM(c.people.find((x) => x.id === id), lang);
  const activate = async () => { const r = await osSend("POST", "templates/activate", { ids: drafts.map((x) => x.id) }); setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh(); };
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
    const mask = [0, 1, 2, 3, 4, 5, 6].map((i) => (f.get(`d${i}`) ? "1" : "0")).join("");
    const who = f.getAll("who").map(String);
    const r = await osSend("POST", "templates", { title: String(f.get("title") ?? "").trim(), mask, ...(rot ? { members: who } : { assignee_id: who[0] }), ...whenBody(f), needs_review: Boolean(f.get("needs_review")) });
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
              <span className="text-[16px] text-[var(--foreground)]">{x.title}<span className="block text-[14px] text-[var(--muted)]">{[maskText(x.mask, t), whenText(x, t), x.estimate_min ? t.est(x.estimate_min) : "", x.members?.length ? x.members.map(nameById).join(" → ") : nameById(x.assignee_id ?? "")].filter(Boolean).join(" · ")}</span></span>
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
        <form onSubmit={add} className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className={`${label} sm:col-span-3`}>{t.what}<input name="title" required maxLength={160} className={field} /></label>
          <fieldset className="sm:col-span-3"><legend className={label}>{t.days}</legend>
            <div className="mt-1 flex flex-wrap gap-1">{t.dayNames.map((d, i) => <label key={d} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-2 text-[15px]"><input type="checkbox" name={`d${i}`} defaultChecked className="h-4 w-4 accent-[var(--accent)]" />{d}</label>)}</div>
          </fieldset>
          <label className="flex min-h-11 items-center gap-3 text-[16px] sm:col-span-3"><input type="checkbox" checked={rot} onChange={(e) => setRot(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />{t.rotation}</label>
          <label className={`${label} sm:col-span-3`}>{t.whoDoes}<select name="who" multiple={rot} required className={`${field} ${rot ? "min-h-28" : ""}`}>{c.people.map((m) => <option key={m.id} value={m.id}>{nameOfM(m, lang)}</option>)}</select></label>
          <WhenInputs c={c} />
          <label className="flex min-h-11 items-center gap-3 text-[16px] sm:col-span-3"><input type="checkbox" name="needs_review" className="h-5 w-5 accent-[var(--accent)]" />{t.review}</label>
          <div className="sm:col-span-3"><button type="submit" className={primary}>{t.add}</button></div>
        </form>
      </Disclosure>
    </section>
  );
}

/** Today: parents' decision line; «Новые задачи» (Принимаю / Не могу / Принять все) above «Мои задачи»
 *  (one primary move; the quiet «Ещё в работе?» only to the person doing it); «Мой распорядок N из M» under them. */
export function TodayBoard({ lang, data, board, me }: { lang: Lang; data: OsMyBoard; board: OsBoard | null; me: { id: string; kind: string } | null; routines: { done: number; total: number } | null }) {
  const t = T[lang];
  const router = useRouter();
  const [err, setErr] = useState(false);
  const [cant, setCant] = useState<string | null>(null);
  const people: Person[] = board?.members ?? [];
  const c: Ctx = { t, lang, me, people, av: avatarsFor(people, lang), parent: Boolean(board?.can.approve), onChange: () => router.refresh(), open: () => {} };
  const done = data.mine.filter((x) => x.state === "done" || x.state === "reviewed").length;
  const L = lang === "EN"
    ? { newH: "New tasks", wait: (n: number) => `${n} waiting for you`, all: (n: number) => `Accept all (${n})`, mineH: "My tasks", of: (d: number, n: number) => `${d} of ${n} done`, routine: (d: number, n: number) => `My routine ${d} of ${n}`, chip: { accepted: "Accepted", in_progress: "In progress", done: "Done", reviewed: "Checked", declined: "Parents decide" } }
    : { newH: "Новые задачи", wait: (n: number) => `${n} ждут тебя`, all: (n: number) => `Принять все (${n})`, mineH: "Мои задачи", of: (d: number, n: number) => `${d} из ${n} готово`, routine: (d: number, n: number) => `Мой распорядок ${d} из ${n}`, chip: { accepted: "Принято", in_progress: "В работе", done: "Готово", reviewed: "Проверено", declined: "Решают родители" } };
  const acceptAll = async () => { const r = await osSend("POST", "tasks/accept-all"); if (r?.ok) router.refresh(); else setErr(true); };
  const answer = async (id: string, action: "done" | "continue") => { const r = await osSend("POST", `tasks/${id}/${action}`); if (r?.ok) router.refresh(); else setErr(true); };
  return (
    <div data-today-board="">
      {c.parent && board && <Inbox c={c} board={board} />}
      {data.new.length > 0 && (
        <section aria-labelledby="new-h" data-new-tasks="" className="mt-8">
          <h2 id="new-h" className="flex items-baseline justify-between gap-3 font-serif text-[22px] text-[var(--foreground)]">{L.newH}<span className="font-sans text-[14px] text-[var(--muted)]">{L.wait(data.new.length)}</span></h2>
          <ul className="mt-2 grid gap-3">
            {data.new.map((x) => (
              <li key={x.id} data-new-task="" className="rounded-xl border border-[var(--border)] p-3.5">
                <p className="text-[16px] font-semibold text-[var(--foreground)]"><Tag task={x} t={t} />{x.title}</p>
                {[whenText(x, t), withText(x, me?.id ?? null, c)].filter(Boolean).length > 0 && <p className="mt-0.5 text-[14px] text-[var(--muted)]">{[whenText(x, t), withText(x, me?.id ?? null, c)].filter(Boolean).join(" · ")}</p>}
                {cant === x.id ? <Decline c={c} task={x} onCancel={() => setCant(null)} /> : (
                  <div className="mt-3 grid grid-cols-2 gap-2"><AcceptButton c={c} task={x} /><button type="button" className={btn} onClick={() => setCant(x.id)}>{t.cant}</button></div>
                )}
              </li>
            ))}
          </ul>
          {data.new.length > 1 && <button type="button" className={`${btn} mt-3 w-full`} onClick={acceptAll}>{L.all(data.new.length)}</button>}
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
                <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{[x.state === "in_progress" && x.started_at ? `${t.since} ${hhmm(x.started_at)}` : whenText(x, t), withText(x, me?.id ?? null, c), x.estimate_min ? t.est(x.estimate_min) : ""].filter(Boolean).join(" · ")}</p>
                {x.rework_note && <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{t.act.rework}: {x.rework_note}</p>}
                {x.nudge ? (
                  <div data-nudge="" className="mt-3 rounded-lg border border-[var(--border)] p-3">
                    <p className="text-[15px] text-[var(--foreground)]">{t.nudgeQ}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" className={primary} onClick={() => answer(x.id, "done")}>{t.act.done}</button><button type="button" className={btn} onClick={() => answer(x.id, "continue")}>{t.nudgeGoOn}</button></div>
                  </div>
                ) : (x.state === "accepted" || x.state === "in_progress") && <Move c={c} task={x} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* «Мой распорядок» (circles) follows right below as its own section (bus 85 order) */}
      {err && <p role="status" className="mt-1 text-[14px] text-[var(--muted)]">{t.error}</p>}
    </div>
  );
}
function AcceptButton({ c, task }: { c: Ctx; task: OsBoardTask }) {
  const [err, setErr] = useState(false);
  const go = async () => { const r = await osSend("POST", `tasks/${task.id}/accept`); if (r?.ok) c.onChange(); else setErr(true); };
  return <><button type="button" className={primary} onClick={go}>{c.t.act.accept}</button>{err && <p role="status" className="col-span-2 text-[14px] text-[var(--muted)]">{c.t.error}</p>}</>;
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
      {totals.n > 0 ? (
        <div data-sprint-review="" className={`mt-6 ${panel}`}>
          <h3 className="font-serif text-[20px] text-[var(--foreground)]">{L.review}</h3>
          <p className="mt-1 text-[16px] text-[var(--foreground)]">{L.reviewLine(totals.d, totals.n)}</p>
          <p className={`${META} mt-1`}>{t.sprintNote}</p>
        </div>
      ) : <p data-sprint-review="empty" className={`${META} mt-4`}>{t.sprintNote}</p>}
    </section>
  );
}
