"use client";

/**
 * «Решения» (bus 172 P3, mockup v5) on the council address. Two cards on top:
 *  - «Ждут голоса»: what waits for a parent today, from the board's queue (a «Не могу» or a task not accepted by 12:00,
 *    and tomorrow's plan before approval). Family OS has no voting; either parent decides with the moves it already has
 *    (hand over · tomorrow · remove; approve the plan). The panel on the right makes them.
 *  - «Принято»: the decisions of this council and the one before, and the plan approvals the board stamps.
 * Below, the family council itself (Stage 3b, bus 79; plan §3.6): Sunday 19:00, the agenda in family totals only, the
 * principle, recognitions, notes, «Добавить решение» and the sprint. Adults keep notes and turn decisions into tasks
 * with an owner and a date; everyone reads; a task is ticked by its owner or an adult. Lists come from
 * app/lib/family-decisions.mjs, on the server.
 */
import { CouncilPrinciple, RecognitionList, KODEKS_T } from "./FamilyKodeks";
import type { OsRecognition, OsKodeksPrinciple, OsDeclineCode } from "../lib/family-os";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Disclosure from "./Disclosure";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { fmtFamilyDate, fmtWeekRange } from "../lib/family-docs.mjs";
import { Check } from "./FamilyRoutines";
import { ruPlural } from "../lib/family-routines.mjs";
import { approvePlanBody } from "../lib/family-decisions.mjs";
import { H1, META } from "../lib/typeScale";
import { BTN_PRIMARY, BTN_SECONDARY, OS_H2, OS_H3, RULE_VALUES } from "../lib/family-ui";
import { tx, typograph } from "../lib/typograph.mjs";
import type { OsCouncil, OsPerson, OsSprint } from "../lib/family-os";
import { CouncilSprint } from "./FamilyBoard";

type Lang = "EN" | "RU";
export type PendingDecision =
  | { key: string; type: "task"; id: string; title: string; date: string; assigneeId: string; who: string; why: "declined" | "not_accepted"; code: OsDeclineCode | null; reason: string }
  | { key: string; type: "plan"; id: string; title: null; date: string; count: number; tasks: { id: string; title: string; who: string; time: string | null; slot: string | null }[] | null };
export type AcceptedDecision =
  | { key: string; type: "plan"; date: string; auto: boolean; by: { kind: "auto" | "owner" | "person"; name: string } | null; at: string | null }
  | { key: string; type: "council"; id: string; title: string; council: string; ownerId: string; owner: string; due: string; done: boolean };

