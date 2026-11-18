"use client";

/**
 * Family council (Stage 3b, bus 79; plan §3.6): Sunday 19:00. The agenda is built from the week in
 * aggregate — family totals only, never who did or did not do what. Adults keep notes and turn
 * decisions into tasks with an owner and a date; everyone reads; a task is ticked by its owner or an adult.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FamilySubNav from "./FamilySubNav";
import Disclosure from "./Disclosure";
import { familyNav } from "../content/siteNav";
import { FAMILY_MAIN, FAMILY_HEADER_MAX } from "../lib/family-nav.mjs";
import { fmtDocDate } from "../lib/family-docs.mjs";
import { useLangToggle } from "./useLang";
import { H1, H2, META } from "../lib/typeScale";
import type { OsCouncil, OsPerson, OsTask } from "../lib/family-os";

type Lang = "EN" | "RU";
const T = {
  RU: {
    title: "Семейный совет", at: "в 19:00", week: "Неделя", items: (d: number, n: number) => `Отмечено ${d} из ${n} пунктов распорядка и дел`, noItems: "На этой неделе пунктов распорядка не было.",
    prevTasks: "Задачи с прошлого совета", prevSummary: (d: number, o: number) => `Сделано: ${d} · в работе: ${o}`, noPrev: "Прошлых задач нет.",
    notes: "Заметки совета", notesHint: "Что обсудили, что решили.", held: "Совет прошёл", save: "Сохранить", saved: "Сохранено.", error: "Не удалось сохранить — попробуй ещё раз.",
    decisions: "Решения", none: "Решений пока нет.", add: "Добавить решение", what: "Что сделать", who: "Кто отвечает", due: "К какому дню", addBtn: "Добавить",
    done: "Сделано", inWork: "В работе", markDone: "Отметить сделанным", reopen: "Вернуть в работу", prev: "← Прошлый совет", next: "Следующий совет →", notMember: "Совет видят члены семьи.",
    heldBadge: "Совет прошёл", readOnly: "Заметки и решения ведут взрослые.",
  },
  EN: {
    title: "Family council", at: "at 19:00", week: "Week", items: (d: number, n: number) => `${d} of ${n} routine and chore items ticked`, noItems: "No routine items this week.",
    prevTasks: "Tasks from the last council", prevSummary: (d: number, o: number) => `Done: ${d} · in progress: ${o}`, noPrev: "No earlier tasks.",
    notes: "Council notes", notesHint: "What was discussed and decided.", held: "The council took place", save: "Save", saved: "Saved.", error: "Could not save — please try again.",
    decisions: "Decisions", none: "No decisions yet.", add: "Add a decision", what: "What to do", who: "Who is responsible", due: "By when", addBtn: "Add",
    done: "Done", inWork: "In progress", markDone: "Mark as done", reopen: "Back to in progress", prev: "← Previous council", next: "Next council →", notMember: "The council is for family members.",
    heldBadge: "Took place", readOnly: "Adults keep the notes and decisions.",
  },
} as const;
type Dict = (typeof T)[Lang];

const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]";
const primary = "inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]";
const send = (method: "POST" | "PUT", path: string, body: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null);
const dayMonth = (d: string, lang: Lang) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const longDate = (d: string, lang: Lang) => { const s = new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); return s.charAt(0).toUpperCase() + s.slice(1); };

export default function FamilyCouncil({ lang, council, people, me, admin }: { lang: Lang; council: OsCouncil | null; people: OsPerson[]; me: { id: string; kind: string } | null; admin: boolean }) {
  const t = T[lang];
  const toggleLang = useLangToggle(lang);
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os/council`;
  const nameOf = (id: string) => { const p = people.find((x) => x.id === id); return p ? (lang === "EN" ? p.name_en : p.name_ru) : "—"; };
  const shift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} />
      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin={admin} os active="council" />
        <div className="max-w-4xl pb-8">
          {!council ? <p role="status" className="mt-10 rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p> : (
            <>
              <h1 className={H1}>{t.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px] text-[var(--text-secondary)]" suppressHydrationWarning>
                {longDate(council.date, lang)} {t.at}
                {council.held && <span className="inline-flex items-center rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[14px]">{t.heldBadge}</span>}
              </p>
              <nav aria-label={t.title} className="mt-3 flex flex-wrap gap-2">
                <Link href={`${base}?date=${shift(council.date, -7)}`} className={btn}>{t.prev}</Link>
                <Link href={`${base}?date=${shift(council.date, 7)}`} className={btn}>{t.next}</Link>
              </nav>

              <section aria-labelledby="agenda-h" data-agenda-week="" className="mt-10 rounded-lg border border-[var(--border)] px-5 py-4">
                <h2 id="agenda-h" className="font-serif text-[22px] text-[var(--foreground)]" suppressHydrationWarning>{t.week}: {dayMonth(council.agenda.from, lang)} — {dayMonth(council.agenda.to, lang)}</h2>
                <p className="mt-2 text-[16px] text-[var(--foreground)]">{council.agenda.items.scheduled ? t.items(council.agenda.items.done, council.agenda.items.scheduled) : t.noItems}</p>
              </section>

              <section aria-labelledby="prev-h" className="mt-10">
                <h2 id="prev-h" className={H2}>{t.prevTasks}</h2>
                {council.previous?.tasks.length ? (
                  <>
                    <p className={`${META} mt-2`}>{t.prevSummary(council.agenda.tasks.done, council.agenda.tasks.open)}</p>
                    <TaskList t={t} lang={lang} tasks={council.previous.tasks} nameOf={nameOf} me={me} />
                  </>
                ) : <p className={`${META} mt-2`}>{t.noPrev}</p>}
              </section>

              {/* keyed by date: moving to another council must not carry this meeting's unsaved text into it */}
              <Notes key={council.date} t={t} date={council.date} notes={council.notes} held={council.held} canWrite={council.can.write} />

              <section aria-labelledby="dec-h" className="mt-10">
                <h2 id="dec-h" className={H2}>{t.decisions}</h2>
                {council.tasks.length ? <TaskList t={t} lang={lang} tasks={council.tasks} nameOf={nameOf} me={me} /> : <p className={`${META} mt-2`}>{t.none}</p>}
                {council.can.write && <AddDecision t={t} date={council.date} people={people} lang={lang} />}
              </section>
            </>
          )}
        </div>
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}

