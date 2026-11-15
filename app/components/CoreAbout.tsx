"use client";

import { useLangToggle, type Lang } from "./useLang";
import { noDashLineStart } from "../lib/typography";
import { H1, H2, PROSE, EYEBROW } from "../lib/typeScale";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { coreAboutContent } from "../content/coreAbout";

export default function CoreAbout({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = coreAboutContent[lang];

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} />

      <main id="main" className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-20 pt-12 sm:px-6 lg:px-10 lg:pt-20">
        <FadeInSection>
          <header>
            <p className={EYEBROW}>{c.eyebrow}</p>
            <h1 className={`mt-3 ${H1}`}>
              {c.title}
            </h1>
            <p className={`mt-6 max-w-[68ch] ${PROSE}`}>{noDashLineStart(c.lede)}</p>
          </header>
        </FadeInSection>

        <div className="mt-14 space-y-12">
          {c.sections.map((s) => (
            <FadeInSection key={s.h}>
              <section>
                <h2 className={H2}>{s.h}</h2>
                <p className={`mt-4 max-w-[68ch] ${PROSE}`}>{noDashLineStart(s.p)}</p>
              </section>
            </FadeInSection>
          ))}
        </div>

        <FadeInSection>
          <section className="mt-14 border-t border-[var(--border)] pt-8 print:hidden">
            <h2 className={H2}>{c.ctaTitle}</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {c.cta.map((b) => (
                <a
                  key={b.href}
                  href={b.href}
                  className="inline-flex min-h-11 items-center rounded-md border border-[var(--accent)] px-5 text-[15px] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--on-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
