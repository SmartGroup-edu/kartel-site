"use client";

import { useLangToggle, type Lang } from "./useLang";
import { noDashLineStart } from "../lib/typography";
import { H1, H2, PROSE, EYEBROW, META } from "../lib/typeScale";
import Pill from "./Pill";
import SiteHeader from "./SiteHeader";
import { registryNav } from "../content/siteNav";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { layersContent } from "../content/layers";
import { coreName, statusLabel } from "../content/tokens";
import { stewardLabels } from "../content/federationCopy";
import registry from "../content/registry.public.json";

function StatusPill({ value, label }: { value: string; label: string }) {
  const active = /active/i.test(value);
  return <Pill tone={active ? "accent" : "muted"}>{label}</Pill>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-[var(--border)] py-2.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-[14px] text-[var(--muted)]">{label}</dt>
      <dd className="text-[17px] leading-[1.6] text-[var(--text-body)]">{children}</dd>
    </div>
  );
}

export default function LayersDashboard({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = layersContent[lang];
  const layers = registry.layerRegistry ?? [];

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} subNav={registryNav(lang)} />

      <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        <FadeInSection>
          <header className="border-b border-[var(--border)] pb-8">
            <p className={EYEBROW}>{c.eyebrow}</p>
            <h1 className={`mt-2 ${H1}`}>{c.title}</h1>
            <p className={`mt-4 max-w-[68ch] ${PROSE}`}>{noDashLineStart(c.intro)}</p>
          </header>
        </FadeInSection>

        <div className="mt-10 space-y-6">
          {layers.map((l) => (
            <FadeInSection key={l.key}>
              <section id={l.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className={H2}>{l.name}</h2>
                  <StatusPill value={l.status} label={statusLabel(lang, l.status) ?? l.status} />
                </div>
                <dl className="mt-4">
                  <Field label={c.fields.purpose}>{l.purpose}</Field>
                  <Field label={c.fields.canonicalKey}>
                    <span className="font-mono text-sm text-[var(--accent)]">{l.canonicalKey}</span>
                  </Field>
                  <Field label={c.fields.authority}>{coreName(lang, l.authority)}</Field>
                  <Field label={c.fields.steward}>{stewardLabels[lang][l.key] ?? coreName(lang, l.steward)}</Field>
                  <Field label={c.fields.consumers}>{l.consumers.join(" · ")}</Field>
                  <Field label={c.fields.contract}>
                    <span className="font-mono text-sm text-[var(--text-body)]">{l.contract}</span>
                  </Field>
                </dl>
              </section>
            </FadeInSection>
          ))}
        </div>

        <FadeInSection>
          <p className={`mt-12 border-t border-[var(--border)] pt-6 ${META}`}>
            {noDashLineStart(c.publicNote)}
          </p>
        </FadeInSection>
      </main>

      <SiteFooter motto={c.motto} copy={c.copy} contactEmail={null} />
    </>
  );
}
