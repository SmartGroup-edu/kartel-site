"use client";

/**
 * Family OS shell (plan v3, Stage 1): navigation, the "Today" view (empty until routines arrive in
 * Stage 2) and the people list with roles and guardian relations. Data arrives from the server page
 * (family-os service); nothing here talks to the service directly.
 */
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import Link from "next/link";
import { expiryState } from "../lib/family-docs.mjs";
import FamilySubNav from "./FamilySubNav";
import { FAMILY_MAIN, FAMILY_HEADER_MAX } from "../lib/family-nav.mjs";
import { familyNav } from "../content/siteNav";
import { greeting } from "../lib/family-nav.mjs";
import FamilyPortrait from "./FamilyPortrait";
import { useLangToggle } from "./useLang";
import { H1, H2, META } from "../lib/typeScale";
import type { OsState, OsPerson, OsGrant, OsReminder } from "../lib/family-os";

type Lang = "EN" | "RU";
type View = "today" | "people";

const T = {
  EN: {
    remindTitle: "Documents to renew", expired: "expired", until: "valid until",
    docType: { passport: "passport", national_id: "ID / personal code", ni_number: "National Insurance", residence: "residence / settlement", other: "document" },
    eyebrow: "Family", nav: "Family sections", today: "Today", people: "People", heritage: "Heritage",
    todayEmpty: "Nothing planned for today yet.",
    todayNext: "Routines, chores and the weekly family council arrive in the next stage. This page will show what is yours today.",
    off: "Family OS is not connected yet.",
    error: "Family OS is not answering right now. Please try again in a minute.",
    notMember: "You are signed in, but you are not in Family OS yet. Ask the family admin to add you.",
    adults: "Adults", children: "Children", adult: "Adult", child: "Child", you: "you",
    parents: "Parents", relatives: "With access", none: "No guardians yet",
    scope: { routines: "routines", health: "health", education: "school" },
    emptyPeople: "No one has been added yet.",
  },
  RU: {
    remindTitle: "Документы, которые пора обновить", expired: "истёк", until: "действует до",
    docType: { passport: "паспорт", national_id: "удостоверение / личный код", ni_number: "National Insurance", residence: "вид на жительство / settlement", other: "документ" },
    eyebrow: "Семья", nav: "Разделы семьи", today: "Сегодня", people: "Люди", heritage: "Наследие",
    todayEmpty: "На сегодня пока ничего не запланировано.",
    todayNext: "Распорядок, дела и еженедельный семейный совет появятся на следующем этапе. Здесь будет то, что ваше на сегодня.",
    off: "Раздел «Семья» ещё не подключён.",
    error: "Раздел «Семья» сейчас не отвечает. Попробуйте через минуту.",
    notMember: "Вы вошли, но вас ещё нет в разделе «Семья». Попросите администратора семьи добавить вас.",
    adults: "Взрослые", children: "Дети", adult: "Взрослый", child: "Ребёнок", you: "вы",
    parents: "Родители", relatives: "С доступом", none: "Опекунов пока нет",
    scope: { routines: "распорядок", health: "здоровье", education: "учёба" },
    emptyPeople: "Пока никого не добавили.",
  },
} as const;
type Dict = (typeof T)[Lang];

export default function FamilyOs({ lang, view, state, reminders = [] }: { lang: Lang; view: View; state: OsState; reminders?: OsReminder[] }) {
  const t = T[lang];
  const toggleLang = useLangToggle(lang);
  const nameOf = (p: { name_en: string; name_ru: string }) => (lang === "EN" ? p.name_en : p.name_ru);

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} />
      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin={state.status === "ok" && state.admin} os={state.status === "ok" && (Boolean(state.me) || state.admin)} active={view} />
        <div className="max-w-4xl pb-8">

        {state.status !== "ok" ? (
          <p role="status" className="mt-10 rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{state.status === "off" ? t.off : t.error}</p>
        ) : !state.me && !state.admin ? (
          <p role="status" className="mt-10 rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.notMember}</p>
        ) : view === "today" ? (
          <section aria-labelledby="today-h" className="mt-10">
            <h1 id="today-h" className={H1}>{greeting(lang, state.me ? nameOf(state.me) : null)}</h1>
            <p className={`${META} mt-2`} suppressHydrationWarning>{new Date().toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { weekday: "long", day: "numeric", month: "long" })}</p>
            {reminders.length > 0 && (
              <section aria-labelledby="remind-h" data-reminders="" className="mt-8 rounded-lg border border-[var(--accent)] px-5 py-4">
                <h2 id="remind-h" className="font-serif text-[19px] text-[var(--foreground)]">{t.remindTitle}</h2>
                <ul className="mt-3 space-y-2 text-[16px]">
                  {reminders.map((r) => {
                    const who = state.people.find((x) => x.id === r.person_id);
                    const ex = expiryState(r.expiry_date, new Date());
                    return (
                      <li key={r.id}>
                        <Link href={`/${lang === "EN" ? "en" : "ru"}/family/os/people/${r.person_id}`} className="underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">
                          {who ? nameOf(who) : ""} — {t.docType[r.type]}{r.country ? ` (${r.country})` : ""}
                        </Link>
                        <span className="ml-2 text-[var(--text-secondary)]" suppressHydrationWarning>{ex === "expired" ? t.expired : t.until} {new Date(`${r.expiry_date}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <div data-today-empty="" className="mt-8 rounded-lg border border-dashed border-[var(--border)] px-6 py-10 text-center">
              <p className="font-serif text-[20px] text-[var(--foreground)]">{t.todayEmpty}</p>
              <p className="mx-auto mt-3 max-w-[52ch] text-[16px] leading-[1.6] text-[var(--text-secondary)]">{t.todayNext}</p>
            </div>
          </section>
        ) : (
          <People t={t} lang={lang} me={state.me} people={state.people} grants={state.grants} nameOf={nameOf} />
        )}
        </div>
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}

function People({ t, lang, me, people, grants, nameOf }: {
  t: Dict; lang: Lang; me: { id: string } | null; people: OsPerson[]; grants: OsGrant[]; nameOf: (p: OsPerson) => string;
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const sorted = (xs: OsPerson[]) => [...xs].sort((a, b) => nameOf(a).localeCompare(nameOf(b), lang === "EN" ? "en" : "ru"));
  const groups: [string, OsPerson[]][] = [[t.adults, sorted(people.filter((p) => p.kind === "adult"))], [t.children, sorted(people.filter((p) => p.kind === "child"))]];
  return (
    <section aria-labelledby="people-h" className="mt-10">
      <h1 id="people-h" className={H1}>{t.people}</h1>
      {people.length === 0 && <p className={`${META} mt-6`}>{t.emptyPeople}</p>}
      {groups.filter(([, xs]) => xs.length).map(([label, xs]) => (
        <div key={label} className="mt-10">
          <h2 className={H2}>{label}</h2>
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
                      <Link href={`/${lang === "EN" ? "en" : "ru"}/family/os/people/${p.id}`} className="underline decoration-transparent underline-offset-4 hover:decoration-[var(--accent)]">{nameOf(p)}</Link>{me?.id === p.id && <span className="ml-2 font-sans text-[14px] text-[var(--muted)]">({t.you})</span>}
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
