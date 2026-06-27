"use client";

import { useLangToggle, type Lang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { coreContent } from "../content/core";
import { projectSummaries } from "../content/federationCopy";
import { typeLabel } from "../content/tokens";
import registry from "../content/registry.public.json";

function StatusPill({ value }: { value: string }) {
  const v = value.toLowerCase();
  const active = /(live|active|connected|producer|активно)/.test(v);
  const tone = active
    ? "border-[var(--accent)] text-[var(--accent)]"
    : "border-[var(--border)] text-[var(--muted)]";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}>
      {value}
    </span>
  );
}

export default function CoreClient({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = coreContent[lang];
  const base = `/${lang.toLowerCase()}`;

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={[...c.nav]} />

      <main id="main">
        {/* Hero */}
        <FadeInSection>
          <section className="mx-auto max-w-5xl px-4 pb-10 pt-16 text-center sm:px-6 lg:px-10 lg:pt-24">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">{c.eyebrow}</p>
            <h1 className="mx-auto mt-4 max-w-3xl font-serif text-4xl leading-tight text-[var(--foreground)] sm:text-5xl lg:text-6xl">
              {c.heroTitle}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-body)] sm:text-lg">
              {c.heroLede}
            </p>
          </section>
        </FadeInSection>

        {/* Four canonical layers */}
        <FadeInSection>
          <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-10">
            <div className="text-center">
              <h2 className="font-serif text-2xl text-[var(--foreground)] sm:text-3xl">{c.layersTitle}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{c.layersLede}</p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.layers.map((l) => (
                <div key={l.code} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg text-[var(--foreground)]">{l.code}</h3>
                    <StatusPill value={c.statusLabels[l.status as keyof typeof c.statusLabels] ?? l.status} />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-[var(--accent)]">{l.sub}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-body)]">{l.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </FadeInSection>

        {/* Ecosystem projects */}
        <FadeInSection>
          <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-10">
            <div className="text-center">
              <h2 className="font-serif text-2xl text-[var(--foreground)] sm:text-3xl">{c.projectsTitle}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{c.projectsLede}</p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {registry.projects.map((p) => (
                <div key={p.key} className="rounded-lg border border-[var(--border)] p-5">
                  <h3 className="font-serif text-lg text-[var(--foreground)]">{p.name}</h3>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]">
                      {p.url.replace(/^https?:\/\//, "")} ↗
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--muted)]">{typeLabel(lang, p.type)}</p>
                  )}
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-body)]">{projectSummaries[lang][p.key] ?? p.summary}</p>
                </div>
              ))}
            </div>
          </section>
        </FadeInSection>

        {/* Registry access */}
        <FadeInSection>
          <section className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 lg:px-10">
            <h2 className="font-serif text-2xl text-[var(--foreground)] sm:text-3xl">{c.registryTitle}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--muted)]">{c.registryLede}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {c.registryButtons.map((b, i) => (
                <a
                  key={b.label + i}
                  href={b.href}
                  className="rounded-md border border-[var(--accent)] px-5 py-2 text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--background)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {b.label}
                </a>
              ))}
            </div>
          </section>
        </FadeInSection>

        {/* Family Heritage */}
        <FadeInSection>
          <section className="border-t border-[var(--border)] bg-[var(--surface)]">
            <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 lg:px-10">
              <h2 className="font-serif text-xl italic text-[var(--accent)] sm:text-2xl">{c.familyTitle}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-body)]">{c.familyLede}</p>
              <a
                href={`${base}/family`}
                className="mt-5 inline-block rounded-md px-5 py-2 text-sm text-[var(--accent)] underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {c.familyButton} →
              </a>
            </div>
          </section>
        </FadeInSection>
      </main>

      <SiteFooter motto={c.motto} copy={c.copy} contactEmail={null} />
    </>
  );
}
