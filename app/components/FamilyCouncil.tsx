"use client";

/**
 * Family council (Stage 3b, bus 79; plan §3.6): Sunday 19:00. The agenda is built from the week in
 * aggregate — family totals only, never who did or did not do what. Adults keep notes and turn
 * decisions into tasks with an owner and a date; everyone reads; a task is ticked by its owner or an adult.
 */
import { CouncilPrinciple, RecognitionList, KODEKS_T } from "./FamilyKodeks";
import type { OsRecognition, OsKodeksPrinciple } from "../lib/family-os";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Disclosure from "./Disclosure";
import { fmtFamilyDate, fmtWeekRange } from "../lib/family-docs.mjs";
import { Check } from "./FamilyRoutines";
import { ruPlural } from "../lib/family-routines.mjs";
import { H1, META } from "../lib/typeScale";
import { BTN_PRIMARY, BTN_SECONDARY, OS_H2, RULE_VALUES } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";
import type { OsCouncil, OsPerson, OsTask, OsSprint } from "../lib/family-os";
import { CouncilSprint } from "./FamilyBoard";

type Lang = "EN" | "RU";
const T = {
  RU: {
    title: "Семейный совет", at: "в 19:00", week: "Неделя", prevAria: "Прошлый совет", nextAria: "Следующий совет", items: (d: number, n: number) => `Отмечено ${d} из ${n} пунктов распорядка и дел`, noItems: "На этой неделе пунктов распорядка не было.",
    prevTasks: "Задачи с прошлого совета", prevSummary: (d: number, o: number) => `Сделано: ${d} · в работе: ${o}`, noPrev: "Прошлых задач нет.",
    notes: "Заметки совета", notesHint: "Что обсудили, что решили.", held: "Совет прошёл", save: "Сохранить", saveNotes: "Сохранить заметки", saved: "Сохранено.", error: "Не удалось сохранить — попробуй ещё раз.",
    decisions: "Решения", none: "Решений пока нет.", add: "Добавить решение", what: "Что сделать", who: "Кто отвечает", due: "К какому дню", addBtn: "Добавить",
    done: "Сделано", inWork: "В работе", markDone: "Отметить сделанным", reopen: "Вернуть в работу", prev: "← Прошлый", next: "Следующий →", notMember: "Совет видят члены семьи.",
    readOnly: "Заметки и решения ведут взрослые.", heldLater: "Отметить можно с 19:00 в день совета.",
    chip: { upcoming: (n: number) => `Через ${n} ${ruPlural(n, ["день", "дня", "дней"])}`, today: "Сегодня в 19:00", live: "Идёт", held: "Прошёл", missed: "Не состоялся" },
  },
  EN: {
    title: "Family council", at: "at 19:00", week: "Week", prevAria: "Previous council", nextAria: "Next council", items: (d: number, n: number) => `${d} of ${n} routine and chore items ticked`, noItems: "No routine items this week.",
    prevTasks: "Tasks from the last council", prevSummary: (d: number, o: number) => `Done: ${d} · in progress: ${o}`, noPrev: "No earlier tasks.",
    notes: "Council notes", notesHint: "What was discussed and decided.", held: "The council took place", save: "Save", saveNotes: "Save the notes", saved: "Saved.", error: "Could not save — please try again.",
    decisions: "Decisions", none: "No decisions yet.", add: "Add a decision", what: "What to do", who: "Who is responsible", due: "By when", addBtn: "Add",
    done: "Done", inWork: "In progress", markDone: "Mark as done", reopen: "Back to in progress", prev: "← Previous", next: "Next →", notMember: "The council is for family members.",
    readOnly: "Adults keep the notes and decisions.", heldLater: "You can mark it from 19:00 on the council day.",
    chip: { upcoming: (n: number) => `In ${n} day${n === 1 ? "" : "s"}`, today: "Today at 19:00", live: "On now", held: "Took place", missed: "Did not take place" },
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

export default function FamilyCouncil({ lang, council, people, me, sprint = null, recognitions = null, principles = null }: { lang: Lang; council: OsCouncil | null; people: OsPerson[]; me: { id: string; kind: string } | null; sprint?: OsSprint | null;
  recognitions?: OsRecognition[] | null; principles?: OsKodeksPrinciple[] | null; editor?: boolean }) {
  const t = tx(T, lang);
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os/council`;
  const nameOf = (id: string) => { const p = people.find((x) => x.id === id); return p ? (lang === "EN" ? p.name_en : p.name_ru) : "—"; };
  const shift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
  return (
    <>
      <div data-fos-page="">
        <div className="max-w-4xl pb-8">
          {/* L6: the owner who is not a member still gets the page's H1 above the one line */}
          {!council ? <><h1 className={H1}>{t.title}</h1><p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p></> : (
            <>
              <h1 className={H1}>{t.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px] text-[var(--text-secondary)]" suppressHydrationWarning>
                {longDate(council.date, lang)} {t.at}
                <span data-council-status={council.status} className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[14px] ${council.status === "live" ? "bg-[var(--accent)] text-[var(--on-accent)]" : "border border-[var(--border)]"}`}>
                  {council.status === "upcoming" ? t.chip.upcoming(council.days_until) : t.chip[council.status]}
                </span>
              </p>
              <nav aria-label={t.title} className="mt-3 grid max-w-sm grid-cols-2 gap-2">
                <Link prefetch={false} href={`${base}?date=${shift(council.date, -7)}`} aria-label={t.prevAria} className={btn}>{t.prev}</Link>
                <Link prefetch={false} href={`${base}?date=${shift(council.date, 7)}`} aria-label={t.nextAria} className={btn}>{t.next}</Link>
              </nav>
              {/* bus 97 item 5: one A4 sheet for the council and the fridge */}
              {me && <p className="mt-3"><Link prefetch={false} href={`/${lang === "EN" ? "en" : "ru"}/family/os/week`} data-week-link="" className="inline-flex min-h-11 items-center text-[16px] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{lang === "EN" ? "Family week · PDF" : "Неделя семьи · PDF"}</Link></p>}

              {/* bus 86: the principle of the week is the first item of the agenda */}
              {council.principle && principles && <CouncilPrinciple lang={lang} principle={council.principle} canPick={Boolean(council.can.pick_principle)} principles={principles} />}
              {recognitions && <section aria-labelledby="council-rec-h" data-council-recognitions="" className={`mt-10 ${RULE_VALUES}`}>
                <RecognitionList lang={lang} items={recognitions} headingId="council-rec-h" heading={tx(KODEKS_T, lang).recCouncil} level={2} />
              </section>}
              <section aria-labelledby="agenda-h" data-agenda-week="" className="mt-10">
                <h2 id="agenda-h" className={OS_H2} suppressHydrationWarning>{t.week} {fmtWeekRange(council.agenda.from, council.agenda.to, lang)}</h2>
                <p className="mt-2 text-[16px] text-[var(--foreground)]">{council.agenda.items.scheduled ? t.items(council.agenda.items.done, council.agenda.items.scheduled) : t.noItems}</p>
              </section>

              <section aria-labelledby="prev-h" className="mt-10">
                <h2 id="prev-h" className={OS_H2}>{t.prevTasks}</h2>
                {council.previous?.tasks.length ? (
                  <>
                    <p className={`${META} mt-2`}>{t.prevSummary(council.agenda.tasks.done, council.agenda.tasks.open)}</p>
                    <TaskList lang={lang} tasks={council.previous.tasks} nameOf={nameOf} me={me} people={people} />
                  </>
                ) : <p className={`${META} mt-2`}>{t.noPrev}</p>}
              </section>

              {/* keyed by date: moving to another council must not carry this meeting's unsaved text into it */}
              <Notes key={council.date} t={t} date={council.date} notes={council.notes} held={council.held} canWrite={council.can.write} canMarkHeld={council.can.mark_held} />

              <section aria-labelledby="dec-h" className="mt-10">
                <h2 id="dec-h" className={OS_H2}>{t.decisions}</h2>
                {council.tasks.length ? <TaskList lang={lang} tasks={council.tasks} nameOf={nameOf} me={me} people={people} /> : <p className={`${META} mt-2`}>{t.none}</p>}
                {council.can.write && <AddDecision t={t} date={council.date} people={people} lang={lang} />}
              </section>
              {sprint && <CouncilSprint key={sprint.week_start} lang={lang} sprint={sprint} />}
            </>
          )}
        </div>
      </div>
    </>
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

function TaskList({ lang, tasks, nameOf, me, people }: { lang: Lang; tasks: OsTask[]; nameOf: (id: string) => string; me: { id: string; kind: string } | null; people: OsPerson[] }) {
  // The task rules (bus 85): the person themselves, or an adult for a child (the service checks the parent grant).
  const childOwner = (id: string) => people.find((p) => p.id === id)?.kind === "child";
  const by = lang === "EN" ? "by" : "до";
  return (
    <ul data-tasks="" className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
      {tasks.map((x) => <TaskTick key={x.id} lang={lang} task={x} canTick={Boolean(me && (me.id === x.owner_id || (me.kind === "adult" && childOwner(x.owner_id))))} meta={`${nameOf(x.owner_id)} · ${by} ${fmtFamilyDate(x.due_date, lang)}`} />)}
    </ul>
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
