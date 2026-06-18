"use client";

import { useLangToggle, type Lang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { registryContent } from "../content/registry";
import registry from "../content/registry.public.json";

type Status = string;

/** Quiet, institutional status pill — tone by meaning, single accent. */
function StatusPill({ value }: { value: Status }) {
  const v = value.toLowerCase();
  const active = /(live|connected|producer)/.test(v);
  const secondary = /(consumed|steward|draft)/.test(v);
  const tone = active
    ? "border-[var(--accent)] text-[var(--accent)]"
    : secondary
      ? "border-[var(--border)] text-[var(--text-body)]"
      : "border-[var(--border)] text-[var(--muted)]";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}
    >
      {value}
    </span>
  );
}

function SectionTitle({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-2xl text-[var(--foreground)] sm:text-3xl">{title}</h2>
      <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">{note}</p>
    </div>
  );
}

export default function RegistryDashboard({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = registryContent[lang];

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={[...c.nav]} />

      <main id="main" className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        {/* Hero */}
        <FadeInSection>
          <header className="border-b border-[var(--border)] pb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">KARTEL Core</p>
            <h1 className="mt-2 font-serif text-4xl text-[var(--foreground)] sm:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--text-body)]">{c.intro}</p>
            <p className="mt-4 text-xs text-[var(--muted)]">
              {c.updatedLabel}: {registry.updated} · v{registry.version}
            </p>
          </header>
        </FadeInSection>

        {/* Canonical layers */}
        <FadeInSection>
          <section className="mt-14">
            <SectionTitle title={c.sections.layers} note={c.sections.layersNote} />
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-4 py-3 font-medium">{c.cols.layer}</th>
                    <th className="px-4 py-3 font-medium">{c.cols.kind}</th>
                    <th className="px-4 py-3 font-medium">{c.cols.owner}</th>
                    <th className="px-4 py-3 font-medium">{c.cols.steward}</th>
                    <th className="px-4 py-3 font-medium">{c.cols.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {registry.canonicalLayers.map((l) => (
                    <tr key={l.key} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-3 font-serif text-[var(--foreground)]">{l.name}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{l.kind}</td>
                      <td className="px-4 py-3 text-[var(--text-body)]">{l.owner}</td>
                      <td className="px-4 py-3 text-[var(--text-body)]">{l.steward}</td>
                      <td className="px-4 py-3"><StatusPill value={l.status} /></td>
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
                <article key={p.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-serif text-xl text-[var(--foreground)]">{p.name}</h3>
                    {p.url ? (
                      <a
                        href={p.url}
                        className="rounded-sm text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {p.url.replace(/^https?:\/\//, "")} ↗
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">{p.type}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-body)]">{p.summary}</p>
                  <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                    {Object.entries(p.layers).map(([layerKey, status]) => (
                      <div key={layerKey} className="flex items-center gap-2">
                        <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                          {c.layerNames[layerKey as keyof typeof c.layerNames] ?? layerKey}
                        </dt>
                        <dd><StatusPill value={status as string} /></dd>
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
                    <p className="font-serif text-[var(--foreground)]">{item.name}</p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">{item.description}</p>
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
                <span key={k.name} className="rounded-md border border-[var(--accent)] px-3 py-1 font-mono text-xs text-[var(--accent)]">
                  {k.name}
                </span>
              ))}
              {registry.contracts.contracts.map((k) => (
                <span key={k.name} className="rounded-md border border-[var(--border)] px-3 py-1 font-mono text-xs text-[var(--text-body)]">
                  {k.name}
                </span>
              ))}
            </div>
          </section>
        </FadeInSection>

        {/* Public boundary note */}
        <FadeInSection>
          <p className="mt-16 border-t border-[var(--border)] pt-6 text-xs leading-relaxed text-[var(--muted)]">
            {c.publicNote}
          </p>
        </FadeInSection>
      </main>

      <SiteFooter motto={c.motto} copy={c.copy} contactEmail={null} />
    </>
  );
}
