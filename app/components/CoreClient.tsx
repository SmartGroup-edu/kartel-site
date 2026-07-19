"use client";

import { useLangToggle, type Lang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { coreContent } from "../content/core";
import { projectSummaries } from "../content/federationCopy";
import { typeLabel } from "../content/tokens";
import registry from "../content/registry.public.json";

function StatusPill({ value }: { value: string }) {
  const v = value.toLowerCase();
  const active = /(live|active|connected|producer|активно)/.test(v);
  // shadcn <Badge outline>; the gold-vs-muted tone (live/active vs pending) is preserved via className.
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-2 py-0.5 text-[10px] uppercase tracking-wide",
        active ? "border-[var(--accent)] text-[var(--accent)]" : "text-[var(--muted)]",
      )}
    >
      {value}
    </Badge>
  );
}

export default function CoreClient({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = coreContent[lang];

  return (
    <>
      <SiteHeader
        lang={lang}
        toggleLang={toggleLang}
        navItems={[...c.nav, { label: lang === "EN" ? "Sign in" : "Войти", href: `/${lang.toLowerCase()}/family` }]}
      />

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
                <Card key={l.code} className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg text-[var(--foreground)]">{l.code}</h3>
                    <StatusPill value={c.statusLabels[l.status as keyof typeof c.statusLabels] ?? l.status} />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-[var(--accent)]">{l.sub}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-body)]">{l.desc}</p>
                </Card>
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
                <Card key={p.key} className="bg-transparent p-5 shadow-none">
                  <h3 className="font-serif text-lg text-[var(--foreground)]">{p.name}</h3>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]">
                      {p.url.replace(/^https?:\/\//, "")} ↗
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--muted)]">{typeLabel(lang, p.type)}</p>
                  )}
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-body)]">{projectSummaries[lang][p.key] ?? p.summary}</p>
                </Card>
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
                <Button
                  key={b.label + i}
                  asChild
                  variant="outline"
                  className="border-[var(--accent)] px-5 text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)]"
                >
                  <a href={b.href}>{b.label}</a>
                </Button>
              ))}
            </div>
          </section>
        </FadeInSection>
      </main>

      <SiteFooter motto={c.motto} copy={c.copy} contactEmail={null} />
    </>
  );
}
