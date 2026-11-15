"use client";

import { useLangToggle, type Lang } from "./useLang";
import { noDashLineStart } from "../lib/typography";
import { H1, H2, PROSE, EYEBROW, META, TH } from "../lib/typeScale";
import Pill from "./Pill";
import SiteHeader from "./SiteHeader";
import { registryNav } from "../content/siteNav";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { organisationsContent } from "../content/organisations";
import registry from "../content/registry.public.json";

function TierPill({ value }: { value: string }) {
  const authority = /(authority|авторитет)/i.test(value);
  return <Pill tone={authority ? "solid" : "accent"}>{value}</Pill>;
}

export default function OrganisationsRegistry({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = organisationsContent[lang];
  const reg = registry.organisationRegistry;
  const orgs = reg.organisations ?? [];
  const codeByCode = new Map(orgs.map((o) => [o.code, o.name]));

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
              <span className="font-mono text-[var(--accent)]">{reg.key}</span>
            </p>
          </header>
        </FadeInSection>

        {/* Canonical institutions */}
        <FadeInSection>
          <div className="mt-10 overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left">
                  <th className={TH}>{c.fields.code}</th>
                  <th className={TH}>{c.fields.name}</th>
                  <th className={TH}>{c.fields.tier}</th>
                  <th className={TH}>{c.fields.parent}</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.code} className="border-b border-[var(--border)] align-top last:border-0">
                    <td className="px-4 py-4">
                      <span className="font-mono text-[14px] text-[var(--accent)]">{o.code}</span>
                    </td>
                    <td className="px-4 py-4 font-serif text-base text-[var(--foreground)]">{o.name}</td>
                    <td className="px-4 py-4">
                      <TierPill value={c.tierLabels[o.tier as keyof typeof c.tierLabels] ?? o.tier} />
                    </td>
                    <td className="px-4 py-4 text-[var(--text-body)]">
                      {o.parent ? (
                        <>
                          <span className="font-mono text-[14px] text-[var(--muted)]">{o.parent}</span>
                          <span className="ml-2 text-[14px] text-[var(--muted)]">{codeByCode.get(o.parent) ?? ""}</span>
                        </>
                      ) : (
                        <span className="text-[14px] text-[var(--muted)]">{c.rootLabel}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeInSection>

        {/* Campus layer — now its own published canonical registry */}
        <FadeInSection>
          <section className="mt-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className={H2}>{c.campusesTitle}</h2>
            <p className={`mt-3 max-w-[68ch] ${PROSE}`}>{noDashLineStart(c.campusesNote)}</p>
            <a
              href={c.campusesHref}
              className="mt-4 inline-block rounded-sm py-1 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {c.campusesLinkLabel} →
            </a>
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
