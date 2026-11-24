"use client";

/**
 * Family OS routines and chores (Stage 2): tick-off list, the next-7-days agenda and the add form.
 * Used on Today (the member's own items) and on the person page. The service decides who may read,
 * tick and manage; this component only shows what it was given.
 *
 * No shaming (plan §3.3, §4.1): a miss is never shown — no red, no "missed", no counts of failures.
 * Бережный счёт (bus 86): «N из M на этой неделе». The streak shows only for an adult who chose it
 * (the service never sends one for a child). An optional anchor reads «После завтрака → Собрать портфель».
 */
import Disclosure from "./Disclosure";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { describeRule, streakText, weekText, anchorLabel, ifThenText, buildRule, scheduleSummary, WEEKDAYS } from "../lib/family-routines.mjs";
import type { OsRoutine } from "../lib/family-os";

type Lang = "EN" | "RU";
const T = {
  EN: {
    routine: "Routine", chore: "Chore", rotation: "Chore in turns", rotationShort: "In turns", members: "Who takes turns", needMembers: "Choose at least two people.", paused: "A day without rhythm — nothing is scheduled today.", done: "Done", notDone: "Not done yet", saveError: "Could not save — please try again.",
    progress: (d: number, n: number) => `${d} of ${n} done`, nextOn: "Next", agenda: "Next 7 days", nothingAhead: "Nothing scheduled in the next 7 days.",
    add: "Add a routine", choresMoved: "Chores and chores in turns are planned as tasks now.", toTemplates: "Plan templates on the board", kind: "Type", title: "What to do", titleHint: "e.g. Brush teeth", repeat: "Repeats",
    repeatOpt: { daily: "Every day", every_n: "Every N days", weekdays: "Weekdays", weekly: "On chosen days", monthly: "Once a month" },
    everyNDays: "Every how many days", everyNWeeks: "Every how many weeks", days: "Days", monthDay: "Day of the month",
    time: "Time (optional)", start: "Starts", save: "Add", saving: "Saving…", added: "Added.", needDays: "Choose at least one day.", needN: "Enter a number from 2 to 52.",
    remove: "Remove", confirm: "Remove for good?", cancel: "Keep", removed: "Removed.", all: "All items", none: "No routines or chores yet.",
    weekdayNames: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    anchor: "After what? (optional)", anchorNone: "No anchor", anchorOwn: "In my own words", anchorText: "After…", anchorHint: "e.g. after breakfast",
  },
  RU: {
    routine: "Распорядок", chore: "Дело", rotation: "Дело по очереди", rotationShort: "По очереди", members: "Кто делает по очереди", needMembers: "Выбери хотя бы двоих.", paused: "День без ритма — на сегодня ничего не запланировано.", done: "Сделано", notDone: "Ещё не сделано", saveError: "Не удалось сохранить — попробуй ещё раз.",
    progress: (d: number, n: number) => `Сделано ${d} из ${n}`, nextOn: "Дальше", agenda: "Ближайшие 7 дней", nothingAhead: "На ближайшие 7 дней ничего не запланировано.",
    add: "Добавить распорядок", choresMoved: "Дела и дела по очереди теперь планируются как задачи.", toTemplates: "Шаблоны плана на доске", kind: "Тип", title: "Что сделать", titleHint: "Например, почистить зубы", repeat: "Повторять",
    repeatOpt: { daily: "Каждый день", every_n: "Раз в N дней", weekdays: "По будням", weekly: "По дням недели", monthly: "Раз в месяц" },
    everyNDays: "Раз в сколько дней", everyNWeeks: "Раз в сколько недель", days: "Дни", monthDay: "Число месяца",
    time: "Время (необязательно)", start: "Начать с", save: "Добавить", saving: "Сохраняется…", added: "Добавлено.", needDays: "Выбери хотя бы один день.", needN: "Введи число от 2 до 52.",
    remove: "Убрать", confirm: "Убрать совсем?", cancel: "Оставить", removed: "Убрано.", all: "Все пункты", none: "Пока нет ни распорядка, ни дел.",
    weekdayNames: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    anchor: "После чего? (необязательно)", anchorNone: "Без якоря", anchorOwn: "Своими словами", anchorText: "После…", anchorHint: "Например, после завтрака",
  },
} as const;