const T = {
  RU: {
    title: "Решения", sub: "Что семья решает вместе — и что уже решено", propose: "Предложить решение",
    council: "Семейный совет", at: "в 19:00", week: "Неделя", prevAria: "Прошлый совет", nextAria: "Следующий совет", items: (d: number, n: number) => `Отмечено ${d} из ${n} пунктов распорядка и дел`, noItems: "На этой неделе пунктов распорядка не было.",
    prevSummary: (d: number, o: number) => `С прошлого совета: сделано ${d} · в работе ${o}`,
    notes: "Заметки совета", notesHint: "Что обсудили, что решили.", held: "Совет прошёл", save: "Сохранить", saveNotes: "Сохранить заметки", saved: "Сохранено.", error: "Не удалось сохранить — попробуй ещё раз.",
    decisions: "Решения", add: "Добавить решение", what: "Что сделать", who: "Кто отвечает", due: "К какому дню", addBtn: "Добавить",
    done: "Сделано", inWork: "В работе", markDone: "Отметить сделанным", reopen: "Вернуть в работу", prev: "← Прошлый", next: "Следующий →", notMember: "Решения видят члены семьи.",
    readOnly: "Заметки и решения ведут взрослые.", heldLater: "Отметить можно с 19:00 в день совета.",
    chip: { upcoming: (n: number) => `Через ${n} ${ruPlural(n, ["день", "дня", "дней"])}`, today: "Сегодня в 19:00", live: "Идёт", held: "Прошёл", missed: "Не состоялся" },
    pending: "Ждут голоса", pendingHint: "Решает любой из родителей: голосования нет, действует первое решение.", noBoard: "Доска задач сейчас не ответила — очередь не показать.",
    calm: "Всё решено — очередь пуста.", parentsOnly: "Здесь решают родители. Тебе ничего не нужно делать.",
    cant: "не может взяться", late: "не принято к 12:00", plan: "План на завтра", planCount: (n: number) => `${n} ${ruPlural(n, ["задача", "задачи", "задач"])} ждут утверждения`,
    decide: "Решить", approve: "Утвердить", accepted: "Принято", none: "Пока ничего не решено.", pill: "принято", pillDone: "сделано", pillOpen: "в работе",
    planOk: (d: string) => `План на ${d} утверждён`, planBy: (n: string, at: string | null) => (at ? `${n} в ${at}` : n), planAuto: "автоматически, по шаблонам", planOwner: "владелец",
    fromCouncil: (d: string) => `совет ${d}`, by: "до",
    panelWait: (d: string) => `Ждёт · ${d}`, reason: "Причина", whoIs: "Кто", day: "День", decides: "Решает", anyParent: "любой из родителей",
    whoDoes: "Кому передать", reassign: "Передать", toTomorrow: "На завтра", cancelTask: "Снять",
    reasons: { lessons: "Уроки", away: "Не буду дома", unwell: "Плохо себя чувствую", other: "Другое" } as Record<OsDeclineCode, string>,
    planList: "Что в плане", approveN: (n: number) => `Утвердить ${n} ${ruPlural(n, ["задачу", "задачи", "задач"])}`, editOnBoard: "Изменить план на доске", planNoRows: "Список плана сейчас не загрузился. Утвердить его можно на доске задач.",
    alreadyApproved: "План уже утвердил другой родитель.", close: "Закрыть",
    doneMsg: { reassign: (x: string) => `«${x}» передана.`, carry: (x: string) => `«${x}» перенесена на завтра.`, cancel: (x: string) => `«${x}» снята.`, plan: "План утверждён." },
  },
  EN: {
    title: "Decisions", sub: "What the family decides together — and what is already decided", propose: "Propose a decision",
    council: "Family council", at: "at 19:00", week: "Week", prevAria: "Previous council", nextAria: "Next council", items: (d: number, n: number) => `${d} of ${n} routine and chore items ticked`, noItems: "No routine items this week.",
    prevSummary: (d: number, o: number) => `Since the last council: done ${d} · in progress ${o}`,
    notes: "Council notes", notesHint: "What was discussed and decided.", held: "The council took place", save: "Save", saveNotes: "Save the notes", saved: "Saved.", error: "Could not save — please try again.",
    decisions: "Decisions", add: "Add a decision", what: "What to do", who: "Who is responsible", due: "By when", addBtn: "Add",
    done: "Done", inWork: "In progress", markDone: "Mark as done", reopen: "Back to in progress", prev: "← Previous", next: "Next →", notMember: "Decisions are for family members.",
    readOnly: "Adults keep the notes and decisions.", heldLater: "You can mark it from 19:00 on the council day.",
    chip: { upcoming: (n: number) => `In ${n} day${n === 1 ? "" : "s"}`, today: "Today at 19:00", live: "On now", held: "Took place", missed: "Did not take place" },
    pending: "Waiting for a vote", pendingHint: "Either parent decides: there is no vote, the first decision stands.", noBoard: "The task board did not answer — the queue cannot be shown.",
    calm: "Everything is decided — the queue is empty.", parentsOnly: "Parents decide here. There is nothing for you to do.",
    cant: "can't take it", late: "not accepted by 12:00", plan: "Tomorrow's plan", planCount: (n: number) => `${n} task${n === 1 ? "" : "s"} waiting for approval`,
    decide: "Decide", approve: "Approve", accepted: "Decided", none: "Nothing decided yet.", pill: "decided", pillDone: "done", pillOpen: "in progress",
    planOk: (d: string) => `Plan for ${d} approved`, planBy: (n: string, at: string | null) => (at ? `${n} at ${at}` : n), planAuto: "automatically, from the templates", planOwner: "the owner",
    fromCouncil: (d: string) => `council ${d}`, by: "by",
    panelWait: (d: string) => `Waiting · ${d}`, reason: "Reason", whoIs: "Who", day: "Day", decides: "Decides", anyParent: "either parent",
    whoDoes: "Hand over to", reassign: "Hand over", toTomorrow: "Tomorrow", cancelTask: "Remove",
    reasons: { lessons: "Homework", away: "Not at home", unwell: "Not feeling well", other: "Other" } as Record<OsDeclineCode, string>,
    planList: "In the plan", approveN: (n: number) => `Approve ${n} task${n === 1 ? "" : "s"}`, editOnBoard: "Change the plan on the board", planNoRows: "The plan's list did not load. You can approve it on the task board.",
    alreadyApproved: "The other parent has already approved the plan.", close: "Close",
    doneMsg: { reassign: (x: string) => `“${x}” handed over.`, carry: (x: string) => `“${x}” moved to tomorrow.`, cancel: (x: string) => `“${x}” removed.`, plan: "Plan approved." },
  },
} as const;
type Dict = (typeof T)[Lang];

