"use client";

import { useLangToggle, type Lang } from "./useLang";
import SiteHeader from "./SiteHeader";
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
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={[...c.nav]} />

      <main id="main" className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        <FadeInSection>
          <header className="border-b border-[var(--border)] pb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">{c.eyebrow}</p>
            <h1 className="mt-2 font-serif text-4xl text-[var(--foreground)] sm:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--text-body)]">{c.intro}</p>
            <p className="mt-4 text-xs text-[var(--muted)]">
              <span className="font-mono text-[var(--accent)]">{reg?.key}</span>
            </p>
          </header>
        </FadeInSection>

        {/* Canonical campuses */}
        <FadeInSection>
          <div className="mt-10 overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">{c.fields.code}</th>
                  <th className="px-4 py-3 font-medium">{c.fields.location}</th>
                  <th className="px-4 py-3 font-medium">{c.fields.institution}</th>
                </tr>
              </thead>
              <tbody>
                {campuses.map((cp) => (
                  <tr key={cp.code} className="border-b border-[var(--border)] align-top last:border-0">
                    <td className="px-4 py-4">
                      <span className="font-mono text-[13px] text-[var(--accent)]">{cp.code}</span>
                    </td>
                    <td className="px-4 py-4 font-serif text-base text-[var(--foreground)]">{cp.location}</td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-[12px] text-[var(--text-body)]">{cp.institution}</span>
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
              <h2 className="font-serif text-lg text-[var(--foreground)]">campusCode ⊥ canonicalOrgCode</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{c.orthogonalNote}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-serif text-lg text-[var(--foreground)]">Campus ≠ Venue</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{c.venueNote}</p>
            </div>
          </section>
        </FadeInSection>

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
