"use client";

import { useLangToggle, type Lang } from "./useLang";
import { noDashLineStart } from "../lib/typography";
import { H1, H2, PROSE, EYEBROW, META, TH } from "../lib/typeScale";
import SiteHeader from "./SiteHeader";
import { registryNav } from "../content/siteNav";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { campusesContent } from "../content/campuses";
import registry from "../content/registry.public.json";

export default function CampusRegistry({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = campusesContent[lang];
  const reg = registry.campusRegistry;
  const campuses = reg?.campuses ?? [];

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} subNav={registryNav(lang)} />

      <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        <FadeInSection>
          <header className="border-b border-[var(--border)] pb-8">
            <p className={EYEBROW}>{c.eyebrow}</p>
            <h1 className={`mt-2 ${H1}`}>{c.title}</h1>
            <p className={`mt-4 max-w-[68ch] ${PROSE}`}>{noDashLineStart(c.intro)}</p>
            <p className="mt-4 text-[14px] text-[var(--muted)]">
              <span className="font-mono text-[var(--accent)]">{reg?.key}</span>
            </p>
          </header>
        </FadeInSection>

        {/* Canonical campuses */}
        <FadeInSection>
          <div className="mt-10 overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left">
                  <th className={TH}>{c.fields.code}</th>
                  <th className={TH}>{c.fields.location}</th>
                  <th className={TH}>{c.fields.institution}</th>
                </tr>
              </thead>
              <tbody>
                {campuses.map((cp) => (
                  <tr key={cp.code} className="border-b border-[var(--border)] align-top last:border-0">
                    <td className="px-4 py-4">
                      <span className="font-mono text-[14px] text-[var(--accent)]">{cp.code}</span>
                    </td>
                    <td className="px-4 py-4 font-serif text-base text-[var(--foreground)]">{cp.location}</td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-[14px] text-[var(--text-body)]">{cp.institution}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeInSection>

        {/* Orthogonality + Campus≠Venue notes */}
        <FadeInSection>
          <section className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className={H2}>campusCode ⊥ canonicalOrgCode</h2>
              <p className="mt-2 text-[17px] leading-[1.6] text-[var(--text-body)]">{noDashLineStart(c.orthogonalNote)}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className={H2}>Campus ≠ Venue</h2>
              <p className="mt-2 text-[17px] leading-[1.6] text-[var(--text-body)]">{noDashLineStart(c.venueNote)}</p>
            </div>
          </section>
        </FadeInSection>

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
