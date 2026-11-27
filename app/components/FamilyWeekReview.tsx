"use client";

/**
 * «Обзор недели» (bus 172 P6, mockup v5): «Сделано», «Сорвалось или ждёт» and «Фокус следующей недели».
 * The lists are built on the server from this week's boards (app/lib/family-week-review.mjs); each row opens that day's
 * «Задачи». The focus is next week's sprint goals — the service's own store (at most three, adults write, the service
 * decides): new lines are POST /sprint/goals, edits PATCH /sprint/goals/:id, a cleared line archives its goal.
 * Not in the mockup's page: «Компании за неделю» (no weekly company data) and «Завершить обзор» (nothing records a
 * finished review) — see the bus 172 P6 reply.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { H1 } from "../lib/typeScale";
import { BTN_PRIMARY, OS_H2 } from "../lib/family-ui";
import type { OsSprint } from "../lib/family-os";
import { osSend } from "./FamilyBoard";
import { tx } from "../lib/typograph.mjs";

type Lang = "EN" | "RU";
type Why = "late" | "carried" | "declined" | "not_accepted" | null;
type Row = { id: string; title: string; date: string; who: string[]; why: Why };
export type WeekReview = { from: string; to: string; today: string; done: Row[]; waiting: Row[]; slipped: Row[]; missing: number };

const T = {
  RU: {
    title: "Обзор недели", sub: (r: string) => `${r} · что получилось, что нет и на чём фокус`,
    done: "Сделано", slipWait: "Сорвалось или ждёт", slipped: "Сорвалось", waiting: "Ждёт решения",
    why: { late: "не сделано в свой день", carried: "перенесено с другого дня", declined: "«Не могу» — решают родители", not_accepted: "не принято до 12:00" } as Record<string, string>,
    noneDone: "На этой неделе пока ничего не отмечено готовым.", noneSlip: "Всё по плану: ничего не сорвалось и ничего не ждёт.",
    partial: (n: number) => `Доска не ответила за ${n} ${n === 1 ? "день" : n < 5 ? "дня" : "дней"} — списки неполные.`,
    down: "Доска задач сейчас не ответила, поэтому обзор собрать не получилось. Попробуй через минуту.",
    focus: "Фокус следующей недели", focusHint: "Не больше трёх. Всё остальное — потом.", focusWeek: (r: string) => `Неделя ${r}`,
    focusLine: (n: number) => `Фокус ${n}`, focusSave: "Сохранить фокус", focusNone: "Фокус на следующую неделю пока не задан.",
    focusRead: "Фокус задают взрослые на семейном совете.", focusDown: "Цели следующей недели сейчас не загрузились.",
    saved: "Сохранено.", error: "Не получилось сохранить. Попробуй ещё раз.", max: "Не больше трёх целей.",
    focusNote: "Это цели спринта следующей недели: они же видны в «Задачах» и на совете.",
  },
  EN: {
    title: "Weekly review", sub: (r: string) => `${r} · what worked, what did not, and the focus`,
    done: "Done", slipWait: "Slipped or waiting", slipped: "Slipped", waiting: "Waiting for a decision",
    why: { late: "not done on its day", carried: "carried over from another day", declined: "“Can't” — parents decide", not_accepted: "not accepted by 12:00" } as Record<string, string>,
    noneDone: "Nothing has been marked done this week yet.", noneSlip: "All on plan: nothing slipped and nothing is waiting.",
    partial: (n: number) => `The board did not answer for ${n} day${n === 1 ? "" : "s"} — the lists are incomplete.`,
    down: "The task board did not answer, so the review could not be built. Please try again in a minute.",
    focus: "Focus for next week", focusHint: "Three at most. Everything else can wait.", focusWeek: (r: string) => `Week of ${r}`,
    focusLine: (n: number) => `Focus ${n}`, focusSave: "Save the focus", focusNone: "No focus has been set for next week yet.",
    focusRead: "The adults set the focus at the family council.", focusDown: "Next week's goals did not load.",
    saved: "Saved.", error: "Could not save. Please try again.", max: "Three goals at most.",
    focusNote: "These are next week's sprint goals: the same ones «Tasks» and the council show.",
  },
} as const;
type Dict = (typeof T)[Lang];

const CARD = "rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] p-5 shadow-[var(--fos-shadow)]";
const field = "block min-h-11 w-full rounded-[10px] border border-[var(--border)] bg-[var(--fos-panel)] px-3 py-2 text-[16px] leading-6 text-[var(--foreground)]";
const loc = (lang: Lang) => (lang === "EN" ? "en-GB" : "ru-RU");
const fmt = (d: string, lang: Lang, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc(lang), { ...o, timeZone: "UTC" });
const range = (a: string, b: string, lang: Lang) => `${fmt(a, lang, { day: "numeric", month: a.slice(5, 7) === b.slice(5, 7) ? undefined : "long" })} – ${fmt(b, lang, { day: "numeric", month: "long" })}`;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

export default function FamilyWeekReview({ lang, review, sprint }: { lang: Lang; review: WeekReview | null; sprint: OsSprint | null }) {
  const t = tx(T, lang);
  return (
    <section aria-labelledby="review-h" className="pb-8">
      <h1 id="review-h" className={H1}>{t.title}</h1>
      {!review ? <p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.down}</p> : (
        <>
          <p className="mt-1 text-[15px] text-[var(--muted)]" suppressHydrationWarning>{t.sub(range(review.from, review.to, lang))}</p>
          {review.missing > 0 && <p role="status" data-review-partial="" className="mt-3 text-[14px] text-[var(--fos-amber)]">{t.partial(review.missing)}</p>}
          <div className="mt-6 grid grid-cols-1 gap-[18px] min-[1100px]:grid-cols-3">
            <div data-review="done" className={CARD}>
              <h2 className={OS_H2}>{t.done}</h2>
              <p className="mt-1 font-serif text-[34px] font-semibold leading-none text-[var(--ok)]">{review.done.length}</p>
              <Rows t={t} lang={lang} rows={review.done} empty={t.noneDone} showWhy={false} />
            </div>
            <div data-review="slipped" className={CARD}>
              <h2 className={OS_H2}>{t.slipWait}</h2>
              <p className="mt-1 font-serif text-[34px] font-semibold leading-none text-[var(--fos-amber)]">{review.slipped.length + review.waiting.length}</p>
              {review.slipped.length + review.waiting.length === 0 ? <p className="mt-3 text-[14px] text-[var(--muted)]">{t.noneSlip}</p> : (
                <>
                  {review.waiting.length > 0 && <><h3 className="mt-4 text-[14px] font-semibold text-[var(--foreground)]">{t.waiting} · {review.waiting.length}</h3><Rows t={t} lang={lang} rows={review.waiting} /></>}
                  {review.slipped.length > 0 && <><h3 className="mt-4 text-[14px] font-semibold text-[var(--foreground)]">{t.slipped} · {review.slipped.length}</h3><Rows t={t} lang={lang} rows={review.slipped} /></>}
                </>
              )}
            </div>
            <Focus t={t} lang={lang} sprint={sprint} nextFrom={addDays(review.from, 7)} />
          </div>
        </>
      )}
    </section>
  );
}

function Rows({ t, lang, rows, empty = "", showWhy = true }: { t: Dict; lang: Lang; rows: Row[]; empty?: string; showWhy?: boolean }) {
  if (rows.length === 0) return <p className="mt-3 text-[14px] text-[var(--muted)]">{empty}</p>;
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os/board`;
  return (
    <ul className="mt-2 divide-y divide-[var(--border)]">
      {rows.map((r) => (
        <li key={r.id} data-row={r.why ?? "done"}>
          <Link prefetch={false} href={`${base}?date=${r.date}`} className="block min-h-11 py-2 hover:text-[var(--accent)]">
            <b className="block text-[15px] font-semibold leading-snug text-[var(--foreground)]">{r.title}</b>
            <span className="block text-[13px] text-[var(--muted)]" suppressHydrationWarning>
              {[r.who.join(", "), fmt(r.date, lang, { weekday: "short", day: "numeric" }), showWhy && r.why ? t.why[r.why] : ""].filter(Boolean).join(" · ")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** «Фокус следующей недели»: three lines over next week's sprint goals. Read-only for whoever the service does not let write. */