const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = BTN_SECONDARY;
const primary = BTN_PRIMARY;
const send = (method: "POST" | "PUT", path: string, body: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null);
const longDate = (d: string, lang: Lang) => { const s = new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); return s.charAt(0).toUpperCase() + s.slice(1); };
const dayMonth = (d: string, lang: Lang) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

/** The mockup's card, row and pill (the same as «Сегодня», bus 171). */
const CARD = "rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] p-5 shadow-[var(--fos-shadow)]";
const CARD_H = "text-[15px] font-semibold text-[var(--foreground)] outline-none";
const ROW = "flex items-center gap-3 border-t border-[var(--border)] px-1.5 py-2.5 first:border-t-0";
const EMPTY = "px-1.5 py-5 text-center text-[14px] text-[var(--muted)]";
const PILL = { g: "bg-[var(--ok-soft)] text-[var(--ok)]", a: "bg-[var(--warn-soft)] text-[var(--fos-amber)]", b: "bg-[var(--fos-blue-soft)] text-[var(--fos-blue)]" };
const pill = (tone: keyof typeof PILL) => `whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${PILL[tone]}`;
const SMALL_PRIMARY = "inline-flex min-h-11 flex-none items-center rounded-[10px] bg-[var(--accent)] px-3.5 text-[14px] font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-hover)]";

