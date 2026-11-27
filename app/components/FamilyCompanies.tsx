/**
 * «Компании и проекты» (bus 172 P6, mockup v5): one card per registry project — monogram, name, the first sentence of
 * its summary, the state, the federation role, the per-layer status and the date its registry entry last changed.
 * Bus 176 P3: plus the companies outside the registry (server-only data from the Vault) — name, lead, state, website
 * and the date the Vault recorded the project's state; no role or layers, which are registry terms.
 * A server component: neither source reaches the client. No sparklines and no business figures: the registry is one
 * snapshot, not a time series, and there is no other source of company figures yet (see the bus 172 P6 reply).
 */
import Link from "next/link";
import { H1 } from "../lib/typeScale";
import { BTN_SECONDARY } from "../lib/family-ui";
import { projectSummaries } from "../content/federationCopy";
import { layerKeyLabel, roleLabel, statusLabel } from "../content/tokens";
import { longDate, stateCounts } from "../lib/family-companies.mjs";
import { tx } from "../lib/typograph.mjs";

type Lang = "EN" | "RU";
type State = "active" | "retired" | "planned";
export type CompanyCard =
  | {
    source: "registry"; key: string; name: string; title: Record<Lang, string>; url: string | null; state: State; role: string; type: string;
    layers: { key: string; status: string }[]; changed: { version: number; date: string } | null;
  }
  | { source: "vault"; key: string; name: string; title: Record<Lang, string>; lead: Record<Lang, string>; url: string | null; state: State; recorded: string };

const T = {
  RU: {
    title: "Компании и проекты", sub: "Проекты из публичного реестра KARTEL и компании, которые ведёт семья", registry: "Подробный реестр",
    state: { active: "Работает", retired: "Бренд упразднён", planned: "В планах" } as Record<State, string>,
    counts: { active: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "работает" : "работают"}`, retired: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "упразднён" : "упразднены"}`, planned: (n: number) => `${n} в планах` } as Record<State, (n: number) => string>,
    role: "Роль в федерации", layers: "Слои", site: "Сайт", noSite: "Сайта пока нет", siteUnrecorded: "Не записан",
    changed: (d: string, v: number) => `Запись в реестре изменена ${d} (версия ${v})`, unchanged: "Изменений записи в реестре не отмечено",
    recorded: (d: string) => `Состояние проекта записано ${d}`,
    stamp: (v: number, d: string) => `Реестр — версия ${v} от ${d}. Здесь только статус и архитектура: без финансов, продаж и других цифр.`,
    vaultStamp: "Компании вне реестра — по записям о состоянии проектов в архиве KARTEL. Видны только в кабинете.",
    empty: "В реестре пока нет проектов.",
  },
  EN: {
    title: "Companies and projects", sub: "Projects from the public KARTEL registry and the companies the family runs", registry: "Full registry",
    state: { active: "Running", retired: "Brand retired", planned: "Planned" } as Record<State, string>,
    counts: { active: (n: number) => `${n} running`, retired: (n: number) => `${n} retired`, planned: (n: number) => `${n} planned` } as Record<State, (n: number) => string>,
    role: "Federation role", layers: "Layers", site: "Website", noSite: "No website yet", siteUnrecorded: "Not recorded",
    changed: (d: string, v: number) => `Registry entry changed ${d} (version ${v})`, unchanged: "No change to the entry is recorded in the registry",
    recorded: (d: string) => `Project state recorded ${d}`,
    stamp: (v: number, d: string) => `Registry version ${v}, ${d}. Status and architecture only: no finance, sales or other figures.`,
    vaultStamp: "The companies outside the registry come from the project-state records in the KARTEL archive. They are shown only in the family area.",
    empty: "The registry lists no projects yet.",
  },
} as const;