function Focus({ t, lang, sprint, nextFrom }: { t: Dict; lang: Lang; sprint: OsSprint | null; nextFrom: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const goals = sprint?.goals ?? [];
  const week = sprint?.week_start ?? nextFrom;
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const lines = [0, 1, 2].map((i) => String(f.get(`focus${i}`) ?? "").replace(/\s+/g, " ").trim());
    setBusy(true);
    let ok = true, max = false;
    for (let i = 0; i < 3; i++) {
      const g = goals[i], v = lines[i];
      // undefined: nothing to send for this line; null: the request itself failed (osSend swallows network errors)
      let r: Response | null | undefined;
      if (g && v && v !== g.title) r = await osSend("PATCH", `sprint/goals/${g.id}`, { title: v });
      else if (g && !v) r = await osSend("PATCH", `sprint/goals/${g.id}`, { archived: true });
      else if (!g && v) r = await osSend("POST", "sprint/goals", { title: v, week_start: week });
      if (r === undefined) continue;
      if (!r?.ok) { ok = false; if (r?.status === 409) max = true; }
    }
    setBusy(false);
    setMsg(ok ? t.saved : max ? t.max : t.error);
    router.refresh();
  };
  return (
    <div data-review="focus" className={`${CARD} border-[var(--fos-gold-line)]`}>
      <h2 className={OS_H2}>{t.focus}</h2>
      <p className="mt-1 text-[13px] text-[var(--muted)]" suppressHydrationWarning>{t.focusWeek(range(week, addDays(week, 6), lang))} · {t.focusHint}</p>
      {!sprint ? <p role="status" className="mt-3 text-[14px] text-[var(--muted)]">{t.focusDown}</p> : sprint.can.write ? (
        <form onSubmit={save} data-focus-form="" className="mt-3 grid gap-2">
          {[0, 1, 2].map((i) => (
            <label key={goals[i]?.id ?? `new${i}`} className="block">
              <span className="sr-only">{t.focusLine(i + 1)}</span>
              <textarea name={`focus${i}`} rows={2} defaultValue={goals[i]?.title ?? ""} maxLength={160} placeholder={t.focusLine(i + 1)} className={`${field} resize-none`} />
            </label>
          ))}
          <button type="submit" disabled={busy} className={`${BTN_PRIMARY} mt-1 justify-self-start`}>{t.focusSave}</button>
          <span role="status" aria-live="polite" className="block min-h-5 text-[14px] text-[var(--muted)]">{msg}</span>
        </form>
      ) : goals.length === 0 ? <p className="mt-3 text-[14px] text-[var(--muted)]">{t.focusNone} {t.focusRead}</p> : (
        <ol data-focus-read="" className="mt-3 grid list-decimal gap-1.5 pl-5 text-[15px] text-[var(--foreground)]">{goals.map((g) => <li key={g.id}>{g.title}</li>)}</ol>
      )}
      <p className="mt-3 text-[13px] text-[var(--muted)]">{t.focusNote}</p>
    </div>
  );
}
