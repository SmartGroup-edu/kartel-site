"use client";

/**
 * «Календарь» (Stage 3b, bus 79; redesigned in bus 172 P2 to the mockup v5): a week view (an hour grid with a
 * "now" line) and a month view (6×7, up to three chips a day then «+N ещё»; colour bars on a phone). A day opens a
 * side panel with that day's items. Data: Sunday councils, family events and the birthdays this viewer may see —
 * from today for the next two months (the service has no past days and no per-person events, so there is no
 * person filter: the calendar is the whole family's). Adults add and remove family events. The personal
 * phone-calendar link lives on each person's own page (it is theirs to make or revoke).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Disclosure from "./Disclosure";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { H1, META } from "../lib/typeScale";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";
import type { OsCalendar, OsCalItem } from "../lib/family-os";
import { ruPlural } from "../lib/family-routines.mjs";
import { fmtFamilyDate } from "../lib/family-docs.mjs";
import { byDay, chips, inWindow, weekOf, monthGrid, monthOf, mondayOf, monthsInWindow, weeksInWindow, hourRange, minutesFrom, weekdayMon } from "../lib/family-calendar.mjs";

type Lang = "EN" | "RU";
type View = "week" | "month";
const T = {
  RU: { week: "Неделя семьи · PDF", weekly: "Каждое воскресенье, 19:00 — семейный совет", nextOn: "Ближайший", title: "Календарь", everyone: "вся семья", council: "Семейный совет", birthday: "День рождения", add: "Добавить событие", what: "Что", when: "Дата", time: "Время (необязательно)", save: "Добавить", saved: "Добавлено.", error: "Не удалось сохранить — попробуй ещё раз.", remove: "Убрать", confirm: "Убрать событие?", keep: "Оставить", removed: "Убрано.", phone: "Хочешь видеть это в календаре телефона? Ссылка — на твоей странице.", phoneLink: "Моя страница", notMember: "Календарь видят члены семьи.",
    viewLabel: "Вид календаря", viewWeek: "Неделя", viewMonth: "Месяц", prevWeek: "Предыдущая неделя", nextWeek: "Следующая неделя", prevMonth: "Предыдущий месяц", nextMonth: "Следующий месяц", toToday: "Сегодня",
    allDay: "весь день", now: "Сейчас", more: (n: number) => `+${n} ещё`, free: "Свободный день.", noData: "Этот день календарь пока не показывает.", openWeek: "Открыть неделю", close: "Закрыть", addOn: "Добавить событие на этот день",
    dayLabel: (d: string, n: number | null) => (n === null ? `${d}: нет данных` : n ? `${d}: ${n} ${ruPlural(n, ["событие", "события", "событий"])}` : `${d}: свободно`),
    window: "Календарь показывает дни с сегодняшнего на два месяца вперёд.", legend: "Обозначения", event: "Событие", dayPanel: "События дня" },
  EN: { week: "Family week · PDF", weekly: "Every Sunday, 19:00 — family council", nextOn: "Next", title: "Calendar", everyone: "the whole family", council: "Family council", birthday: "Birthday", add: "Add an event", what: "What", when: "Date", time: "Time (optional)", save: "Add", saved: "Added.", error: "Could not save — please try again.", remove: "Remove", confirm: "Remove the event?", keep: "Keep", removed: "Removed.", phone: "Want this in your phone's calendar? The link is on your page.", phoneLink: "My page", notMember: "The calendar is for family members.",
    viewLabel: "Calendar view", viewWeek: "Week", viewMonth: "Month", prevWeek: "Previous week", nextWeek: "Next week", prevMonth: "Previous month", nextMonth: "Next month", toToday: "Today",
    allDay: "all day", now: "Now", more: (n: number) => `+${n} more`, free: "A free day.", noData: "The calendar does not show this day yet.", openWeek: "Open the week", close: "Close", addOn: "Add an event on this day",
    dayLabel: (d: string, n: number | null) => (n === null ? `${d}: no data` : n ? `${d}: ${n} event${n === 1 ? "" : "s"}` : `${d}: free`),
    window: "The calendar shows the days from today to two months ahead.", legend: "Legend", event: "Event", dayPanel: "The day's events" },
} as const;
type Dict = (typeof T)[Lang];

/** The service's window (app/lib/family-os.ts getCalendar). */
const DAYS = 62;
const HOUR = 48; // px per hour in the week grid
const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = BTN_SECONDARY;
const primary = BTN_PRIMARY;
const ICON_BTN = "grid h-11 w-11 place-items-center rounded-md border border-[var(--border)] bg-[var(--fos-panel)] text-[var(--foreground)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40";
/** Kind colours (text on its soft fill is ≥ 4.5:1 in both themes; high contrast maps them to ink). */
const TONE: Record<OsCalItem["kind"], { fg: string; bg: string }> = {
  council: { fg: "var(--ok)", bg: "var(--ok-soft)" },
  event: { fg: "var(--fos-blue)", bg: "var(--fos-blue-soft)" },
  birthday: { fg: "var(--fos-plum)", bg: "var(--fos-plum-soft)" },
};
const loc = (lang: Lang) => (lang === "EN" ? "en-GB" : "ru-RU");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (d: string, lang: Lang, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc(lang), { ...o, timeZone: "UTC" });
const dayHead = (d: string, lang: Lang) => cap(fmt(d, lang, { weekday: "long", day: "numeric", month: "long" }));
const weekRange = (days: string[], lang: Lang) => `${fmt(days[0], lang, { day: "numeric", month: days[0].slice(5, 7) === days[6].slice(5, 7) ? undefined : "long" })}–${fmt(days[6], lang, { day: "numeric", month: "long" })}`;
const monthTitle = (ym: string, lang: Lang) => cap(new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(loc(lang), { month: "long", year: "numeric", timeZone: "UTC" }));
const itemText = (i: OsCalItem, t: Dict, lang: Lang) => {
  const age = i.kind === "birthday" && typeof i.age === "number" ? (lang === "EN" ? ` — ${i.age}` : ` — ${i.age} ${ruPlural(i.age, ["год", "года", "лет"])}`) : "";
  return i.kind === "council" ? t.council : i.kind === "birthday" ? `${t.birthday}: ${lang === "EN" ? i.name_en : i.name_ru}${age}` : i.title ?? "";
};
/** London wall-clock now, for the "now" line (client only). */
const londonNow = () => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? "00"; return { date: `${g("year")}-${g("month")}-${g("day")}`, hhmm: `${g("hour")}:${g("minute")}` }; };

