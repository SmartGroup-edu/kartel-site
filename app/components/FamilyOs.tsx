"use client";

/**
 * «Люди»: the people list with roles and guardian relations, and the documents list that «Сегодня» reuses (DocList).
 * «Сегодня» itself is FamilyToday (bus 171). Data arrives from the server page; nothing here talks to the service.
 */
import Link from "next/link";
import { DOC_LABELS, fmtDocDate } from "../lib/family-docs.mjs";
import FamilyPortrait from "./FamilyPortrait";
import { H1, META } from "../lib/typeScale";
import { OS_H2, RULE_PRIVATE } from "../lib/family-ui";
import type { OsState, OsPerson, OsGrant, OsReminder } from "../lib/family-os";
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
    adults: "Adults", children: "Children", adult: "Adult", child: "Child", you: "you",
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
    adults: "Взрослые", children: "Дети", adult: "Взрослый", child: "Ребёнок", you: "ты",
    parents: "Родители", relatives: "С доступом", none: "Опекунов пока нет",
    scope: { routines: "распорядок", health: "здоровье", education: "учёба", documents: "документы" },
    emptyPeople: "Пока никого не добавили.",
  },
} as const;
type Dict = (typeof T)[Lang];

export default function FamilyOs({ lang, state }: { lang: Lang; state: OsState }) {
  const t = tx(T, lang);
  const nameOf = (p: { name_en: string; name_ru: string }) => (lang === "EN" ? p.name_en : p.name_ru);
  return (
    <div className="max-w-4xl pb-8">
      {state.status !== "ok" ? (
        <OsDownNotice lang={lang} status={state.status} title={t.people} />
      ) : !state.me && !state.admin ? (
        // L6: the page keeps its H1 for someone who is signed in but not in Family OS yet
        <section aria-labelledby="os-outsider-h">
          <h1 id="os-outsider-h" className={H1}>{t.people}</h1>
          <p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p>
        </section>
      ) : (
        <People t={t} lang={lang} me={state.me} people={state.people} grants={state.grants} nameOf={nameOf} />
      )}
    </div>
  );
}

function People({ t, lang, me, people, grants, nameOf }: {
  t: Dict; lang: Lang; me: { id: string } | null; people: OsPerson[]; grants: OsGrant[]; nameOf: (p: OsPerson) => string;
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const sorted = (xs: OsPerson[]) => [...xs].sort((a, b) => nameOf(a).localeCompare(nameOf(b), lang === "EN" ? "en" : "ru"));
  const groups: [string, OsPerson[]][] = [[t.adults, sorted(people.filter((p) => p.kind === "adult"))], [t.children, sorted(people.filter((p) => p.kind === "child"))]];
  return (
    <section aria-labelledby="people-h">
      <h1 id="people-h" className={H1}>{t.people}</h1>
      {people.length === 0 && <p className={`${META} mt-6`}>{t.emptyPeople}</p>}
      {groups.filter(([, xs]) => xs.length).map(([label, xs]) => (
        <div key={label} className="mt-10">
          <h2 className={OS_H2}>{label}</h2>
          <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {xs.map((p) => {
              const gs = grants.filter((g) => g.child_id === p.id);
              const parents = gs.filter((g) => g.relation === "parent");
              const others = gs.filter((g) => g.relation === "relative");
              return (
                <li key={p.id} data-person={p.kind} className="flex gap-4 py-4">
                  <FamilyPortrait id={null} name={nameOf(p)} alt="" size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[18px] leading-snug text-[var(--foreground)]">
                      <Link prefetch={false} href={`/${lang === "EN" ? "en" : "ru"}/family/os/people/${p.id}`} className="underline decoration-transparent underline-offset-4 hover:decoration-[var(--accent)]">{nameOf(p)}</Link>{me?.id === p.id && <span className="ml-2 font-sans text-[14px] text-[var(--muted)]">({t.you})</span>}
                    </p>
                    {p.kind === "child" && (
                      <dl className="mt-3 space-y-1 text-[14px] text-[var(--text-secondary)]">
                        {gs.length === 0 && <div><dd>{t.none}</dd></div>}
                        {parents.length > 0 && <div><dt className="inline font-medium text-[var(--foreground)]">{t.parents}: </dt><dd className="inline">{parents.map((g) => byId.get(g.guardian_id)).filter(Boolean).map((x) => nameOf(x!)).join(", ")}</dd></div>}
                        {others.map((g) => (
                          <div key={g.id}><dt className="inline font-medium text-[var(--foreground)]">{t.relatives}: </dt>
                            <dd className="inline">{byId.get(g.guardian_id) ? nameOf(byId.get(g.guardian_id)!) : "—"} ({g.scopes.map((s) => t.scope[s]).join(", ")})</dd></div>
                        ))}
                      </dl>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
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
