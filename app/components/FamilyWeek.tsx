"use client";

// «Неделя семьи · PDF» (bus 84/97 item 5). On screen: the sheet plus «Распечатать или сохранить PDF» and the
// recognitions opt-in. In print: the sheet only, A4, black on white (the print block in globals.css).
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FamilySubNav from "./FamilySubNav";
import { familyNav } from "../content/siteNav";
import { FAMILY_MAIN, FAMILY_HEADER_MAX } from "../lib/family-nav.mjs";
import { useLangToggle } from "./useLang";
import { H1, META } from "../lib/typeScale";
import type { OsPrinciple, OsSprintGoal, OsRecognition } from "../lib/family-os";
import { BTN_PRIMARY } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";

type Lang = "EN" | "RU";
type PersonWeek = { id: string; name_ru: string; name_en: string; tasks: { date: string; title: string; done: boolean }[] };
const T = {
  RU: {
    title: "Неделя семьи", family: "Семья Картель", motto: "Virtus et Potestas", print: "Распечатать или сохранить PDF", printHint: "В окне печати выбери «Сохранить как PDF», чтобы получить файл.",
    rec: "Добавить признания", recHint: "Признания видят только отправитель, получатель и его родители. Лист на холодильнике увидят все дома — добавляй, только если все согласны.",
    principle: "Принцип недели", practice: "Практика дня", goals: "Цели спринта", tasks: (d: number, n: number) => `${d} из ${n}`, plan: "Дела семьи по людям", noTasks: "На эту неделю дел на доске пока нет.",
    done: "сделано", birthdays: "Дни рождения", council: "Следующий совет", councilAt: (d: string) => `${d}, 19:00`, recs: "Признания недели", none: "—",
    foot: "Только то, что видно в семейном разделе. Без документов, здоровья и заметок.", back: "К совету",
  },
  EN: {
    title: "Family week", family: "The Kartel family", motto: "Virtus et Potestas", print: "Print or save as PDF", printHint: "In the print dialog choose “Save as PDF” to get a file.",
    rec: "Add recognitions", recHint: "Recognitions are seen only by the sender, the recipient and the recipient's parents. A sheet on the fridge is seen by everyone at home — add them only if everyone agrees.",
    principle: "Principle of the week", practice: "Practice of the day", goals: "Sprint goals", tasks: (d: number, n: number) => `${d} of ${n}`, plan: "Family tasks by person", noTasks: "No tasks on the board for this week yet.",
    done: "done", birthdays: "Birthdays", council: "Next council", councilAt: (d: string) => `${d}, 19:00`, recs: "Recognitions of the week", none: "—",
    foot: "Only what the family area shows. No documents, health or notes.", back: "Back to the council",
  },
} as const;

const loc = (lang: Lang) => (lang === "EN" ? "en-GB" : "ru-RU");
const day = (d: string, lang: Lang, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc(lang), { ...o, timeZone: "UTC" });
const H2W = "font-serif text-[20px] leading-tight text-[var(--foreground)] print:text-[15pt]";