const CARD = "rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] p-5 shadow-[var(--fos-shadow)]";
const PILL: Record<State, string> = { active: "bg-[var(--ok-soft)] text-[var(--ok)]", retired: "bg-[var(--fos-panel-2)] text-[var(--muted)]", planned: "bg-[var(--fos-blue-soft)] text-[var(--fos-blue)]" };
/** The monogram square: a fixed colour per position, decoration only (aria-hidden). */
const SQ = ["#2B5C9E", "#8E4570", "#7B1E2D", "#74747E", "#9C6118"];
const monogram = (name: string) => (name.match(/[A-ZА-Я]/g) ?? [name[0] ?? "?"]).slice(0, 2).join("");
const host = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export default function FamilyCompanies({ lang, cards, registry }: { lang: Lang; cards: CompanyCard[]; registry: { version: number; updated: string } }) {
  const t = tx(T, lang);
  const ru = lang === "RU";
  const counts = stateCounts(cards) as { state: State; count: number }[];
  return (
    <section aria-labelledby="companies-h" className="pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="companies-h" className={H1}>{t.title}</h1>
          <p className="mt-1 text-[15px] text-[var(--muted)]">{t.sub}{counts.length ? ` · ${counts.map((c) => t.counts[c.state](c.count)).join(" · ")}` : ""}</p>
        </div>
        <Link prefetch={false} href={`/${ru ? "ru" : "en"}/registry/projects`} className={BTN_SECONDARY}>{t.registry}</Link>
      </div>
      {cards.length === 0 ? <p className="mt-6 text-[15px] text-[var(--muted)]">{t.empty}</p> : (
        <ul data-companies-grid="" className="mt-6 grid grid-cols-1 gap-[18px] min-[700px]:grid-cols-2 min-[1200px]:grid-cols-3">
          {cards.map((c, i) => {
            const lead = c.source === "vault" ? c.lead[lang] : (projectSummaries[lang][c.key] ?? "").split(/(?<=\.)\s/)[0];
            return (
              <li key={c.key} data-company={c.key} data-state={c.state} data-source={c.source} className={`${CARD} flex flex-col gap-3`}>
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" style={{ background: SQ[i % SQ.length] }} className="grid h-10 w-10 flex-none place-items-center rounded-[10px] text-[14px] font-bold text-white">{monogram(c.name)}</span>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold leading-snug text-[var(--foreground)]">{c.title[lang]}</h2>
                    {lead && <p className="mt-0.5 text-[13px] text-[var(--muted)]">{lead}</p>}
                  </div>
                  <span data-state-pill="" className={`ml-auto whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${PILL[c.state]}`}>{t.state[c.state]}</span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                  {c.source === "registry" && (<>
                    <dt className="text-[var(--muted)]">{t.role}</dt>
                    <dd className="text-[var(--foreground)]">{roleLabel(lang, c.role)}</dd>
                  </>)}
                  <dt className="text-[var(--muted)]">{t.site}</dt>
                  <dd>{c.url ? <a href={c.url} rel="noopener" className="underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{host(c.url)}</a> : <span className="text-[var(--muted)]">{c.source === "vault" ? t.siteUnrecorded : t.noSite}</span>}</dd>
                </dl>
                {c.source === "registry" && c.layers.length > 0 && (
                  <div>
                    <h3 className="text-[13px] font-medium text-[var(--muted)]">{t.layers}</h3>
                    <ul data-layers="" className="mt-1.5 flex flex-wrap gap-1.5">
                      {c.layers.map((l) => (
                        <li key={l.key} className="rounded-md border border-[var(--border)] bg-[var(--fos-panel-2)] px-2 py-0.5 text-[12px] text-[var(--foreground)]">
                          {layerKeyLabel(lang, l.key)}: <span className="text-[var(--muted)]">{(statusLabel(lang, l.status) ?? l.status).toLocaleLowerCase(ru ? "ru" : "en")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.source === "vault" ? (
                  <p data-recorded={c.recorded} className="mt-auto border-t border-[var(--border)] pt-3 text-[13px] text-[var(--muted)]">{t.recorded(longDate(c.recorded, lang))}</p>
                ) : (
                  <p data-changed={c.changed?.date ?? ""} className="mt-auto border-t border-[var(--border)] pt-3 text-[13px] text-[var(--muted)]">
                    {c.changed ? t.changed(longDate(c.changed.date, lang), c.changed.version) : t.unchanged}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p data-registry-stamp="" className="mt-6 max-w-[70ch] text-[13px] text-[var(--muted)]">{t.stamp(registry.version, longDate(registry.updated, lang))}</p>
      {cards.some((c) => c.source === "vault") && <p data-vault-stamp="" className="mt-1 max-w-[70ch] text-[13px] text-[var(--muted)]">{t.vaultStamp}</p>}
    </section>
  );
}