export default function FamilyCalendar({ lang, cal, meId, initialView = "week", child = false }: { lang: Lang; cal: OsCalendar | null; meId: string | null; initialView?: View; child?: boolean }) {
  const t = tx(T, lang);
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os`;
  const [view, setView] = useState<View>(initialView);
  const today = cal?.today ?? "";
  const weeks = cal ? weeksInWindow(today, DAYS) : [], months = cal ? monthsInWindow(today, DAYS) : [];
  const [wi, setWi] = useState(0);
  const [mi, setMi] = useState(0);
  const [day, setDay] = useState<string | null>(null);
  const days = byDay(cal?.items ?? []) as Map<string, OsCalItem[]>;
  const council = cal?.items.find((i) => i.kind === "council");
  const weekDays = cal ? weekOf(weeks[wi]) : [];
  const sub = view === "week" ? (cal ? weekRange(weekDays, lang) : "") : cal ? monthTitle(months[mi], lang) : "";
  // The panel is opened from a day button, not a Dialog trigger: remember it, so focus goes back there on close.
  const opener = useRef<HTMLElement | null>(null);
  const pickDay = (d: string) => { opener.current = document.activeElement as HTMLElement | null; setDay(d); };
  const openWeek = (d: string) => { const k = weeks.indexOf(mondayOf(d)); if (k >= 0) { setWi(k); setView("week"); } setDay(null); };
  const step = (n: number) => (view === "week" ? setWi((x) => Math.min(weeks.length - 1, Math.max(0, x + n))) : setMi((x) => Math.min(months.length - 1, Math.max(0, x + n))));
  const atStart = view === "week" ? wi === 0 : mi === 0, atEnd = view === "week" ? wi === weeks.length - 1 : mi === months.length - 1;
  return (
    <>
      <div data-fos-page="">
        <div className="pb-8">
          {/* L6: the owner who is not a member still gets the page's H1 above the one line */}
          {!cal ? <><h1 className={H1}>{t.title}</h1><p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p></> : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className={H1}>{t.title}</h1>
                  <p data-cal-sub="" className="mt-1 text-[15px] text-[var(--muted)]" suppressHydrationWarning>{sub} · {t.everyone}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div role="group" aria-label={t.viewLabel} data-cal-view="" className="inline-flex rounded-[12px] border border-[var(--border)] bg-[var(--fos-panel-2)] p-[3px]">
                    {(["week", "month"] as const).map((v) => (
                      <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                        className={`inline-flex min-h-11 items-center rounded-[9px] px-4 text-[14px] font-semibold ${view === v ? "bg-[var(--fos-panel)] text-[var(--foreground)] shadow-[var(--fos-shadow)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>{v === "week" ? t.viewWeek : t.viewMonth}</button>
                    ))}
                  </div>
                  <button type="button" className={ICON_BTN} onClick={() => step(-1)} disabled={atStart} aria-label={view === "week" ? t.prevWeek : t.prevMonth}><ChevronLeft aria-hidden="true" size={18} /></button>
                  <button type="button" className={ICON_BTN} onClick={() => step(1)} disabled={atEnd} aria-label={view === "week" ? t.nextWeek : t.nextMonth}><ChevronRight aria-hidden="true" size={18} /></button>
                  <button type="button" className={btn} onClick={() => { setWi(0); setMi(0); }} disabled={atStart}>{t.toToday}</button>
                </div>
              </div>
              {/* bus 80 #3 / 83 L1: the weekly rhythm once, pinned — two plain lines, not a link */}
              <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div data-council-pinned="" className="rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] px-4 py-3">
                  <p className="text-[16px] text-[var(--foreground)]">{t.weekly}</p>
                  {council && <p className="mt-0.5 text-[15px] text-[var(--muted)]" suppressHydrationWarning>{t.nextOn} — {fmtFamilyDate(council.date, lang, cal.today)}</p>}
                </div>
                {/* bus 171: the printable family week lives under Календарь */}
                {meId && <div className="text-[15px]">
                  {/* bus 172 P3: a child's menu has no family week sheet (its page sends a child to «Мой день») */}
                  {!child && <p><Link prefetch={false} href={`${base}/week`} data-week-link="" className="inline-flex min-h-11 items-center text-[16px] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.week}</Link></p>}
                  <p className="text-[var(--text-secondary)]">{t.phone} <Link prefetch={false} href={`${base}/people/${meId}#phone-calendar`} className="inline-flex min-h-11 items-center underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.phoneLink}</Link></p>
                </div>}
              </div>
              {cal.can.write && <AddEvent t={t} today={cal.today} />}
              <div className="mt-6">
                {view === "week"
                  ? <WeekGrid t={t} lang={lang} days={weekDays} items={days} today={today} onDay={pickDay} />
                  : <MonthGrid t={t} lang={lang} ym={months[mi]} items={days} today={today} onDay={pickDay} />}
              </div>
              <Legend t={t} />
              <p className={`${META} mt-2`}>{t.window}</p>
            </>
          )}
        </div>
      </div>
      {cal && <DayPanel t={t} lang={lang} day={day} items={day ? days.get(day) ?? [] : []} known={day ? inWindow(day, today, DAYS) : false} canWrite={cal.can.write && Boolean(day && day >= today)} base={base} child={child}
        showWeek={view === "month"} onWeek={openWeek} onClose={() => setDay(null)} returnFocus={opener} />}
    </>
  );
}

