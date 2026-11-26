"use client";

/**
 * «Люди»: the person cards (bus 172 P3), and the documents list that «Сегодня» reuses (DocList).
 * «Сегодня» itself is FamilyToday (bus 171). Data arrives from the server page; nothing here talks to the service.
 */
import Link from "next/link";
import { DOC_LABELS, fmtDocDate } from "../lib/family-docs.mjs";
import { avatars as avatarsOf } from "../lib/family-avatars.mjs";
import { H1, META } from "../lib/typeScale";
import { OS_H2, RULE_PRIVATE } from "../lib/family-ui";
import type { OsState, OsPerson, OsReminder, OsScope } from "../lib/family-os";
import { OsDownNotice } from "./FamilyOsDown";
import { tx } from "../lib/typograph.mjs";

type Lang = "EN" | "RU";

const T = {
  EN: {
    remindTitle: "Documents", familyRemindTitle: "Renewals across the family",
    tier: { expired: "Expired", lt3: "< 3 months", lt6: "< 6 months", lt12: "< 12 months" },
    docType: DOC_LABELS.EN,
    eyebrow: "Family", nav: "Family sections", today: "Today", people: "People", heritage: "Heritage",
    myDay: "My routine", todayEmpty: "Nothing planned for you today.",
    noneScheduled: "Nothing of yours is scheduled for today.",
    addOwn: "Add a routine on your page", childHint: "Your parents set up your routines and chores.",
    notMember: "You are signed in, but you are not in Family OS yet. Ask the family admin to add you.",
    adults: "Adults", children: "Children", adult: "Adult", child: "Child", you: "you", sub: "The family, and who looks after what",
    rel: { parent: "Parent", relative: "Relative", adult: "Adult", child: "Child" }, parentOf: "Parent of", adultHint: "Family member",
    noLoad: "The task board did not answer.", openToday: (n: number) => `open task${n === 1 ? "" : "s"} today`, doneOf: (d: number, n: number) => `${d} of ${n} done`, now: "now", routineOf: (d: number, n: number) => `routine ${d} of ${n}`,
    parents: "Parents", relatives: "With access", none: "No guardians yet",
    scope: { routines: "routines", health: "health", education: "school", documents: "documents" },
    emptyPeople: "No one has been added yet.",
  },
  RU: {
    remindTitle: "Документы", familyRemindTitle: "Сроки документов всей семьи",
    tier: { expired: "Истёк", lt3: "< 3 мес", lt6: "< 6 мес", lt12: "< 12 мес" },
    docType: DOC_LABELS.RU,
    eyebrow: "Семья", nav: "Разделы семьи", today: "Сегодня", people: "Люди", heritage: "Наследие",
    myDay: "Мой распорядок", todayEmpty: "На сегодня у тебя ничего не запланировано.",
    noneScheduled: "Сегодня по расписанию у тебя ничего нет.",
    addOwn: "Добавить распорядок на своей странице", childHint: "Распорядок и дела составляют родители.",
    notMember: "Тебя ещё нет в разделе «Семья». Попроси администратора семьи добавить тебя.",
    adults: "Взрослые", children: "Дети", adult: "Взрослый", child: "Ребёнок", you: "ты", sub: "Семья — и кто за что отвечает",
    rel: { parent: "Родитель", relative: "Родственник", adult: "Взрослый", child: "Ребёнок" }, parentOf: "Родитель для", adultHint: "Член семьи",
    noLoad: "Доска задач сейчас не ответила.", openToday: (n: number) => `${n % 10 === 1 && n % 100 !== 11 ? "открытое дело" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "открытых дела" : "открытых дел"} сегодня`, doneOf: (d: number, n: number) => `${d} из ${n} готово`, now: "сейчас", routineOf: (d: number, n: number) => `распорядок ${d} из ${n}`,
    parents: "Родители", relatives: "С доступом", none: "Опекунов пока нет",
    scope: { routines: "распорядок", health: "здоровье", education: "учёба", documents: "документы" },
    emptyPeople: "Пока никого не добавили.",
  },
} as const;
type Dict = (typeof T)[Lang];

/** A person card (bus 172 P3), built on the server by app/lib/family-people.mjs. */
export type PersonCard = {
  id: string; name: string; kind: "adult" | "child"; rel: "parent" | "relative" | "adult" | "child"; parents: string[]; kids: string[];
  sees: { child: string; scopes: OsScope[] }[]; me: boolean;
  load: { open: number; done: number; total: number; current: string | null; routines: { done: number; total: number } | null } | null;
};

export default function FamilyOs({ lang, state, cards = [] }: { lang: Lang; state: OsState; cards?: PersonCard[] }) {
  const t = tx(T, lang);
  return (
    <div className="pb-8">
      {state.status !== "ok" ? (
        <OsDownNotice lang={lang} status={state.status} title={t.people} />
      ) : !state.me && !state.admin ? (
        // L6: the page keeps its H1 for someone who is signed in but not in Family OS yet
        <section aria-labelledby="os-outsider-h" className="max-w-4xl">
          <h1 id="os-outsider-h" className={H1}>{t.people}</h1>
          <p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p>
        </section>
      ) : (
        <People t={t} lang={lang} cards={cards} />
      )}
    </div>
  );
}

const CARD_H = "text-[16px] font-semibold leading-snug text-[var(--foreground)]";
const CARD = "rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] p-5 shadow-[var(--fos-shadow)]";
const PILL = { g: "bg-[var(--ok-soft)] text-[var(--ok)]", b: "bg-[var(--fos-blue-soft)] text-[var(--fos-blue)]", a: "bg-[var(--warn-soft)] text-[var(--fos-amber)]" };

