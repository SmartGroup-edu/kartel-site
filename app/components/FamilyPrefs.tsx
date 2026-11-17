"use client";

/**
 * Notification settings and «день без ритма» for one person (Stage 3a, bus 77). Shown to the person
 * themselves and, for a child, to guardians with the routines scope — the service enforces the same rule.
 * Times are limited to 07:00–20:59 because 21:00–07:00 are the family's quiet hours.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Disclosure from "./Disclosure";
import { fmtDocDate } from "../lib/family-docs.mjs";
import type { OsPrefs, OsPause } from "../lib/family-os";

type Lang = "EN" | "RU";
const T = {
  EN: {
    title: "Emails and pauses", email: "Send me family emails", digest: "Morning summary at", evening: "Evening check-in (what is still open)", eveningAt: "Evening check-in at",
    lang: "Language of the emails", quiet: "No emails between 21:00 and 07:00.", save: "Save", saved: "Saved.", error: "Could not save — please try again.",
    pause: "A day without rhythm", pauseHint: "Holiday or illness: no items, no reminders, and streaks simply wait.", from: "From", to: "To (up to 61 days)", addPause: "Add a pause",
    pauses: "Pauses", none: "No pauses planned.", cancel: "Cancel the pause", cancelled: "Pause cancelled.", added: "Pause added.", badPause: "Check the dates: from today, up to 61 days.",
  },
  RU: {
    title: "Письма и паузы", email: "Присылать письма семьи", digest: "Утренняя сводка в", evening: "Вечерняя отметка (что ещё не сделано)", eveningAt: "Вечерняя отметка в",
    lang: "Язык писем", quiet: "С 21:00 до 07:00 писем нет.", save: "Сохранить", saved: "Сохранено.", error: "Не удалось сохранить — попробуй ещё раз.",
    pause: "День без ритма", pauseHint: "Отпуск или болезнь: ни дел, ни напоминаний, а серии просто ждут.", from: "С", to: "По (до 61 дня)", addPause: "Добавить паузу",
    pauses: "Паузы", none: "Пауз не запланировано.", cancel: "Отменить паузу", cancelled: "Пауза отменена.", added: "Пауза добавлена.", badPause: "Проверь даты: с сегодняшнего дня, не дольше 61 дня.",
  },
} as const;

const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]";
const primary = "inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]";
const check = "flex min-h-11 cursor-pointer items-center gap-3 text-[16px] text-[var(--foreground)]";
const send = (method: "POST" | "PUT" | "PATCH", path: string, body: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null);

export default function FamilyPrefs({ lang, personId, prefs, pauses, today }: { lang: Lang; personId: string; prefs: OsPrefs; pauses: OsPause[]; today: string }) {
  const t = T[lang];
  const router = useRouter();
  const [p, setP] = useState<OsPrefs>(prefs);
  const [msg, setMsg] = useState("");
  const [pmsg, setPmsg] = useState("");
  const [from, setFrom] = useState(today), [to, setTo] = useState(today);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await send("PUT", `people/${personId}/prefs`, p);
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh();
  };
  const addPause = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await send("POST", `people/${personId}/pauses`, { from_date: from, to_date: to });
    setPmsg(r?.ok ? t.added : t.badPause); if (r?.ok) router.refresh();
  };
  const cancel = async (id: string) => {
    const r = await send("PATCH", `pauses/${id}`, { cancel: true });
    setPmsg(r?.ok ? t.cancelled : t.error); if (r?.ok) router.refresh();
  };
  return (
    <section aria-labelledby="prefs-h" data-prefs="" className="mt-12">
      <h2 id="prefs-h" className="font-serif text-[28px] leading-[1.15] text-[var(--accent)] lg:text-[35px]">{t.title}</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={`${check} sm:col-span-2`}><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={p.email_on} onChange={(e) => setP({ ...p, email_on: e.target.checked })} />{t.email}</label>
        <label className={label}>{t.digest}<input type="time" min="07:00" max="20:59" required value={p.digest_time} disabled={!p.email_on} onChange={(e) => setP({ ...p, digest_time: e.target.value })} className={field} /></label>
        <label className={label}>{t.lang}
          <select className={field} value={p.lang} disabled={!p.email_on} onChange={(e) => setP({ ...p, lang: e.target.value as OsPrefs["lang"] })}><option value="ru" lang="ru">Русский</option><option value="en" lang="en">English</option></select>
        </label>
        <label className={`${check} sm:col-span-2`}><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={p.evening_on} disabled={!p.email_on} onChange={(e) => setP({ ...p, evening_on: e.target.checked })} />{t.evening}</label>
        {p.evening_on && <label className={label}>{t.eveningAt}<input type="time" min="07:00" max="20:59" required value={p.evening_time} disabled={!p.email_on} onChange={(e) => setP({ ...p, evening_time: e.target.value })} className={field} /></label>}
        <p className="text-[14px] text-[var(--muted)] sm:col-span-2">{t.quiet}</p>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={primary}>{t.save}</button>
          <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
        </div>
      </form>

      <h3 className="mt-10 font-serif text-[20px] text-[var(--foreground)]">{t.pauses}</h3>
      <p className="mt-1 text-[15px] text-[var(--text-secondary)]">{t.pauseHint}</p>
      {pauses.length === 0 ? <p className="mt-3 text-[14px] text-[var(--muted)]">{t.none}</p> : (
        <ul data-pauses="" className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {pauses.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
              <span className="text-[16px] text-[var(--foreground)]" suppressHydrationWarning>{fmtDocDate(x.from_date, lang)} — {fmtDocDate(x.to_date, lang)}</span>
              <button type="button" className={btn} onClick={() => cancel(x.id)}>{t.cancel}</button>
            </li>
          ))}
        </ul>
      )}
      <Disclosure summary={t.addPause} className="mt-4">
        <form onSubmit={addPause} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>{t.from}<input type="date" min={today} required value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} className={field} /></label>
          <label className={label}>{t.to}<input type="date" min={from} required value={to} onChange={(e) => setTo(e.target.value)} className={field} /></label>
          <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className={primary}>{t.addPause}</button></div>
        </form>
      </Disclosure>
      <p role="status" aria-live="polite" className="mt-2 text-[14px] text-[var(--muted)]">{pmsg}</p>
    </section>
  );
}