function Legend({ t }: { t: Dict }) {
  return (
    <ul aria-label={t.legend} className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-[var(--text-secondary)]">
      {(["event", "council", "birthday"] as const).map((k) => (
        <li key={k} className="flex items-center gap-2"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: TONE[k].fg }} />{k === "event" ? t.event : k === "council" ? t.council : t.birthday}</li>
      ))}
    </ul>
  );
}

/** Week: day headers (each opens the day), an all-day row, then the hour grid with a "now" line on today. */
function WeekGrid({ t, lang, days, items, today, onDay }: { t: Dict; lang: Lang; days: string[]; items: Map<string, OsCalItem[]>; today: string; onDay: (d: string) => void }) {
  const all = days.flatMap((d) => items.get(d) ?? []);
  const [H0, H1] = hourRange(all) as [number, number];
  const [now, setNow] = useState<{ date: string; hhmm: string } | null>(null);
  useEffect(() => { const tick = () => setNow(londonNow()); tick(); const id = window.setInterval(tick, 60_000); return () => window.clearInterval(id); }, []);
  const untimed = days.map((d) => (items.get(d) ?? []).filter((i) => !i.time));
  const hasUntimed = untimed.some((x) => x.length);
  const nowTop = now && days.includes(now.date) ? (minutesFrom(now.hhmm, H0) * HOUR) / 60 : null;
  // On a phone the 7 days scroll sideways: bring today's column into view, so the week opens on today.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current, col = el?.querySelector<HTMLElement>(`[data-cal-head="${today}"]`);
    if (el && col && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, col.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft - 56);
  }, [days, today]);
  return (
    <div ref={scroller} data-cal-week="" className="overflow-x-auto rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] shadow-[var(--fos-shadow)]">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[var(--border)]">
          <div />
          {days.map((d) => {
            const n = inWindow(d, today, DAYS) ? (items.get(d) ?? []).length : null, isToday = d === today;
            return (
              <button key={d} type="button" onClick={() => onDay(d)} aria-current={isToday ? "date" : undefined} data-cal-head={d}
                className="relative min-h-11 px-2 py-2.5 text-center text-[13px] text-[var(--muted)] hover:bg-[var(--fos-panel-2)]">
                {/* the visible «Пт 27» stays in the name (WCAG 2.5.3); the full date and the count follow for screen readers */}
                <span>{cap(fmt(d, lang, { weekday: "short" }))}</span>
                <b className={`mx-auto mt-0.5 grid h-[34px] w-[34px] place-items-center rounded-full text-[19px] font-semibold ${isToday ? "bg-[var(--fos-accent-2)] text-[var(--fos-on-accent-2)]" : "text-[var(--foreground)]"}`}>{Number(d.slice(8))}</b>
                <span className="sr-only"> · {t.dayLabel(dayHead(d, lang), n)}</span>
              </button>
            );
          })}
        </div>
        {hasUntimed && (
          <div data-cal-allday="" className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[var(--border)]">
            <div className="px-2 py-1.5 text-right text-[11px] text-[var(--muted)]">{t.allDay}</div>
            {untimed.map((list, i) => (
              <div key={days[i]} className="grid content-start gap-1 border-l border-[var(--border)] p-1">
                {list.map((x, n) => <Chip key={n} t={t} lang={lang} i={x} onClick={() => onDay(days[i])} />)}
              </div>
            ))}
          </div>
        )}
        <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
          <div aria-hidden="true">{Array.from({ length: H1 - H0 }, (_, k) => <div key={k} style={{ height: HOUR }} className={`${k ? "-translate-y-[7px]" : "pt-0.5"} px-2 text-right text-[11px] text-[var(--muted)]`}>{String(H0 + k).padStart(2, "0")}:00</div>)}</div>
          {days.map((d) => {
            const timed = (items.get(d) ?? []).filter((i) => i.time);
            return (
              <div key={d} data-cal-day={d} className={`relative border-l border-[var(--border)] ${d === today ? "bg-[color-mix(in_srgb,var(--accent-soft)_45%,transparent)]" : ""} ${inWindow(d, today, DAYS) ? "" : "bg-[var(--fos-panel-2)]"}`}
                style={{ height: (H1 - H0) * HOUR, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR - 1}px, var(--border) ${HOUR - 1}px ${HOUR}px)` }}>
                {timed.map((x, n) => {
                  const same = timed.filter((y) => y.time!.slice(0, 2) === x.time!.slice(0, 2)), k = same.indexOf(x);
                  return (
                    <button key={n} type="button" onClick={() => onDay(d)} data-cal={x.kind}
                      className="absolute overflow-hidden rounded-[8px] border-l-[3px] px-1.5 py-1 text-left text-[12px] font-semibold leading-tight"
                      style={{ top: (minutesFrom(x.time!, H0) * HOUR) / 60 + 2, height: HOUR - 4, left: `calc(${(k / same.length) * 100}% + 3px)`, width: `calc(${100 / same.length}% - 6px)`, background: TONE[x.kind].bg, borderColor: TONE[x.kind].fg, color: TONE[x.kind].fg }}>
                      {itemText(x, t, lang)}<span className="block text-[11px] font-medium opacity-90">{x.time}</span>
                    </button>
                  );
                })}
                {nowTop !== null && now!.date === d && nowTop >= 0 && nowTop <= (H1 - H0) * HOUR && (
                  <div data-cal-now="" className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-[var(--destructive)]" style={{ top: nowTop }}>
                    <span aria-hidden="true" className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rounded-full bg-[var(--destructive)]" /><span className="sr-only">{t.now} {now!.hhmm}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A chip: a coloured line with the item; on a phone (< 900 px) the month grid shows it as a bar only. */
function Chip({ t, lang, i, onClick, bar = false }: { t: Dict; lang: Lang; i: OsCalItem; onClick?: () => void; bar?: boolean }) {
  const s = { background: TONE[i.kind].bg, borderColor: TONE[i.kind].fg, color: TONE[i.kind].fg };
  const cls = `block w-full truncate rounded-[5px] border-l-[3px] px-1.5 py-0.5 text-left text-[11px] font-semibold ${bar ? "max-[899px]:h-[5px] max-[899px]:border-l-0 max-[899px]:p-0 max-[899px]:text-[0px] max-[899px]:bg-current!" : ""}`;
  const text = `${i.time ? `${i.time} ` : ""}${itemText(i, t, lang)}`;
  return onClick ? <button type="button" onClick={onClick} className={cls} style={s}>{text}</button> : <span className={cls} style={s}>{text}</span>;
}

/** Month: 6×7 from the Monday on or before the 1st; up to 3 chips, then «+N ещё». Every cell is one button. */
function MonthGrid({ t, lang, ym, items, today, onDay }: { t: Dict; lang: Lang; ym: string; items: Map<string, OsCalItem[]>; today: string; onDay: (d: string) => void }) {
  const cells = monthGrid(ym) as string[];
  const heads = cells.slice(0, 7).map((d) => cap(fmt(d, lang, { weekday: "short" })));
  return (
    <div data-cal-month="" className="overflow-hidden rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] shadow-[var(--fos-shadow)]">
      <div aria-hidden="true" className="grid grid-cols-7 border-b border-[var(--border)]">{heads.map((h) => <div key={h} className="px-2 py-2.5 text-[12px] uppercase tracking-[0.06em] text-[var(--muted)] min-[900px]:px-2.5">{h}</div>)}</div>
      <ul className="grid grid-cols-7">
        {cells.map((d) => {
          const known = inWindow(d, today, DAYS), list = items.get(d) ?? [], { shown, more } = chips(list, 3) as { shown: OsCalItem[]; more: number };
          const out = monthOf(d) !== ym, isToday = d === today, weekend = weekdayMon(d) > 4;
          return (
            <li key={d} className="border-b border-r border-[var(--border)] [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0">
              <button type="button" onClick={() => onDay(d)} data-mcell={d} aria-label={t.dayLabel(dayHead(d, lang), known ? list.length : null)} aria-current={isToday ? "date" : undefined}
                className={`flex h-full min-h-[62px] w-full flex-col gap-[3px] p-1 text-left hover:bg-[var(--fos-panel-2)] min-[900px]:min-h-[112px] min-[900px]:p-1.5 ${out || !known ? "bg-[var(--fos-panel-2)]" : ""}`}>
                <span aria-hidden="true" className={`mb-0.5 grid h-[26px] w-[26px] place-items-center rounded-full text-[13px] ${isToday ? "bg-[var(--fos-accent-2)] font-semibold text-[var(--fos-on-accent-2)]" : out || weekend ? "text-[var(--muted)]" : "font-semibold text-[var(--foreground)]"}`}>{Number(d.slice(8))}</span>
                <span aria-hidden="true" className="grid gap-[3px]">
                  {shown.map((x, n) => <Chip key={n} t={t} lang={lang} i={x} bar />)}
                  {more > 0 && <span className="pl-1 text-[11px] text-[var(--muted)] max-[899px]:hidden">{t.more(more)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The day's side panel: its items (adults may remove an event), «Открыть неделю» from the month, and add on this day. */
function DayPanel({ t, lang, day, items, known, canWrite, base, child = false, showWeek, onWeek, onClose, returnFocus }: { t: Dict; lang: Lang; day: string | null; items: OsCalItem[]; known: boolean; canWrite: boolean; base: string; child?: boolean; showWeek: boolean; onWeek: (d: string) => void; onClose: () => void; returnFocus: React.RefObject<HTMLElement | null> }) {
  return (
    <Dialog open={Boolean(day)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent closeLabel={t.close} data-day-panel="" onCloseAutoFocus={(e) => { const el = returnFocus.current; if (el?.isConnected) { e.preventDefault(); el.focus(); } }} className="left-auto right-0 top-0 h-dvh w-full max-w-md translate-x-0 translate-y-0 content-start gap-3 overflow-y-auto rounded-none border-0 border-l border-[var(--border)] bg-[var(--fos-panel)] p-5 shadow-[var(--fos-shadow-lg)] sm:max-w-md">
        {day && (
          <>
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{cap(fmt(day, lang, { weekday: "long" }))}</p>
            <DialogTitle className="font-serif text-[26px] font-semibold leading-tight text-[var(--foreground)]">{fmt(day, lang, { day: "numeric", month: "long" })}</DialogTitle>
            <DialogDescription className="sr-only">{t.dayPanel}</DialogDescription>
            {!known ? <p className="text-[15px] text-[var(--muted)]">{t.noData}</p>
              : items.length === 0 ? <p className="py-4 text-center text-[15px] text-[var(--muted)]">{t.free}</p>
              : <ul data-day-items="" className="divide-y divide-[var(--border)]">{items.map((i, n) => <Item key={`${i.kind}-${i.id ?? i.person_id ?? n}`} t={t} lang={lang} i={i} canWrite={canWrite} base={base} child={child} />)}</ul>}
            <div className="mt-2 flex flex-wrap gap-2">
              {showWeek && known && <button type="button" className={btn} onClick={() => onWeek(day)}>{t.openWeek}</button>}
            </div>
            {canWrite && <AddEvent t={t} today={day} summary={t.addOn} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Item({ t, lang, i, canWrite, base, child = false }: { t: Dict; lang: Lang; i: OsCalItem; canWrite: boolean; base: string; child?: boolean }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const remove = async () => {
    const r = await fetch(`/api/family-os/events/${i.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ archived: true }), credentials: "same-origin" }).catch(() => null);
    setAsk(false); if (r?.ok) router.refresh();
  };
  const text = itemText(i, t, lang);
  return (
    <li data-cal={i.kind} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span className="w-[76px] shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-secondary)]">{i.time ?? t.allDay}</span>
      <i aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE[i.kind].fg }} />
      {/* bus 172 P3 QA: a child has no «Решения» — the council is plain text for them */}
      {i.kind === "council" && !child ? <Link prefetch={false} href={`${base}/council`} className="inline-flex min-h-11 flex-1 items-center text-[16px] text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{text}</Link>
        : <span className="inline-flex min-h-11 flex-1 items-center text-[16px] text-[var(--foreground)]">{text}</span>}
      {i.kind === "event" && canWrite && (ask ? (
        <span className="flex gap-2"><button type="button" className={BTN_DANGER} onClick={remove}>{t.confirm}</button><button type="button" className={btn} onClick={() => setAsk(false)}>{t.keep}</button></span>
      ) : <button type="button" className={btn} onClick={() => setAsk(true)} aria-label={`${t.remove}: ${i.title}`}>{t.remove}</button>)}
    </li>
  );
}

function AddEvent({ t, today, summary }: { t: Dict; today: string; summary?: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const r = await fetch("/api/family-os/events", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ title: String(f.get("title") ?? "").trim(), on_date: f.get("on_date"), at_time: f.get("at_time") || null }) }).catch(() => null);
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { form.reset(); router.refresh(); }
  };
  return (
    <Disclosure summary={summary ?? t.add} className="mt-6">
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>{t.what}<input name="title" required maxLength={120} className={field} /></label>
        <label className={label}>{t.when}<input name="on_date" type="date" required min={today} defaultValue={today} className={field} /></label>
        <label className={label}>{t.time}<input name="at_time" type="time" className={field} /></label>
        <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className={primary}>{t.save}</button><span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span></div>
      </form>
    </Disclosure>
  );
}