export default function FamilyCouncil({ lang, council, people, me, sprint = null, recognitions = null, principles = null, pending = null, accepted = [], parent = false }: { lang: Lang; council: OsCouncil | null; people: OsPerson[]; me: { id: string; kind: string } | null; sprint?: OsSprint | null;
  recognitions?: OsRecognition[] | null; principles?: OsKodeksPrinciple[] | null; editor?: boolean;
  /** null = the board did not answer; [] for a non-parent adult (nothing waits for them). */
  pending?: PendingDecision[] | null; accepted?: AcceptedDecision[]; parent?: boolean }) {
  const t = tx(T, lang);
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os/council`;
  const shift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
  return (
    <>
      <div data-fos-page="">
        <div className="pb-8">
          {/* L6: the owner who is not a member still gets the page's H1 above the one line */}
          {!council ? <><h1 className={H1}>{t.title}</h1><p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p></> : (
            <>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className={H1}>{t.title}</h1>
                  <p className="mt-1 text-[15px] text-[var(--muted)]">{t.sub}</p>
                </div>
                {council.can.write && <a href="#add-decision" data-propose="" className={primary}>+ {t.propose}</a>}
              </div>

              <div className="grid items-start gap-[18px] min-[900px]:grid-cols-[1.7fr_1fr]">
                <Pending t={t} lang={lang} items={pending} parent={parent} people={people} />
                <Accepted t={t} lang={lang} items={accepted} me={me} people={people} />
              </div>

              <section aria-labelledby="council-h" data-council="" className="mt-12 max-w-4xl">
                <h2 id="council-h" className={OS_H2}>{t.council}</h2>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px] text-[var(--text-secondary)]" suppressHydrationWarning>
                  {longDate(council.date, lang)} {t.at}
                  <span data-council-status={council.status} className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[14px] ${council.status === "live" ? "bg-[var(--accent)] text-[var(--on-accent)]" : "border border-[var(--border)]"}`}>
                    {council.status === "upcoming" ? t.chip.upcoming(council.days_until) : t.chip[council.status]}
                  </span>
                </p>
                <nav aria-label={t.council} className="mt-3 grid max-w-sm grid-cols-2 gap-2">
                  <Link prefetch={false} href={`${base}?date=${shift(council.date, -7)}`} aria-label={t.prevAria} className={btn}>{t.prev}</Link>
                  <Link prefetch={false} href={`${base}?date=${shift(council.date, 7)}`} aria-label={t.nextAria} className={btn}>{t.next}</Link>
                </nav>
                {/* bus 97 item 5: one A4 sheet for the council and the fridge */}
                {me && <p className="mt-3"><Link prefetch={false} href={`/${lang === "EN" ? "en" : "ru"}/family/os/week`} data-week-link="" className="inline-flex min-h-11 items-center text-[16px] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{lang === "EN" ? "Family week · PDF" : "Неделя семьи · PDF"}</Link></p>}

                {/* bus 86: the principle of the week is the first item of the agenda */}
                {council.principle && principles && <CouncilPrinciple lang={lang} principle={council.principle} canPick={Boolean(council.can.pick_principle)} principles={principles} />}
                {recognitions && <section aria-labelledby="council-rec-h" data-council-recognitions="" className={`mt-10 ${RULE_VALUES}`}>
                  <RecognitionList lang={lang} items={recognitions} headingId="council-rec-h" heading={tx(KODEKS_T, lang).recCouncil} level={3} />
                </section>}
                <section aria-labelledby="agenda-h" data-agenda-week="" className="mt-10">
                  <h3 id="agenda-h" className={OS_H3} suppressHydrationWarning>{t.week} {fmtWeekRange(council.agenda.from, council.agenda.to, lang)}</h3>
                  <p className="mt-2 text-[16px] text-[var(--foreground)]">{council.agenda.items.scheduled ? t.items(council.agenda.items.done, council.agenda.items.scheduled) : t.noItems}</p>
                  {council.previous?.tasks.length ? <p className={`${META} mt-1`}>{t.prevSummary(council.agenda.tasks.done, council.agenda.tasks.open)}</p> : null}
                </section>

                {/* keyed by date: moving to another council must not carry this meeting's unsaved text into it */}
                <Notes key={council.date} t={t} date={council.date} notes={council.notes} held={council.held} canWrite={council.can.write} canMarkHeld={council.can.mark_held} />

                {council.can.write && <div id="add-decision" className="scroll-mt-24"><AddDecision t={t} date={council.date} people={people} lang={lang} /></div>}
                {sprint && <CouncilSprint key={sprint.week_start} lang={lang} sprint={sprint} />}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** «Ждут голоса»: one row per item, «Решить» / «Утвердить» opens the panel. */
function Pending({ t, lang, items, parent, people }: { t: Dict; lang: Lang; items: PendingDecision[] | null; parent: boolean; people: OsPerson[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const head = useRef<HTMLHeadingElement | null>(null);
  const item = items?.find((x) => x.key === open) ?? null;
  const ty = (s: string) => (lang === "RU" ? typograph(s) : s);
  return (
    <section aria-labelledby="pending-h" data-pending="" className={CARD}>
      <h2 id="pending-h" ref={head} tabIndex={-1} className={CARD_H}>{t.pending}</h2>
      {parent && <p className="mt-0.5 text-[13px] text-[var(--muted)]">{t.pendingHint}</p>}
      <div className="mt-2">
        {items === null ? <p className={EMPTY}>{t.noBoard}</p> : !parent ? <p className={EMPTY}>{t.parentsOnly}</p> : items.length === 0 ? <p data-pending-calm="" className={EMPTY}>{t.calm}</p> : (
          <ul>
            {items.map((x) => (
              <li key={x.key} data-pending-item={x.type === "plan" ? "plan" : x.why} className={ROW}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[var(--foreground)]">{x.type === "plan" ? t.plan : ty(x.title)}</p>
                  <p className="text-[13px] text-[var(--muted)]" suppressHydrationWarning>
                    {x.type === "plan" ? `${dayMonth(x.date, lang)} · ${t.planCount(x.count)}` : [x.who, x.why === "declined" ? t.cant : t.late, x.why === "declined" && x.code ? (x.code === "other" ? x.reason : t.reasons[x.code]) : ""].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button type="button" data-decide={x.key} aria-haspopup="dialog" aria-label={`${x.type === "plan" ? t.approve : t.decide}: ${x.type === "plan" ? t.plan : x.title}`}
                  onClick={(e) => { opener.current = e.currentTarget; setMsg(""); setOpen(x.key); }} className={SMALL_PRIMARY}>
                  {x.type === "plan" ? t.approve : t.decide}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p role="status" aria-live="polite" data-decision-msg="" className="text-[13px] text-[var(--ok)]">{msg}</p>
      <Dialog open={Boolean(item)} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <DialogContent closeLabel={t.close} data-decision-panel=""
          onCloseAutoFocus={(e) => { const el = opener.current?.isConnected ? opener.current : head.current; if (el) { e.preventDefault(); el.focus(); } }}
          className="left-auto right-0 top-0 h-dvh w-full max-w-md translate-x-0 translate-y-0 content-start gap-3 overflow-y-auto rounded-none border-0 border-l border-[var(--border)] bg-[var(--fos-panel)] p-5 shadow-[var(--fos-shadow-lg)] sm:max-w-md">
          {item && <Panel key={item.key} t={t} lang={lang} item={item} people={people} onDone={(m) => { setOpen(null); setMsg(m); }} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** The decision panel: what it is, who, why — and the moves the model has. Nothing here is a vote. */
function Panel({ t, lang, item, people, onDone }: { t: Dict; lang: Lang; item: PendingDecision; people: OsPerson[]; onDone: (msg: string) => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const firstOther = item.type === "task" ? people.find((p) => p.id !== item.assigneeId)?.id ?? item.assigneeId : "";
  const [to, setTo] = useState(firstOther);
  const ty = (s: string) => (lang === "RU" ? typograph(s) : s);
  const board = `/${lang === "EN" ? "en" : "ru"}/family/os/board`;
  const run = async (p: Promise<Response | null>, ok: string) => {
    setBusy(true); setErr("");
    const r = await p;
    setBusy(false);
    if (r?.ok) { onDone(ok); router.refresh(); return; }
    if (item.type === "plan" && r?.status === 409) { onDone(t.alreadyApproved); router.refresh(); return; }
    setErr(t.error);
  };
  if (item.type === "plan") {
    const n = item.tasks?.length ?? 0;
    return (
      <>
        <span className={`${pill("a")} justify-self-start`}>{t.panelWait(dayMonth(item.date, lang))}</span>
        <DialogTitle className="font-serif text-[26px] font-semibold leading-tight text-[var(--foreground)]">{t.plan}</DialogTitle>
        <DialogDescription className="text-[15px] text-[var(--text-secondary)]" suppressHydrationWarning>{longDate(item.date, lang)} · {t.planCount(item.count)}</DialogDescription>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]"><dt className="text-[var(--muted)]">{t.decides}</dt><dd>{t.anyParent}</dd></dl>
        {item.tasks ? (
          <div className="rounded-[var(--fos-radius)] bg-[var(--fos-panel-2)] p-3">
            <p className="text-[13px] text-[var(--muted)]">{t.planList}</p>
            <ul data-plan-rows="" className="mt-1">
              {item.tasks.map((x) => <li key={x.id} className="border-t border-[var(--border)] py-1.5 text-[15px] first:border-t-0">{ty(x.title)}<span className="text-[var(--muted)]">{[x.who, x.time].filter(Boolean).map((v) => ` · ${v}`).join("")}</span></li>)}
            </ul>
          </div>
        ) : <p className="text-[14px] text-[var(--text-secondary)]">{t.planNoRows}</p>}
        <div className="mt-2 grid gap-2">
          {item.tasks && n > 0 && <button type="button" data-plan-approve="" disabled={busy} className={primary} onClick={() => run(send("PUT", `plan/${item.date}`, approvePlanBody(item.tasks)), t.doneMsg.plan)}>{t.approveN(n)}</button>}
          <Link prefetch={false} href={`${board}#plan-h`} className={btn}>{t.editOnBoard}</Link>
        </div>
        <p role="status" aria-live="polite" className="text-[14px] text-[var(--destructive)]">{err}</p>
      </>
    );
  }
  const why = item.why === "declined" ? (item.code ? (item.code === "other" ? item.reason : t.reasons[item.code]) : t.cant) : t.late;
  return (
    <>
      <span className={`${pill("a")} justify-self-start`} suppressHydrationWarning>{t.panelWait(dayMonth(item.date, lang))}</span>
      <DialogTitle className="font-serif text-[26px] font-semibold leading-tight text-[var(--foreground)]">{ty(item.title)}</DialogTitle>
      <DialogDescription className="text-[15px] text-[var(--text-secondary)]">{item.who ? `${item.who}: ` : ""}{item.why === "declined" ? t.cant : t.late}</DialogDescription>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
        <dt className="text-[var(--muted)]">{t.whoIs}</dt><dd>{item.who || "—"}</dd>
        <dt className="text-[var(--muted)]">{t.reason}</dt><dd>{why || "—"}</dd>
        <dt className="text-[var(--muted)]">{t.day}</dt><dd suppressHydrationWarning>{longDate(item.date, lang)}</dd>
        <dt className="text-[var(--muted)]">{t.decides}</dt><dd>{t.anyParent}</dd>
      </dl>
      <div data-decision-actions="" className="mt-2 grid gap-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className={label}>{t.whoDoes}<select value={to} onChange={(e) => setTo(e.target.value)} className={field}>{people.map((p) => <option key={p.id} value={p.id}>{lang === "EN" ? p.name_en : p.name_ru}</option>)}</select></label>
          <button type="button" data-act="reassign" disabled={busy} className={primary} onClick={() => run(send("POST", `tasks/${item.id}/reassign`, { assignee_id: to }), t.doneMsg.reassign(item.title))}>{t.reassign}</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" data-act="carry" disabled={busy} className={btn} onClick={() => run(send("POST", `tasks/${item.id}/carry`, {}), t.doneMsg.carry(item.title))}>{t.toTomorrow}</button>
          <button type="button" data-act="cancel" disabled={busy} className={btn} onClick={() => run(send("POST", `tasks/${item.id}/cancel`, {}), t.doneMsg.cancel(item.title))}>{t.cancelTask}</button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="text-[14px] text-[var(--destructive)]">{err}</p>
      <Link prefetch={false} href={board} className="inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-[var(--ok)] hover:underline hover:underline-offset-4">{lang === "EN" ? "Open the task board" : "Открыть доску задач"}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
    </>
  );
}

/** «Принято»: plan approvals and council decisions. A council decision ticks like any council task (owner or adult). */
function Accepted({ t, lang, items, me, people }: { t: Dict; lang: Lang; items: AcceptedDecision[]; me: { id: string; kind: string } | null; people: OsPerson[] }) {
  const childOwner = (id: string) => people.find((p) => p.id === id)?.kind === "child";
  const stamp = (x: Extract<AcceptedDecision, { type: "plan" }>) => x.auto || x.by?.kind === "auto" ? t.planAuto : x.by?.kind === "owner" ? t.planBy(t.planOwner, x.at) : x.by ? t.planBy(x.by.name, x.at) : "";
  return (
    <section aria-labelledby="accepted-h" data-accepted="" className={CARD}>
      <h2 id="accepted-h" className={CARD_H}>{t.accepted}</h2>
      <div className="mt-2">
        {items.length === 0 ? <p className={EMPTY}>{t.none}</p> : (
          <ul>
            {items.map((x) => x.type === "plan" ? (
              <li key={x.key} data-accepted-item="plan" className={ROW}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[var(--foreground)]" suppressHydrationWarning>{t.planOk(dayMonth(x.date, lang))}</p>
                  {stamp(x) && <p className="text-[13px] text-[var(--muted)]">{stamp(x)}</p>}
                </div>
                <span className={pill("g")}>{t.pill}</span>
              </li>
            ) : (
              <CouncilRow key={x.key} t={t} lang={lang} x={x} canTick={Boolean(me && (me.id === x.ownerId || (me.kind === "adult" && childOwner(x.ownerId))))} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** A council decision: the tick (bus 80 #2, the same as everywhere: done by its owner or an adult for a child) and its state. */
function CouncilRow({ t, lang, x, canTick }: { t: Dict; lang: Lang; x: Extract<AcceptedDecision, { type: "council" }>; canTick: boolean }) {
  const [done, setDone] = useState(x.done);
  const [err, setErr] = useState(false);
  const ty = (s: string) => (lang === "RU" ? typograph(s) : s);
  const meta = [x.owner, `${t.by} ${fmtFamilyDate(x.due, lang)}`, t.fromCouncil(dayMonth(x.council, lang))].filter(Boolean).join(" · ");
  const tick = async () => {
    if (done) return;
    setDone(true); setErr(false);
    const r = await send("POST", `tasks/${x.id}/done`, {});
    if (!r?.ok) { setDone(false); setErr(true); }
  };
  return (
    <li data-accepted-item="council" data-task={done ? "done" : "open"} className={ROW}>
      <button type="button" role="checkbox" aria-checked={done} disabled={!canTick || done} onClick={tick} aria-label={`${x.title}, ${meta}`}
        className="grid h-11 w-11 flex-none place-items-center rounded-[10px] disabled:cursor-default"><Check checked={done} /></button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] font-medium ${done ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>{ty(x.title)}</p>
        <p className="truncate text-[13px] text-[var(--muted)]" suppressHydrationWarning>{meta}</p>
        {err && <p role="status" className="text-[13px] text-[var(--destructive)]">{t.error}</p>}
      </div>
      <span className={pill(done ? "g" : "b")}>{done ? t.pillDone : t.pillOpen}</span>
    </li>
  );
}

/** One tick row for every council task (bus 80 #2): the same round tick as routines; tap again to undo. */
export function TaskTick({ lang, task, meta, canTick, onDone }: { lang: Lang; task: { id: string; title: string; done: boolean }; meta: string; canTick: boolean; onDone?: (done: boolean) => void }) {
  const [done, setDone] = useState(task.done);
  const [err, setErr] = useState(false);
  // bus 85: a council decision is a task — ticking it is the task's «Готово» (the service checks who may);
  // a finished one stays finished here (rework is a parent's move on the board).
  const toggle = async () => {
    if (done) return;
    setDone(true); setErr(false);
    const r = await send("POST", `tasks/${task.id}/done`, {});
    if (!r?.ok) { setDone(false); setErr(true); } else onDone?.(true);
  };
  return (
    <li data-task={done ? "done" : "open"} data-my-task="">
      <button type="button" role="checkbox" aria-checked={done} disabled={!canTick || done} onClick={toggle} aria-label={`${task.title}, ${meta}`}
        className="flex min-h-14 w-full items-center gap-4 py-3 text-left disabled:cursor-default">
        <Check checked={done} />
        <span className="min-w-0 flex-1">
          <span className={`block text-[17px] ${done ? "text-[var(--text-secondary)] line-through decoration-[var(--border)]" : "text-[var(--foreground)]"}`}>{task.title}</span>
          <span className="mt-0.5 block text-[14px] text-[var(--muted)]" suppressHydrationWarning>{meta}</span>
        </span>
      </button>
      {err && <p role="status" className="pb-2 text-[14px] text-[var(--muted)]">{lang === "EN" ? "Could not save — please try again." : "Не удалось сохранить — попробуй ещё раз."}</p>}
    </li>
  );
}

function Notes({ t, date, notes, held, canWrite, canMarkHeld }: { t: Dict; date: string; notes: string; held: boolean; canWrite: boolean; canMarkHeld: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(notes);
  const [savedText, setSavedText] = useState(notes);
  const [isHeld, setHeld] = useState(held);
  const [msg, setMsg] = useState("");
  const [heldMsg, setHeldMsg] = useState("");
  // bus 83 L2: the notes button saves the notes only; «Совет прошёл» is its own row and saves itself.
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await send("PUT", `council/${date}`, { notes: text, held: isHeld });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { setSavedText(text); router.refresh(); }
  };
  const toggleHeld = async (next: boolean) => {
    setHeld(next); setHeldMsg("");
    const r = await send("PUT", `council/${date}`, { notes: savedText, held: next });
    if (!r?.ok) { setHeld(!next); setHeldMsg(t.error); } else { setHeldMsg(t.saved); router.refresh(); }
  };
  return (
    <section aria-labelledby="notes-h" className="mt-10">
      <h2 id="notes-h" className={OS_H2}>{t.notes}</h2>
      {canWrite ? (
        <>
          <form onSubmit={save} className="mt-3 grid gap-3">
            <label className={label}>{t.notesHint}
              <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} rows={6} className={`${field} min-h-32`} />
            </label>
            <div className="flex items-center gap-3"><button type="submit" className={primary}>{t.saveNotes}</button><span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span></div>
          </form>
          <div data-held-row="" className="mt-5 border-t border-[var(--border)] pt-4">
            <label className={`flex min-h-11 items-center gap-3 text-[16px] ${canMarkHeld ? "cursor-pointer text-[var(--foreground)]" : "text-[var(--muted)]"}`}><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={isHeld} disabled={!canMarkHeld} onChange={(e) => toggleHeld(e.target.checked)} />{t.held}</label>
            {!canMarkHeld && <p className="text-[14px] text-[var(--muted)]">{t.heldLater}</p>}
            <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{heldMsg}</span>
          </div>
        </>
      ) : (
        <>
          {notes ? <p className="mt-3 whitespace-pre-line text-[16px] leading-[1.6] text-[var(--foreground)]">{notes}</p> : null}
          <p className="mt-2 text-[14px] text-[var(--muted)]">{t.readOnly}</p>
        </>
      )}
    </section>
  );
}

function AddDecision({ t, date, people, lang }: { t: Dict; date: string; people: OsPerson[]; lang: Lang }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const due = new Date(Date.parse(`${date}T12:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const r = await send("POST", `council/${date}/tasks`, { title: String(f.get("title") ?? "").trim(), owner_id: f.get("owner_id"), due_date: f.get("due_date") });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { form.reset(); router.refresh(); }
  };
  return (
    <Disclosure summary={t.add} className="mt-6">
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>{t.what}<input name="title" required maxLength={160} className={field} /></label>
        <label className={label}>{t.who}<select name="owner_id" className={field}>{people.map((p) => <option key={p.id} value={p.id}>{lang === "EN" ? p.name_en : p.name_ru}</option>)}</select></label>
        <label className={label}>{t.due}<input name="due_date" type="date" required min={date} defaultValue={due} className={field} /></label>
        <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className={primary}>{t.addBtn}</button><span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span></div>
      </form>
    </Disclosure>
  );
}

/** Today: my open council tasks (tick when done) and, on Sundays, the council line. */
/** Today: my open council tasks as tick rows (ticked ones stay, struck through, until tomorrow) and, on Sundays, the council line. */
export function TodayCouncil({ lang, tasks, sunday }: { lang: Lang; tasks: { id: string; title: string; due_date: string }[]; sunday: boolean }) {
  const L = tx({ EN: { head: "From the council", today: "Family council today at 19:00", open: "Open the council", due: "by" },
    RU: { head: "С семейного совета", today: "Сегодня в 19:00 — семейный совет", open: "Открыть совет", due: "до" } }, lang);
  if (!sunday && tasks.length === 0) return null;
  return (
    <section aria-labelledby="council-today-h" data-today-council="" className="mt-10">
      <h2 id="council-today-h" className={OS_H2}>{L.head}</h2>
      {sunday && <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[16px] text-[var(--foreground)]">{L.today} <Link prefetch={false} href={`/${lang === "EN" ? "en" : "ru"}/family/os/council`} className="inline-flex min-h-11 items-center underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{L.open}</Link></p>}
      {tasks.length > 0 && (
        <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {tasks.map((x) => <TaskTick key={x.id} lang={lang} task={{ ...x, done: false }} canTick meta={`${L.due} ${fmtFamilyDate(x.due_date, lang)}`} />)}
        </ul>
      )}
    </section>
  );
}