function TaskList({ t, lang, tasks, nameOf, me }: { t: Dict; lang: Lang; tasks: OsTask[]; nameOf: (id: string) => string; me: { id: string; kind: string } | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const tick = async (task: OsTask) => {
    const r = await send("POST", `council-tasks/${task.id}/done`, { done: !task.done });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh();
  };
  return (
    <>
      <ul data-tasks="" className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {tasks.map((x) => {
          const can = me && (me.id === x.owner_id || me.kind === "adult");
          return (
            <li key={x.id} data-task={x.done ? "done" : "open"} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className={`text-[16px] ${x.done ? "text-[var(--text-secondary)]" : "text-[var(--foreground)]"}`}>{x.title}</p>
                <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{nameOf(x.owner_id)} · {fmtDocDate(x.due_date, lang)} · {x.done ? t.done : t.inWork}</p>
              </div>
              {can && <button type="button" className={btn} onClick={() => tick(x)}>{x.done ? t.reopen : t.markDone}</button>}
            </li>
          );
        })}
      </ul>
      {msg && <p role="status" aria-live="polite" className="mt-2 text-[14px] text-[var(--muted)]">{msg}</p>}
    </>
  );
}

function Notes({ t, date, notes, held, canWrite }: { t: Dict; date: string; notes: string; held: boolean; canWrite: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(notes);
  const [isHeld, setHeld] = useState(held);
  const [msg, setMsg] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await send("PUT", `council/${date}`, { notes: text, held: isHeld });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh();
  };
  return (
    <section aria-labelledby="notes-h" className="mt-10">
      <h2 id="notes-h" className="font-serif text-[28px] leading-[1.15] text-[var(--accent)] lg:text-[35px]">{t.notes}</h2>
      {canWrite ? (
        <form onSubmit={save} className="mt-3 grid gap-3">
          <label className={label}>{t.notesHint}
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} rows={6} className={`${field} min-h-32`} />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[16px] text-[var(--foreground)]"><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={isHeld} onChange={(e) => setHeld(e.target.checked)} />{t.held}</label>
          <div className="flex items-center gap-3"><button type="submit" className={primary}>{t.save}</button><span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span></div>
        </form>
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
export function TodayCouncil({ lang, tasks, sunday }: { lang: Lang; tasks: { id: string; title: string; due_date: string }[]; sunday: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const L = lang === "EN" ? { head: "From the council", today: "Family council today at 19:00", open: "Open the council", due: "by", done: "Mark as done", error: "Could not save — please try again." }
    : { head: "С семейного совета", today: "Сегодня в 19:00 — семейный совет", open: "Открыть совет", due: "до", done: "Отметить сделанным", error: "Не удалось сохранить — попробуй ещё раз." };
  if (!sunday && tasks.length === 0) return null;
  const tick = async (id: string) => { const r = await send("POST", `council-tasks/${id}/done`, { done: true }); if (r?.ok) router.refresh(); else setMsg(L.error); };
  return (
    <section aria-labelledby="council-today-h" data-today-council="" className="mt-8">
      <h2 id="council-today-h" className="font-serif text-[22px] text-[var(--foreground)]">{L.head}</h2>
      {sunday && <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[16px] text-[var(--foreground)]">{L.today} <Link href={`/${lang === "EN" ? "en" : "ru"}/family/os/council`} className="inline-flex min-h-11 items-center underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{L.open}</Link></p>}
      {tasks.length > 0 && (
        <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {tasks.map((x) => (
            <li key={x.id} data-my-task="" className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1"><p className="text-[16px] text-[var(--foreground)]">{x.title}</p><p className="text-[14px] text-[var(--muted)]" suppressHydrationWarning>{L.due} {fmtDocDate(x.due_date, lang)}</p></div>
              <button type="button" className={btn} onClick={() => tick(x.id)}>{L.done}</button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p role="status" aria-live="polite" className="mt-2 text-[14px] text-[var(--muted)]">{msg}</p>}
    </section>
  );
}
