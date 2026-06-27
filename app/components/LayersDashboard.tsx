"use client";

import { useLangToggle, type Lang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { layersContent } from "../content/layers";
import { coreName } from "../content/tokens";
import registry from "../content/registry.public.json";

function StatusPill({ value }: { value: string }) {
  const active = /(active|активно)/i.test(value);
  const tone = active ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}>
      {value}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-[var(--border)] py-2.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-[11px] uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd className="text-sm text-[var(--text-body)]">{children}</dd>
    </div>
  );
}

export default function LayersDashboard({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = layersContent[lang];
  const layers = registry.layerRegistry ?? [];

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={[...c.nav]} />

      <main id="main" className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        <FadeInSection>
          <header className="border-b border-[var(--border)] pb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">{c.eyebrow}</p>
            <h1 className="mt-2 font-serif text-4xl text-[var(--foreground)] sm:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--text-body)]">{c.intro}</p>
          </header>
        </FadeInSection>

        <div className="mt-10 space-y-6">
          {layers.map((l) => (
            <FadeInSection key={l.key}>
              <section id={l.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-serif text-2xl text-[var(--foreground)]">{l.name}</h2>
                  <StatusPill value={c.statusLabels[l.status as keyof typeof c.statusLabels] ?? l.status} />
                </div>
                <dl className="mt-4">
                  <Field label={c.fields.purpose}>{l.purpose}</Field>
                  <Field label={c.fields.canonicalKey}>
                    <span className="font-mono text-[13px] text-[var(--accent)]">{l.canonicalKey}</span>
                  </Field>
                  <Field label={c.fields.authority}>{coreName(lang, l.authority)}</Field>
                  <Field label={c.fields.steward}>{coreName(lang, l.steward)}</Field>
                  <Field label={c.fields.consumers}>{l.consumers.join(" · ")}</Field>
                  <Field label={c.fields.contract}>
                    <span className="font-mono text-[13px] text-[var(--text-body)]">{l.contract}</span>
                  </Field>
                </dl>
              </section>
            </FadeInSection>
          ))}
        </div>

        <FadeInSection>
          <p className="mt-12 border-t border-[var(--border)] pt-6 text-xs leading-relaxed text-[var(--muted)]">
            {c.publicNote}
          </p>
        </FadeInSection>
      </main>

      <SiteFooter motto={c.motto} copy={c.copy} contactEmail={null} />
    </>
  );
}
