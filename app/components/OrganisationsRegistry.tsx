"use client";

import { useLangToggle, type Lang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { organisationsContent } from "../content/organisations";
import registry from "../content/registry.public.json";

function TierPill({ value }: { value: string }) {
  const authority = /(authority|авторитет)/i.test(value);
  const tone = authority
    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)]"
    : "border-[var(--accent)] text-[var(--accent)]";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}>
      {value}
    </span>
  );
}

export default function OrganisationsRegistry({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = organisationsContent[lang];
  const reg = registry.organisationRegistry;
  const orgs = reg.organisations ?? [];
  const campuses = reg.campusesFuture;
  const codeByCode = new Map(orgs.map((o) => [o.code, o.name]));

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
              <span className="font-mono text-[var(--accent)]">{reg.key}</span>
            </p>
          </header>
        </FadeInSection>

        {/* Canonical institutions */}
        <FadeInSection>
          <div className="mt-10 overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">{c.fields.code}</th>
                  <th className="px-4 py-3 font-medium">{c.fields.name}</th>
                  <th className="px-4 py-3 font-medium">{c.fields.tier}</th>
                  <th className="px-4 py-3 font-medium">{c.fields.parent}</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.code} className="border-b border-[var(--border)] align-top last:border-0">
                    <td className="px-4 py-4">
                      <span className="font-mono text-[13px] text-[var(--accent)]">{o.code}</span>
                    </td>
                    <td className="px-4 py-4 font-serif text-base text-[var(--foreground)]">{o.name}</td>
                    <td className="px-4 py-4">
                      <TierPill value={c.tierLabels[o.tier as keyof typeof c.tierLabels] ?? o.tier} />
                    </td>
                    <td className="px-4 py-4 text-[var(--text-body)]">
                      {o.parent ? (
                        <>
                          <span className="font-mono text-[12px] text-[var(--muted)]">{o.parent}</span>
                          <span className="ml-2 text-xs text-[var(--muted)]">{codeByCode.get(o.parent) ?? ""}</span>
                        </>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">{c.rootLabel}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeInSection>

        {/* Future campus layer */}
        <FadeInSection>
          <section className="mt-12 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-serif text-xl text-[var(--foreground)]">{c.campusesTitle}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{c.campusesNote}</p>
            <div className="mt-5 overflow-x-auto rounded-md border border-[var(--border)]">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-4 py-2.5 font-medium">{c.campusFields.campusCode}</th>
                    <th className="px-4 py-2.5 font-medium">{c.campusFields.org}</th>
                    <th className="px-4 py-2.5 font-medium">{c.campusFields.location}</th>
                  </tr>
                </thead>
                <tbody>
                  {(campuses?.examples ?? []).map((ex) => (
                    <tr key={ex.campusCode} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-[12px] text-[var(--muted)]">{ex.campusCode}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-[12px] text-[var(--text-body)]">{ex.org}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-body)]">{ex.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
