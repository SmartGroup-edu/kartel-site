"use client";

import { useLangToggle, type Lang } from "./useLang";
import { noDashLineStart } from "../lib/typography";
import { H1, H2, H3, PROSE, EYEBROW, META, TH, snapshotLine } from "../lib/typeScale";
import Pill from "./Pill";
import SiteHeader from "./SiteHeader";
import { registryNav } from "../content/siteNav";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { registryContent } from "../content/registry";
import { projectSummaries, gateNames, gateDescriptions, layerNameLabels, stewardLabels } from "../content/federationCopy";
import { statusLabel, kindLabel, typeLabel, coreName } from "../content/tokens";
import registry from "../content/registry.public.json";

type Status = string;

/**
 * Quiet, institutional status pill — tone by meaning, single accent.
 * `value` is the raw English token (drives the colour logic); `label`, if given,
 * is the localised display text. They are kept separate so translating the
 * display never changes which tone the logic picks.
 */
function StatusPill({ value, label }: { value: Status; label?: string }) {
  const v = value.toLowerCase();
  const active = /(live|connected|producer)/.test(v);
  const secondary = /(consumed|steward|draft)/.test(v);
  return <Pill tone={active ? "accent" : secondary ? "body" : "muted"}>{label ?? value}</Pill>;
}

function SectionTitle({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-5">
      <h2 className={H2}>{title}</h2>
      <p className={`mt-2 max-w-2xl ${META}`}>{noDashLineStart(note)}</p>
    </div>
  );
}

export default function RegistryDashboard({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = registryContent[lang];

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} subNav={registryNav(lang)} />

      <main id="main" className="mx-auto w-full min-w-0 max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        {/* Hero */}
        <FadeInSection>
          <header className="border-b border-[var(--border)] pb-8">
            <p className={EYEBROW}>{c.eyebrow}</p>
            <h1 className={`mt-2 ${H1}`}>{c.title}</h1>
            <p className={`mt-4 max-w-[68ch] ${PROSE}`}>{noDashLineStart(c.intro)}</p>
            <p className={`mt-4 ${META}`}>{snapshotLine(lang, registry.version, registry.updated)}</p>
          </header>
        </FadeInSection>

        {/* Canonical layers */}
        <FadeInSection>
          <section className="mt-14">
            <SectionTitle title={c.sections.layers} note={c.sections.layersNote} />
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left">
                    <th className={TH}>{c.cols.layer}</th>
                    <th className={TH}>{c.cols.kind}</th>
                    <th className={TH}>{c.cols.owner}</th>
                    <th className={TH}>{c.cols.steward}</th>
                    <th className={TH}>{c.cols.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {registry.canonicalLayers.map((l) => (
                    <tr key={l.key} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-3 font-serif text-[var(--foreground)]">{layerNameLabels[lang][l.key] ?? l.name}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{kindLabel(lang, l.kind)}</td>
                      <td className="px-4 py-3 text-[var(--text-body)]">{coreName(lang, l.owner)}</td>
                      <td className="px-4 py-3 text-[var(--text-body)]">{stewardLabels[lang][l.key] ?? coreName(lang, l.steward)}</td>
                      <td className="px-4 py-3"><StatusPill value={l.status} label={statusLabel(lang, l.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </FadeInSection>

        {/* Projects */}
        <FadeInSection>
          <section className="mt-14">
            <SectionTitle title={c.sections.projects} note={c.sections.projectsNote} />
            <div className="grid gap-4 sm:grid-cols-2">
              {registry.projects.map((p) => (
                <article key={p.key} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className={H3}>{p.name}</h3>
                    {p.url ? (
                      <a
                        href={p.url}
                        className="inline-block rounded-sm py-1 text-[14px] text-[var(--accent)] hover:text-[var(--accent-hover)]"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {p.url.replace(/^https?:\/\//, "")} ↗
                      </a>
                    ) : (
                      <span className="text-[14px] text-[var(--muted)]">{typeLabel(lang, p.type)}</span>
                    )}
                  </div>
                  <p className="mt-2 text-[17px] leading-[1.6] text-[var(--text-body)]">{noDashLineStart(projectSummaries[lang][p.key] ?? p.summary)}</p>
                  {/* Label/value pairs as a two-column definition list, so the card scans as data (cycle 4 #5). */}
                  <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
                    {Object.entries(p.layers).map(([layerKey, status]) => (
                      <div key={layerKey} className="contents">
                        <dt className="text-[14px] text-[var(--muted)]">
                          {c.layerNames[layerKey as keyof typeof c.layerNames] ?? layerKey}
                        </dt>
                        {/* Long RU values ("Производитель / стюард") wrap inside the pill at 320px instead of
                            pushing the page sideways. */}
                        <dd className="min-w-0 [&>span]:whitespace-normal [&>span]:leading-tight"><StatusPill value={status as string} label={statusLabel(lang, status as string)} /></dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </FadeInSection>

        {/* Federation Integration Gate */}
        <FadeInSection>
          <section className="mt-14">
            <SectionTitle title={c.sections.gate} note={c.sections.gateNote} />
            <ol className="grid gap-3 sm:grid-cols-2">
              {registry.federationGate.items.map((item, i) => (
                <li key={item.key} className="flex gap-3 rounded-lg border border-[var(--border)] p-4">
                  <span className="font-serif text-lg text-[var(--accent)]">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-serif text-[18px] text-[var(--foreground)]">{gateNames[lang][item.key] ?? item.name}</p>
                    <p className={`mt-1 ${META}`}>{noDashLineStart(gateDescriptions[lang][item.key] ?? item.description)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </FadeInSection>

        {/* Contracts */}
        <FadeInSection>
          <section className="mt-14">
            <SectionTitle title={c.sections.contracts} note={c.sections.contractsNote} />
            <div className="flex flex-wrap gap-2">
              {registry.contracts.keys.map((k) => (
                <span key={k.name} className="rounded-md border border-[var(--accent)] px-3 py-1 font-mono text-[14px] text-[var(--accent)]">
                  {k.name}
                </span>
              ))}
              {registry.contracts.contracts.map((k) => (
                <span key={k.name} className="rounded-md border border-[var(--border)] px-3 py-1 font-mono text-[14px] text-[var(--text-body)]">
                  {k.name}
                </span>
              ))}
            </div>
          </section>
        </FadeInSection>

        {/* Public boundary note */}
        <FadeInSection>
          <p className={`mt-16 border-t border-[var(--border)] pt-6 ${META}`}>
            {noDashLineStart(c.publicNote)}
          </p>
        </FadeInSection>
      </main>

      <SiteFooter motto={c.motto} copy={c.copy} contactEmail={null} />
    </>
  );
}
