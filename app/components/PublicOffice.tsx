import { ArrowUpRight, CalendarDays, FileText, Scale, SquareCheckBig, type LucideIcon } from "lucide-react";
import { H1, H2, H3, META } from "../lib/typeScale";
import { noDashLineStart } from "../lib/typography";
import type { Lang } from "./useLang";
import registry from "../content/registry.public.json";
import { projectSummaries } from "../content/federationCopy";
import { typographDict } from "../lib/typograph.mjs";
import { homeCompanies, homeOrganisations, homeStats, registryStamp } from "../content/publicHome.mjs";

/**
 * The public view of mockup v5 (bus 172 P5): hero, the counts strip and the companies — above the coat of arms,
 * which stays on the home page below. Every company and every number comes from the vendored registry
 * (app/content/publicHome.mjs); nothing here is a mockup value. The mockup's app screenshot is replaced by a plain
 * card of what the family area holds — no tasks, names or figures — and its contact button by the crest (the public
 * home carries no contact address).
 */

const copy = {
  EN: {
    pill: "Family office · London",
    title: "The KARTEL family — work that lasts for generations.",
    lead: "KARTEL brings together the federation projects the family runs — in education, culture and communities — under shared rules, decisions and responsibility.",
    companiesCta: "Our companies",
    crestCta: "The coat of arms",
    cabinet: "The family area",
    cabinetNote: "For the family only · sign in without a password",
    places: ["Today's tasks", "Family decisions", "A shared calendar", "Documents and rules"],
    signin: "Family sign-in",
    statsLabel: "In numbers",
    statsSource: (stamp: string) => `From the public KARTEL registry, ${stamp}.`,
    registry: "Open the registry",
    companiesTitle: "Companies and projects",
    companiesNote: "Each project, as the public KARTEL registry lists it.",
    state: { active: "Active", retired: "Brand retired", planned: "Planned" },
    entity: "Legal entity",
    schools: "Schools",
    visit: (host: string) => `${host} — opens in a new tab`,
  },
  RU: {
    pill: "Семейный офис · Лондон",
    title: "Семья KARTEL — дело на поколения.",
    lead: "KARTEL объединяет проекты федерации, которые ведёт семья, — в образовании, культуре и сообществах — общими правилами, решениями и ответственностью.",
    companiesCta: "Наши компании",
    crestCta: "Фамильный герб",
    cabinet: "Семейный кабинет",
    cabinetNote: "Только для семьи · вход без пароля",
    places: ["Дела на сегодня", "Решения семьи", "Общий календарь", "Документы и правила"],
    signin: "Вход для семьи",
    statsLabel: "В цифрах",
    statsSource: (stamp: string) => `По публичному реестру KARTEL, ${stamp}.`,
    registry: "Открыть реестр",
    companiesTitle: "Компании и проекты",
    companiesNote: "Каждый проект — так, как его записывает публичный реестр KARTEL.",
    state: { active: "Работает", retired: "Бренд упразднён", planned: "В планах" },
    entity: "Юридическое лицо",
    schools: "Школы",
    visit: (host: string) => `${host} — откроется в новой вкладке`,
  },
} as const;

const COPY = { EN: copy.EN, RU: typographDict(copy.RU) as typeof copy.RU };

const PLACE_ICONS: LucideIcon[] = [SquareCheckBig, Scale, CalendarDays, FileText];

const STATE_TONE = {
  active: "bg-[var(--accent-soft)] text-[var(--ok)]",
  retired: "bg-[var(--surface)] text-[var(--muted)]",
  planned: "bg-[var(--fos-blue-soft)] text-[var(--fos-blue)]",
} as const;

const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] px-5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
const BTN_PRIMARY = `${BTN} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]`;
const BTN_GHOST = `${BTN} border border-[var(--border)] bg-[var(--fos-panel)] text-[var(--foreground)] hover:border-[var(--accent)]`;
const CARD = "rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] shadow-[var(--fos-shadow)]";