export default function FamilyWeek({ lang, admin, editor, week, principle, goals, perPerson, birthdays, council, recognitions }: {
  lang: Lang; admin: boolean; editor: boolean; week: string; principle: OsPrinciple | null; goals: OsSprintGoal[]; perPerson: PersonWeek[];
  birthdays: { date: string; name_ru: string; name_en: string }[]; council: { date: string } | null; recognitions: OsRecognition[] | null;
}) {
  const t = tx(T, lang);
  const toggleLang = useLangToggle(lang);
  const router = useRouter();
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os`;
  const nm = (p: { name_ru?: string; name_en?: string }) => (lang === "EN" ? p.name_en : p.name_ru) ?? "";
  const sun = new Date(Date.parse(`${week}T12:00:00Z`) + 6 * 86400_000).toISOString().slice(0, 10);
  const cols3 = perPerson.length >= 5;
  const range = `${day(week, lang, { day: "numeric", month: "long" })} — ${day(sun, lang, { day: "numeric", month: "long", year: "numeric" })}`.replace(/\s*г\.$/, "");
  return (
    <>
      <div className="print:hidden"><SiteHeader lang={lang} toggleLang={toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} /></div>
      <main id="main" className={`${FAMILY_MAIN} print:m-0 print:max-w-none print:p-0`}>
        <div className="print:hidden"><FamilySubNav lang={lang} admin={admin} editor={editor} os active="council" /></div>
        <div data-week-controls="" className="flex max-w-3xl flex-col gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => window.print()} className={BTN_PRIMARY}>{t.print}</button>
            <Link href={`${base}/council`} className="inline-flex min-h-11 items-center text-[15px] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.back}</Link>
          </div>
          <p className={META}>{t.printHint}</p>
          <label className="flex min-h-11 items-start gap-3 text-[16px] text-[var(--foreground)]">
            <input type="checkbox" data-week-rec="" checked={recognitions !== null} onChange={(e) => router.push(`${base}/week${e.target.checked ? "?rec=1" : ""}`)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
            <span>{t.rec}<span className="mt-0.5 block text-[15px] text-[var(--text-secondary)]">{t.recHint}</span></span>
          </label>
        </div>

        <article data-week-sheet="" className="mt-8 max-w-3xl pb-8 print:mt-0 print:max-w-none print:pb-0 print:text-[11pt]">
          {/* bus 101: a fridge object — crest mark and family name left, the week on the right */}
          <header data-week-head="" className="flex items-end justify-between gap-4 border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a 40 px mark that must print; next/image adds nothing here */}
              <img src="/crest.webp" alt="" aria-hidden="true" width={40} height={44} className="h-11 w-10 object-contain print:h-[14mm] print:w-[12mm]" />
              <div>
                <p className="font-serif text-[18px] leading-tight text-[var(--accent)] print:text-[12pt]">{t.family}</p>
                <h1 className={`${H1} print:text-[20pt]`}>{t.title}</h1>
              </div>
            </div>
            <p data-week-range="" className="text-right text-[16px] text-[var(--text-secondary)] print:text-[11pt]">{range}</p>
          </header>

          <div className="mt-5 grid gap-6 sm:grid-cols-2 print:grid-cols-2 print:gap-5">
            {principle && (
              <section aria-labelledby="w-principle" className="border-l-2 border-[var(--pillar-kodeks)] pl-3 sm:col-span-2 print:col-span-2 print:break-inside-avoid">
                <h2 id="w-principle" className={H2W}>{t.principle}</h2>
                <p className="mt-1 text-[18px] leading-snug text-[var(--foreground)] print:text-[13pt]">{principle.principle}</p>
                <p className="mt-1 text-[15px] text-[var(--text-secondary)] print:text-[10pt]">{t.practice}: {principle.practice}</p>
              </section>
            )}

            <section aria-labelledby="w-goals" className="print:break-inside-avoid">
              <h2 id="w-goals" className={H2W}>{t.goals}</h2>
              {goals.length ? (
                <ul className="mt-2 grid gap-1.5">{goals.map((g) => <li key={g.id} className="text-[16px] text-[var(--foreground)] print:text-[11pt]">{g.title} <span className="text-[var(--text-secondary)]">· {t.tasks(g.done, g.total)}</span></li>)}</ul>
              ) : <p className="mt-2 text-[15px] text-[var(--text-secondary)]">{t.none}</p>}
            </section>

            <section aria-labelledby="w-dates" className="print:break-inside-avoid">
              <h2 id="w-dates" className={H2W}>{t.council}</h2>
              <p className="mt-2 text-[16px] text-[var(--foreground)] print:text-[11pt]">{council ? t.councilAt(day(council.date, lang, { weekday: "long", day: "numeric", month: "long" })) : t.none}</p>
              <h2 className={`${H2W} mt-4`}>{t.birthdays}</h2>
              {birthdays.length ? (
                <ul className="mt-2 grid gap-1">{birthdays.map((b) => <li key={`${b.date}${nm(b)}`} className="text-[16px] text-[var(--foreground)] print:text-[11pt]">{day(b.date, lang, { day: "numeric", month: "long" })} — {nm(b)}</li>)}</ul>
              ) : <p className="mt-2 text-[15px] text-[var(--text-secondary)]">{t.none}</p>}
            </section>

            <section aria-labelledby="w-plan" className="sm:col-span-2 print:col-span-2">
              <h2 id="w-plan" className={H2W}>{t.plan}</h2>
              {perPerson.length ? (
                // Filled row by row so the rows line up. A last person alone in their row spans it (their tasks in columns)
                // instead of standing alone on the left (bus 101).
                // In print, five or more people go into three columns so a week of 7 × 6 tasks stays on one A4 page.
                <div className={`mt-2 grid gap-x-6 gap-y-4 sm:grid-cols-2 print:gap-x-5 print:gap-y-3 ${cols3 ? "print:grid-cols-3" : "print:grid-cols-2"}`}>
                  {perPerson.map((p, i) => { const last = i === perPerson.length - 1, wide = last && perPerson.length % 2 === 1, widePrint = last && perPerson.length % (cols3 ? 3 : 2) === 1; return (
                    <div key={p.id} data-week-person="" data-wide={wide ? "" : undefined} className={`print:break-inside-avoid ${wide ? "sm:col-span-2" : ""} ${widePrint ? (cols3 ? "print:col-span-3" : "print:col-span-2") : "print:col-span-1"}`}>
                      <h3 className="text-[16px] font-semibold text-[var(--foreground)] print:text-[10.5pt]">{nm(p)}</h3>
                      <ul className={`mt-1 grid gap-1 print:gap-0 ${wide ? "sm:grid-cols-2 sm:gap-x-6" : ""} ${widePrint ? (cols3 ? "print:grid-cols-3 print:gap-x-5" : "print:grid-cols-2 print:gap-x-5") : "print:grid-cols-1"}`}>
                        {p.tasks.map((x, i) => (
                          <li key={i} className="text-[15px] text-[var(--foreground)] print:text-[9pt] print:leading-[1.35]">
                            <span className="text-[var(--text-secondary)]">{day(x.date, lang, { weekday: "short" })}</span> · {x.title}{x.done && <span className="text-[var(--text-secondary)]"> · {t.done}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ); })}
                </div>
              ) : <p className="mt-2 text-[15px] text-[var(--text-secondary)]">{t.noTasks}</p>}
            </section>

            {recognitions && (
              <section aria-labelledby="w-recs" data-week-recs="" className="border-l-2 border-[var(--pillar-kodeks)] pl-3 sm:col-span-2 print:col-span-2 print:break-inside-avoid">
                <h2 id="w-recs" className={H2W}>{t.recs}</h2>
                {recognitions.length ? (
                  <ul className="mt-2 grid gap-2">{recognitions.map((r) => <li key={r.id} className="text-[15px] text-[var(--foreground)] print:text-[10pt]"><span className="text-[var(--text-secondary)]">{nm(r.from)} → {nm(r.to)} · {r.principle}:</span> {r.text}</li>)}</ul>
                ) : <p className="mt-2 text-[15px] text-[var(--text-secondary)]">{t.none}</p>}
              </section>
            )}
          </div>
          <footer data-week-foot="" className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-[var(--border)] pt-2 print:mt-4">
            <p className="font-serif text-[16px] italic text-[var(--accent)] print:text-[11pt]">{t.motto}</p>
            <p className="text-[14px] text-[var(--text-secondary)] print:text-[8pt]">{t.foot}</p>
          </footer>
        </article>
      </main>
      <div className="print:hidden"><SiteFooter copy="KARTEL" contactEmail={null} /></div>
    </>
  );
}
