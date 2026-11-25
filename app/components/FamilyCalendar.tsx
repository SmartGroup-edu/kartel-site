"use client";

/**
 * Family calendar (Stage 3b, bus 79): the next two months — Sunday councils, family events and the
 * birthdays this viewer may see (the service filters them). Adults add and remove family events.
 * The personal phone-calendar link lives on each person's own page (it is theirs to make or revoke).
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
import { useLangToggle } from "./useLang";
import { H1, META } from "../lib/typeScale";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";
import type { OsCalendar, OsCalItem } from "../lib/family-os";
import { ruPlural } from "../lib/family-routines.mjs";
import { fmtFamilyDate } from "../lib/family-docs.mjs";

type Lang = "EN" | "RU";
const T = {
  RU: { weekly: "Каждое воскресенье, 19:00 — семейный совет", nextOn: "Ближайший", title: "Календарь", intro: "Два месяца вперёд: события семьи и дни рождения.", council: "Семейный совет", birthday: "День рождения", add: "Добавить событие", what: "Что", when: "Дата", time: "Время (необязательно)", save: "Добавить", saved: "Добавлено.", error: "Не удалось сохранить — попробуй ещё раз.", remove: "Убрать", confirm: "Убрать событие?", keep: "Оставить", removed: "Убрано.", empty: "Ничего не запланировано.", phone: "Хочешь видеть это в календаре телефона? Ссылка — на твоей странице.", phoneLink: "Моя страница", notMember: "Календарь видят члены семьи." },
  EN: { weekly: "Every Sunday, 19:00 — family council", nextOn: "Next", title: "Calendar", intro: "The next two months: family events and birthdays.", council: "Family council", birthday: "Birthday", add: "Add an event", what: "What", when: "Date", time: "Time (optional)", save: "Add", saved: "Added.", error: "Could not save — please try again.", remove: "Remove", confirm: "Remove the event?", keep: "Keep", removed: "Removed.", empty: "Nothing planned.", phone: "Want this in your phone's calendar? The link is on your page.", phoneLink: "My page", notMember: "The calendar is for family members." },
} as const;
type Dict = (typeof T)[Lang];

const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = BTN_SECONDARY;
const primary = BTN_PRIMARY;
const dayHead = (d: string, lang: Lang) => { const s = new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); return s.charAt(0).toUpperCase() + s.slice(1); };

export default function FamilyCalendar({ lang, cal, meId, admin, editor = false }: { lang: Lang; cal: OsCalendar | null; meId: string | null; admin: boolean; editor?: boolean }) {
  const t = tx(T, lang);
  const toggleLang = useLangToggle(lang);
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os`;
  const days = new Map<string, OsCalItem[]>();
  for (const i of cal?.items ?? []) days.set(i.date, [...(days.get(i.date) ?? []), i]);
  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} />
      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin={admin} editor={editor} os active="calendar" />
        <div className="max-w-4xl pb-8">
          {/* L6: the owner who is not a member still gets the page's H1 above the one line */}
          {!cal ? <><h1 className={H1}>{t.title}</h1><p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p></> : (
            <>
              <h1 className={H1}>{t.title}</h1>
              <p className={`${META} mt-3`}>{t.intro}</p>
              {/* bus 80 #3: the weekly rhythm once, pinned; only the next council sits in the list */}
              {/* bus 83 L1: two plain lines — the rhythm, then the next date (muted); not a link */}
              <div data-council-pinned="" className="mt-4 rounded-lg border border-[var(--border)] px-4 py-3">
                <p className="text-[16px] text-[var(--foreground)]">{t.weekly}</p>
                {cal.items.find((i) => i.kind === "council") && <p className="mt-0.5 text-[15px] text-[var(--muted)]" suppressHydrationWarning>{t.nextOn} — {fmtFamilyDate(cal.items.find((i) => i.kind === "council")!.date, lang, cal.today)}</p>}
              </div>
              {meId && <p className="mt-3 text-[15px] text-[var(--text-secondary)]">{t.phone} <Link href={`${base}/people/${meId}#phone-calendar`} className="inline-flex min-h-11 items-center underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.phoneLink}</Link></p>}
              {cal.can.write && <AddEvent t={t} today={cal.today} />}
              {days.size === 0 ? <p className={`${META} mt-8`}>{t.empty}</p> : (
                <ol data-calendar="" className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {[...days].map(([d, items]) => (
                    <li key={d} className="py-3">
                      <h2 className="text-[15px] font-medium text-[var(--text-secondary)]" suppressHydrationWarning>{dayHead(d, lang)}</h2>
                      <ul className="mt-1 space-y-1">
                        {items.map((i, n) => <Item key={`${i.kind}-${i.id ?? i.person_id ?? n}`} t={t} lang={lang} i={i} canWrite={cal.can.write} base={base} />)}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}

function Item({ t, lang, i, canWrite, base }: { t: Dict; lang: Lang; i: OsCalItem; canWrite: boolean; base: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const remove = async () => {
    const r = await fetch(`/api/family-os/events/${i.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ archived: true }), credentials: "same-origin" }).catch(() => null);
    setAsk(false); if (r?.ok) router.refresh();
  };
  const age = i.kind === "birthday" && typeof i.age === "number" ? (lang === "EN" ? ` — ${i.age}` : ` — ${i.age}\u00a0${ruPlural(i.age, ["год", "года", "лет"])}`) : "";
  const text = i.kind === "council" ? t.council : i.kind === "birthday" ? `${t.birthday}: ${lang === "EN" ? i.name_en : i.name_ru}${age}` : i.title;
  return (
    <li data-cal={i.kind} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-14 shrink-0 text-[15px] tabular-nums text-[var(--muted)]">{i.time ?? ""}</span>
      {i.kind === "council" ? <Link href={`${base}/council`} className="inline-flex min-h-11 items-center text-[16px] text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{text}</Link>
        : <span className="inline-flex min-h-11 flex-1 items-center text-[16px] text-[var(--foreground)]">{text}</span>}
      {i.kind === "event" && canWrite && (ask ? (
        <span className="flex gap-2"><button type="button" className={BTN_DANGER} onClick={remove}>{t.confirm}</button><button type="button" className={btn} onClick={() => setAsk(false)}>{t.keep}</button></span>
      ) : <button type="button" className={btn} onClick={() => setAsk(true)} aria-label={`${t.remove}: ${i.title}`}>{t.remove}</button>)}
    </li>
  );
}

function AddEvent({ t, today }: { t: Dict; today: string }) {
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
    <Disclosure summary={t.add} className="mt-6">
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>{t.what}<input name="title" required maxLength={120} className={field} /></label>
        <label className={label}>{t.when}<input name="on_date" type="date" required min={today} defaultValue={today} className={field} /></label>
        <label className={label}>{t.time}<input name="at_time" type="time" className={field} /></label>
        <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className={primary}>{t.save}</button><span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span></div>
      </form>
    </Disclosure>
  );
}