export default function PublicOffice({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const l = lang.toLowerCase();
  const companies: { key: string; name: string; title: Record<Lang, string>; url: string | null; state: keyof typeof STATE_TONE; lead: Record<Lang, string> }[] = homeCompanies(registry, projectSummaries);
  const { entity, schools }: { entity: { name: string } | null; schools: { name: string; nameRu?: string }[] } = homeOrganisations(registry);
  const stats = homeStats(registry, lang);

  return (
    <>
      <section id="office" aria-labelledby="office-title" className="scroll-mt-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:px-10 lg:pt-20 lg:pb-14">
          <div>
            <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--accent-soft)] px-3 text-[14px] font-medium text-[var(--ok)]">{t.pill}</span>
            <h1 className={`mt-5 ${H1} text-balance`} id="office-title">{t.title}</h1>
            <p className="mt-5 max-w-[34rem] text-[17px] leading-[1.55] text-[var(--muted)] lg:text-[19px]">{noDashLineStart(t.lead)}</p>
            <div className="mt-8 flex flex-wrap gap-3 print:hidden">
              <a href="#companies" className={BTN_PRIMARY}>{t.companiesCta}</a>
              <a href="#home" className={BTN_GHOST}>{t.crestCta}</a>
            </div>
          </div>

          <div className={`${CARD} p-5 shadow-[var(--fos-shadow-lg)] lg:rotate-[1.5deg] motion-reduce:rotate-0`}>
            <div className="rounded-[calc(var(--fos-radius)-4px)] bg-gradient-to-br from-[var(--fos-brief-from)] to-[var(--fos-brief-to)] px-5 py-4 text-[var(--fos-brief-text)]">
              <p className="font-serif text-[19px] font-semibold">{t.cabinet}</p>
              <p className="mt-1 text-[14px]">{t.cabinetNote}</p>
            </div>
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {t.places.map((p, i) => {
                const Icon = PLACE_ICONS[i];
                return (
                  <li key={p} className="flex min-h-12 items-center gap-3 px-1 text-[15px] font-medium text-[var(--foreground)]">
                    <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--fos-accent-2)]" />
                    {p}
                  </li>
                );
              })}
            </ul>
            <a href={`/${l}/family/os`} className={`mt-3 w-full ${BTN_PRIMARY} print:hidden`}>{t.signin}</a>
          </div>
        </div>
      </section>

      {stats.length > 0 && (
        <section aria-label={t.statsLabel} data-home-stats="">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <dl className="grid grid-cols-1 gap-5 border-y border-[var(--border)] py-6 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.key} className="flex flex-row-reverse items-baseline justify-end gap-3 sm:flex-col-reverse sm:items-start sm:gap-2">
                  <dt className="text-[14px] text-[var(--muted)]">{s.label}</dt>
                  <dd className="font-serif text-[34px] font-semibold leading-none text-[var(--foreground)]">{s.n}</dd>
                </div>
              ))}
            </dl>
            <p className={`mt-3 ${META}`}>
              {t.statsSource(registryStamp(registry, lang))}{" "}
              <a href={`/${l}/registry`} className="inline-flex min-h-11 items-center text-[var(--accent)] underline decoration-1 underline-offset-4 hover:text-[var(--accent-hover)] sm:min-h-0">{t.registry}</a>
            </p>
          </div>
        </section>
      )}

      <section id="companies" aria-labelledby="companies-title" className="scroll-mt-28">
        <div className="mx-auto max-w-7xl px-4 pt-10 pb-12 sm:px-6 lg:px-10 lg:pb-20">
          <h2 id="companies-title" className={H2}>{t.companiesTitle}</h2>
          <p className={`mt-2 ${META}`}>{t.companiesNote}</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {companies.map((c) => {
              const host = c.url ? new URL(c.url).host : null;
              return (
                <li key={c.key} data-company={c.key} className={`${CARD} flex flex-col p-5`}>
                  <div className="flex items-start justify-between gap-3">
                    <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-[10px] font-serif text-[17px] font-semibold ${c.state === "active" ? "bg-[var(--accent)] text-[var(--on-accent)]" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"}`}>
                      {c.name.charAt(0)}
                    </span>
                    <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-[14px] font-medium ${STATE_TONE[c.state]}`}>
                      {t.state[c.state]}
                    </span>
                  </div>
                  <h3 className={`mt-4 ${H3}`}>{c.title[lang]}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-[1.5] text-[var(--text-body)]">{noDashLineStart(c.lead[lang])}</p>
                  {host && (
                    <a
                      href={c.url!}
                      target="_blank"
                      rel="noopener"
                      aria-label={t.visit(host)}
                      className="mt-4 inline-flex min-h-11 items-center gap-1 self-start text-[15px] text-[var(--accent)] underline decoration-1 underline-offset-4 hover:text-[var(--accent-hover)]"
                    >
                      {host}
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          {entity && (
            <dl className={`mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-[auto_1fr] ${META}`}>
              <dt className="font-medium text-[var(--foreground)]">{t.entity}</dt>
              <dd>{entity.name}</dd>
              {schools.length > 0 && (
                <>
                  <dt className="font-medium text-[var(--foreground)]">{t.schools}</dt>
                  <dd>{schools.map((s) => (lang === "RU" && s.nameRu ? s.nameRu : s.name)).join(" · ")}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </section>
    </>
  );
}
