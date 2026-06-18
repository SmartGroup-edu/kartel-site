"use client";

import { useLangToggle, type Lang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { coreAboutContent } from "../content/coreAbout";

export default function CoreAbout({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = coreAboutContent[lang];

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={[...c.nav]} />

      <main id="main" className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 lg:px-10 lg:pt-20">
        <FadeInSection>
          <header>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">{c.eyebrow}</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-[var(--foreground)] sm:text-4xl lg:text-5xl">
              {c.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-[var(--text-body)]">{c.lede}</p>
          </header>
        </FadeInSection>

        <div className="mt-12 space-y-10">
          {c.sections.map((s) => (
            <FadeInSection key={s.h}>
              <section>
                <h2 className="font-serif text-xl text-[var(--foreground)] sm:text-2xl">{s.h}</h2>
                <p className="mt-2 leading-relaxed text-[var(--text-body)]">{s.p}</p>
              </section>
            </FadeInSection>
          ))}
        </div>

        <FadeInSection>
          <section className="mt-14 border-t border-[var(--border)] pt-8">
            <h2 className="font-serif text-lg text-[var(--foreground)]">{c.ctaTitle}</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {c.cta.map((b) => (
                <a
                  key={b.href}
                  href={b.href}
                  className="rounded-md border border-[var(--accent)] px-5 py-2 text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--background)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {b.label}
                </a>
              ))}
            </div>
          </section>
        </FadeInSection>
      </main>

      <SiteFooter motto={c.motto} copy={c.copy} contactEmail={null} />
    </>
  );
}