/** The quiet count under a row: the weekly «N из M» (default), or the run for an adult who chose it. */
const countText = (r: OsRoutine, delta: number, lang: Lang) =>
  r.streak !== undefined ? streakText(r.streak + delta, lang) : weekText(r.week ? { done: r.week.done + delta, of: r.week.of } : null, lang);
/** «После завтрака → Собрать портфель» — the anchor in front of the title, when there is one. */
function Titled({ r, lang }: { r: OsRoutine; lang: Lang }) {
  const a = anchorLabel(r, lang);
  return a ? <><span data-anchor="" className="text-[var(--text-secondary)]">{a}</span> <span aria-hidden="true">→</span><span className="sr-only">,</span> {r.title}</> : <>{r.title}</>;
}
const kindLabel = (t: (typeof T)[Lang], r: OsRoutine) => (r.kind === "rotation" ? `${t.rotationShort}${r.members ? ` (${r.members})` : ""}` : r.kind === "chore" ? t.chore : t.routine);
const send = (method: "POST" | "PATCH", path: string, body: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" });
const fmtDay = (d: string, lang: Lang) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]";

export function Check({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${checked ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]" : "border-[var(--border-strong,var(--border))]"}`}>
      {checked && <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 7.5 5.5 10.5 11.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </span>
  );
}

/** Today's due items with a tick each. `canCheck` false → read-only (e.g. someone without the scope). */
export function TodayChecklist({ lang, today, routines, canCheck, headingId, heading, paused = false }: {
  lang: Lang; today: string; routines: OsRoutine[]; canCheck: boolean; headingId: string; heading: string; paused?: boolean;
}) {
  const t = T[lang];
  const due = routines.filter((r) => r.due_today).sort((a, b) => (a.at_time ?? "99").localeCompare(b.at_time ?? "99"));
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(due.map((r) => [r.id, r.done_today])));
  const [msg, setMsg] = useState("");
  if (paused) return (
    <section aria-labelledby={headingId} data-paused="" className="mt-8">
      <h2 id={headingId} className="font-serif text-[22px] text-[var(--foreground)]">{heading}</h2>
      <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-5 py-4 text-[16px] text-[var(--text-secondary)]">{T[lang].paused}</p>
    </section>
  );
  if (due.length === 0) return null;
  const count = due.filter((r) => done[r.id]).length;
  const toggle = async (r: OsRoutine) => {
    const next = !done[r.id];
    setDone((x) => ({ ...x, [r.id]: next })); setMsg("");
    const res = await send("POST", `${r.kind === "rotation" ? "rotations" : "routines"}/${r.id}/check`, { date: today, done: next }).catch(() => null);
    if (!res?.ok) { setDone((x) => ({ ...x, [r.id]: !next })); setMsg(t.saveError); }
  };
  return (
    <section aria-labelledby={headingId} data-checklist="" className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id={headingId} className="font-serif text-[22px] text-[var(--foreground)]">{heading}</h2>
        <p className="text-[14px] text-[var(--text-secondary)]" aria-live="polite">{t.progress(count, due.length)}</p>
      </div>
      <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {due.map((r) => {
          const s = countText(r, done[r.id] && !r.done_today ? 1 : !done[r.id] && r.done_today ? -1 : 0, lang);
          return (
            <li key={r.id} data-routine={r.kind} data-done={done[r.id] ? "1" : "0"}>
              <button type="button" role="checkbox" aria-checked={done[r.id]} disabled={!canCheck} onClick={() => toggle(r)}
                aria-label={[anchorLabel(r, lang), r.title, r.at_time, kindLabel(t, r), s].filter(Boolean).join(", ")}
                className="flex min-h-14 w-full items-center gap-4 py-3 text-left disabled:cursor-default">
                <Check checked={done[r.id]} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[17px] ${done[r.id] ? "text-[var(--text-secondary)] line-through decoration-[var(--border)]" : "text-[var(--foreground)]"}`}><Titled r={r} lang={lang} /></span>
                  <span data-count="" className="mt-0.5 block text-[14px] text-[var(--muted)]">
                    {[r.at_time, kindLabel(t, r), s].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status" aria-live="polite" className="mt-2 text-[14px] text-[var(--muted)]">{msg}</p>
    </section>
  );
}

/** The next 7 days, one line per day that has something. */
export function Agenda({ lang, routines }: { lang: Lang; routines: OsRoutine[] }) {
  const t = T[lang];
  const byDay = new Map<string, OsRoutine[]>();
  for (const r of routines) for (const d of r.next.slice(0, 7)) byDay.set(d, [...(byDay.get(d) ?? []), r]);
  const days = [...byDay.keys()].sort().slice(0, 7);
  return (
    <section aria-labelledby="agenda-h" className="mt-10">
      <h3 id="agenda-h" className="font-serif text-[20px] text-[var(--foreground)]">{t.agenda}</h3>
      {days.length === 0 ? <p className="mt-2 text-[14px] text-[var(--muted)]">{t.nothingAhead}</p> : (
        <dl data-agenda="" className="mt-3 grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2 text-[15px]">
          {days.map((d) => (
            <div key={d} className="contents">
              <dt className="text-[var(--text-secondary)]" suppressHydrationWarning>{fmtDay(d, lang)}</dt>
              <dd className="text-[var(--foreground)]">{byDay.get(d)!.sort((a, b) => (a.at_time ?? "99").localeCompare(b.at_time ?? "99")).map((r) => (r.at_time ? `${r.at_time} ${r.title}` : r.title)).join(" · ")}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** All items with their schedule; managers can remove one (two-step, no accidental taps). */
export function RoutineList({ lang, routines, canManage }: { lang: Lang; routines: OsRoutine[]; canManage: boolean }) {
  const t = T[lang];
  const router = useRouter();
  const [ask, setAsk] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const remove = async (id: string) => {
    const kind = routines.find((x) => x.id === id)?.kind;
    const r = await send("PATCH", `${kind === "rotation" ? "rotations" : "routines"}/${id}`, { archived: true }).catch(() => null);
    setAsk(null); setMsg(r?.ok ? t.removed : t.saveError); if (r?.ok) router.refresh();
  };
  return (
    // Folded by default (bus 78 #7): today's list and the agenda are what people read every day.
    <Disclosure summary={`${t.all} (${routines.length})`} className="mt-10" variant="inline" summaryClassName="w-fit font-serif text-[20px] text-[var(--foreground)]">
      {routines.length === 0 ? <p className="mt-2 text-[14px] text-[var(--muted)]">{t.none}</p> : (
        <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {routines.map((r) => (
            <li key={r.id} data-routine-row={r.kind} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] text-[var(--foreground)]"><Titled r={r} lang={lang} /></p>
                <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>
                  {[kindLabel(t, r), describeRule(r.rrule, lang), r.at_time, r.next[0] ? `${t.nextOn}: ${fmtDay(r.next[0], lang)}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canManage && (ask === r.id ? (
                <span className="flex gap-2">
                  <button type="button" className={btn} onClick={() => remove(r.id)}>{t.confirm}</button>
                  <button type="button" className={btn} onClick={() => setAsk(null)}>{t.cancel}</button>
                </span>
              ) : <button type="button" className={btn} onClick={() => setAsk(r.id)} aria-label={`${t.remove}: ${r.title}`}>{t.remove}</button>)}
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-[14px] text-[var(--muted)]">{msg}</p>
    </Disclosure>
  );
}

export function AddRoutine({ lang, personId, today, routines = [] }: { lang: Lang; personId: string; today: string; candidates?: { id: string; name: string }[]; routines?: OsRoutine[] }) {
  const t = T[lang];
  const router = useRouter();
  const [repeat, setRepeat] = useState<"daily" | "every_n" | "weekdays" | "weekly" | "monthly">("daily");
  const [n, setN] = useState("2");
  const [weeks, setWeeks] = useState("1");
  const [days, setDays] = useState<string[]>([]);
  const [monthDay, setMonthDay] = useState(String(Number(today.slice(8, 10))));
  const [dtstart, setDtstart] = useState(today);
  const [status, setStatus] = useState("");
  // «После чего?» (bus 86): another of this person's routines, or free text (≤ 60)
  const own = routines.filter((r) => r.kind === "routine");
  const [anchorSel, setAnchorSel] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [title, setTitle] = useState("");
  const anchorShown = anchorSel === "__text" ? anchorText : anchorSel ? anchorLabel({ anchor_title: own.find((r) => r.id === anchorSel)?.title }, lang) : "";
  const rrule = buildRule({ repeat, days, interval: repeat === "every_n" ? n : weeks, monthDay });
  const reset = () => { setRepeat("daily"); setN("2"); setWeeks("1"); setDays([]); setDtstart(today); setAnchorSel(""); setAnchorText(""); setTitle(""); };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rrule) return setStatus(repeat === "weekly" ? t.needDays : t.needN);
    const form = e.currentTarget, f = new FormData(form);
    setStatus(t.saving);
    const anchor = anchorSel === "__text" ? (anchorText.trim() ? { anchor_text: anchorText.trim() } : {}) : anchorSel ? { anchor_routine_id: anchorSel } : {};
    const common = { title: String(f.get("title") ?? "").trim(), rrule, dtstart: dtstart || today, at_time: f.get("at_time") || null, ...anchor };
    const r = await send("POST", `people/${personId}/routines`, { ...common, kind: "routine" }).catch(() => null);
    if (!r?.ok) return setStatus(t.saveError);
    setStatus(t.added); form.reset(); reset(); router.refresh();
  };
  return (
    <Disclosure summary={t.add} className="mt-8">
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>{t.title}<input name="title" required maxLength={120} placeholder={t.titleHint} value={title} onChange={(e) => setTitle(e.target.value)} className={field} /></label>
        <label className={label}>{t.anchor}
          <select name="anchor" className={field} value={anchorSel} onChange={(e) => setAnchorSel(e.target.value)}>
            <option value="">{t.anchorNone}</option>
            {own.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            <option value="__text">{t.anchorOwn}</option>
          </select>
        </label>
        {anchorSel === "__text" && <label className={label}>{t.anchorText}<input name="anchor_text" maxLength={60} placeholder={t.anchorHint} value={anchorText} onChange={(e) => setAnchorText(e.target.value)} className={field} /></label>}
        {ifThenText(anchorShown, title, lang) && <p data-if-then="" aria-live="polite" className="text-[15px] text-[var(--foreground)] sm:col-span-2">{ifThenText(anchorShown, title, lang)}</p>}
        {/* bus 85: one model — a routine is a personal habit; chores and turns are tasks (plan templates on the board) */}
        <p data-chores-moved="" className="text-[15px] text-[var(--text-secondary)] sm:col-span-2">{t.choresMoved} <a href={`/${lang === "EN" ? "en" : "ru"}/family/os/board#tpl-h`} className="inline-flex min-h-11 items-center underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.toTemplates}</a></p>
        <label className={label}>{t.repeat}
          <select name="repeat" className={field} value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}>
            {(["daily", "every_n", "weekdays", "weekly", "monthly"] as const).map((k) => <option key={k} value={k}>{t.repeatOpt[k]}</option>)}
          </select>
        </label>
        {repeat === "every_n" && (
          <label className={label}>{t.everyNDays}<input name="n" type="number" min={2} max={52} value={n} onChange={(e) => setN(e.target.value)} inputMode="numeric" className={field} /></label>
        )}
        {repeat === "weekly" && (
          <>
            <fieldset className="sm:col-span-2">
              <legend className={label}>{t.days}</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {WEEKDAYS.map((d, i) => (
                  <label key={d} className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border px-3 text-[15px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)] ${days.includes(d) ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]" : "border-[var(--border)] text-[var(--foreground)]"}`}>
                    <input type="checkbox" className="sr-only" checked={days.includes(d)} onChange={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))} />
                    {t.weekdayNames[i]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={label}>{t.everyNWeeks}<input name="weeks" type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(e.target.value)} inputMode="numeric" className={field} /></label>
          </>
        )}
        {repeat === "monthly" && <label className={label}>{t.monthDay}<input name="monthDay" type="number" min={1} max={31} value={monthDay} onChange={(e) => setMonthDay(e.target.value)} inputMode="numeric" className={field} /></label>}
        <label className={label}>{t.time}<input name="at_time" type="time" className={field} /></label>
        <label className={label}>{t.start}<input name="dtstart" type="date" value={dtstart} onChange={(e) => setDtstart(e.target.value)} className={field} /></label>
        <p data-schedule-summary="" aria-live="polite" className="text-[15px] text-[var(--foreground)] sm:col-span-2" suppressHydrationWarning>
          {rrule ? scheduleSummary(rrule, dtstart, lang) : repeat === "weekly" ? t.needDays : t.needN}
        </p>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]">{t.save}</button>
          <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{status}</span>
        </div>
      </form>
    </Disclosure>
  );
}
