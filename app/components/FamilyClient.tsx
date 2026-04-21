"use client";

import { useLang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import HeraldicDivider from "./HeraldicDivider";
import BackToTop from "./BackToTop";
import SkipToContent from "./SkipToContent";
import FamilyTree from "./FamilyTree";
import FamilyTimeline from "./FamilyTimeline";
import { familyContent, groupByGeneration } from "../content/family";

export default function FamilyClient() {
  const { lang, toggleLang, isReady } = useLang();

  const t = familyContent[lang];

  const navItems = [
    { label: t.homeLabel, href: `/?lang=${lang}` },
    { label: t.familyLabel, href: `/family?lang=${lang}`, active: true },
  ];

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <span className="font-serif text-[24px] tracking-[0.12em] text-[var(--accent)] sm:text-[28px]">
          KARTEL
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
      <SkipToContent />
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={navItems} maxWidth="max-w-6xl" />

      <main id="main-content" className="mx-auto max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-20">
        {/* Hero */}
        <FadeInSection>
          <header className="border-b border-[var(--border)] pb-8">
            <h1 className="font-serif text-[28px] leading-[1.2] text-[var(--accent)] sm:text-[36px] lg:text-[48px]">
              {t.title}
            </h1>
            <p className="mt-6 max-w-4xl text-[16px] leading-[1.8] text-[var(--text-secondary)] sm:text-[18px] lg:text-[19px]">
              {t.intro}
            </p>
          </header>
        </FadeInSection>

        {/* Family Tree Visualization */}
        <FadeInSection>
          <section className="py-10 lg:py-14" aria-label={lang === "EN" ? "Family tree" : "Родословное древо"}>
            <FamilyTree lang={lang} />
          </section>
        </FadeInSection>

        {/* Family Chronicle Timeline */}
        <FadeInSection>
          <section className="py-10 lg:py-14" aria-label={lang === "EN" ? "Family chronicle" : "Семейная хроника"}>
            <FamilyTimeline lang={lang} />
          </section>
        </FadeInSection>

        <HeraldicDivider />

        {groupByGeneration(t.people, t.generationLabels).map((group) => (
          <div key={group.key}>
            <HeraldicDivider />

            <section className="py-8 lg:py-12" aria-label={group.title}>
              <FadeInSection>
                <h2 className="mb-6 font-serif text-[18px] tracking-wide text-[var(--accent)] sm:text-[20px] lg:mb-8 lg:text-[22px]">
                  {group.title}
                </h2>
              </FadeInSection>

              <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
                {group.members.map((p) => (
                  <FadeInSection key={p.name}>
                    <article
                      className="group h-full border border-[var(--border)] bg-[var(--surface)] p-5 transition-all duration-200 hover:border-[var(--muted-light)] hover:shadow-md sm:p-6"
                      itemScope
                      itemType="https://schema.org/Person"
                    >
                      <h3
                        className="font-serif text-[20px] leading-[1.3] text-[var(--accent)] transition-colors group-hover:text-[var(--accent-hover)] sm:text-[22px] lg:text-[24px]"
                        itemProp="name"
                      >
                        {p.name}
                      </h3>
                      <p className="mt-3 text-[15px] leading-[1.8] text-[var(--text-secondary)] sm:text-[16px]" itemProp="description">
                        {p.description}
                      </p>
                      <meta itemProp="familyName" content="Kartel" />
                      <meta itemProp="memberOf" content="Kartel Family" />
                    </article>
                  </FadeInSection>
                ))}
              </div>
            </section>
          </div>
        ))}
      </main>

      <SiteFooter motto={t.footerMotto} copy={t.footerCopy} maxWidth="max-w-6xl" />
      <BackToTop />
    </div>
  );
}