/**
 * «Люди» (bus 172 P3, mockup v5): one card per person — avatar, name (their page), role, who they are to whom, and the
 * open load today from the task board. Adults first, then children. A child never gets here (their menu is «Мой день»).
 */
function People({ t, lang, cards }: { t: Dict; lang: Lang; cards: PersonCard[] }) {
  const av = avatarsOf(cards.map((x) => ({ id: x.id, name: x.name }))) as Map<string, { text: string; bg: string }>;
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os/people`;
  const sub = (x: PersonCard) =>
    x.rel === "child" ? (x.parents.length ? `${t.parents}: ${x.parents.join(", ")}` : t.none)
      : x.rel === "parent" ? `${t.parentOf}: ${x.kids.join(", ")}`
        : x.rel === "relative" ? x.sees.map((s) => `${s.child}: ${s.scopes.map((k) => t.scope[k]).join(", ")}`).join(" · ")
          : t.adultHint;
  return (
    <section aria-labelledby="people-h">
      <h1 id="people-h" className={H1}>{t.people}</h1>
      <p className="mt-1 text-[15px] text-[var(--muted)]">{t.sub}</p>
      {cards.length === 0 ? <p className={`${META} mt-6`}>{t.emptyPeople}</p> : (
        <ul data-people-grid="" className="mt-6 grid grid-cols-1 gap-[18px] min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4">
          {cards.map((x) => {
            const a = av.get(x.id);
            return (
              <li key={x.id} data-person={x.kind} data-rel={x.rel} className={`${CARD} flex flex-col items-center gap-1.5 text-center`}>
                <span aria-hidden="true" style={{ background: a?.bg }} className="mb-1 grid h-16 w-16 place-items-center rounded-full text-[22px] font-semibold text-white">{a?.text}</span>
                <h2 className={CARD_H}>
                  <Link prefetch={false} href={`${base}/${x.id}`} className="inline-flex min-h-6 items-center underline decoration-transparent underline-offset-4 hover:decoration-[var(--accent)]">{x.name}</Link>
                  {x.me && <span className="ml-1.5 text-[13px] font-normal text-[var(--muted)]">({t.you})</span>}
                </h2>
                <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${x.rel === "child" ? PILL.b : x.rel === "parent" ? PILL.g : PILL.a}`}>{t.rel[x.rel]}</span>
                <span className="text-[13px] text-[var(--muted)]">{sub(x)}</span>
                <div data-load="" className="mt-2 w-full text-left text-[13px] text-[var(--muted)]">
                  {x.load === null ? <p>{t.noLoad}</p> : (
                    <>
                      <p><b className="font-semibold text-[var(--foreground)]">{x.load.open}</b> {t.openToday(x.load.open)}{x.load.total > 0 ? ` · ${t.doneOf(x.load.done, x.load.total)}` : ""}</p>
                      <div aria-hidden="true" className="mt-1.5 h-[7px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--fos-panel-2)]">
                        <i className="block h-full rounded-lg bg-[var(--fos-accent-2)]" style={{ width: `${x.load.total ? Math.round((x.load.done / x.load.total) * 100) : 0}%` }} />
                      </div>
                      {x.load.current && <p className="mt-1.5 truncate">{t.now}: {x.load.current}</p>}
                      {x.load.routines && x.load.routines.total > 0 && <p className="mt-0.5">{t.routineOf(x.load.routines.done, x.load.routines.total)}</p>}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Expiring documents, soonest first. Status is text + icon (never colour alone).
 *  Documents are private, so the block wears the private/sensitive left rule, not a card (bus 157b D8). */
function DocList({ t, lang, id, title, items, people, nameOf }: {
  t: Dict; lang: Lang; id: string; title: string; items: OsReminder[]; people: OsPerson[]; nameOf: (p: OsPerson) => string;
}) {
  const sorted = [...items].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  return (
    <section aria-labelledby={id} data-reminders={id} className={`mt-10 ${RULE_PRIVATE}`}>
      <h2 id={id} className={OS_H2}>{title}</h2>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {sorted.map((r) => {
          const who = people.find((x) => x.id === r.person_id);
          const urgent = r.tier === "expired" || r.tier === "lt3";
          return (
            <li key={r.id} data-tier={r.tier ?? ""} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[16px]">
              <span className={`inline-flex min-w-[13rem] items-center gap-1.5 text-[14px] ${urgent ? "font-semibold text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
                  {r.tier === "expired"
                    ? <path d="M7 1 13 12H1L7 1Zm0 4v3.5M7 10.2v.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    : <><circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M7 4v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>}
                </svg>
                {r.tier ? t.tier[r.tier] : ""}
                <span aria-hidden="true">·</span>
                <span suppressHydrationWarning>{fmtDocDate(r.expiry_date, lang)}</span>
              </span>
              <Link prefetch={false} href={`/${lang === "EN" ? "en" : "ru"}/family/os/people/${r.person_id}`} className="inline-flex min-h-11 items-center underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">
                {who ? nameOf(who) : ""} — {t.docType[r.type]}{r.country ? ` (${r.country})` : ""}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** «Документы» / «Сроки документов всей семьи» on «Сегодня» (bus 171): the same list, with this file's words. */
export function TodayDocs({ lang, family = false, items, people }: { lang: Lang; family?: boolean; items: OsReminder[]; people: OsPerson[] }) {
  const t = tx(T, lang);
  const nameOf = (p: OsPerson) => (lang === "EN" ? p.name_en : p.name_ru);
  return <DocList t={t} lang={lang} id={family ? "family-remind-h" : "remind-h"} title={family ? t.familyRemindTitle : t.remindTitle} items={items} people={people} nameOf={nameOf} />;
}
