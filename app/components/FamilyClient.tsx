"use client";

import { useLangToggle, type Lang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import HeraldicDivider from "./HeraldicDivider";
import BackToTop from "./BackToTop";
import FamilyTree from "./FamilyTree";
import FamilyTimeline from "./FamilyTimeline";
import { groupByGeneration, type TreeNode, type TimelineEvent } from "../content/family";
import type { familyContent } from "../content/family-private";
import { familyNav } from "../content/siteNav";

/** Everything personal arrives as props from the gated server page (app/[lang]/family/page.tsx),
 *  never from a client-side import — so no name is ever in the public JS bundle. */
export interface FamilyData {
  content: (typeof familyContent)[Lang];
  nodes: TreeNode[];
  events: TimelineEvent[];
}

export default function FamilyClient({ lang, data }: { lang: Lang; data: FamilyData }) {
  const toggleLang = useLangToggle(lang);

  const t = data.content;

  const navItems = familyNav(lang);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={navItems} maxWidth="max-w-6xl" />

      <main id="main" className="mx-auto max-w-6xl flex-1 px-4 pb-4 pt-10 sm:px-6 sm:pt-12 lg:px-10 lg:pb-6 lg:pt-20">
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
            <FamilyTree lang={lang} nodes={data.nodes} />
          </section>
        </FadeInSection>

        {/* Family Chronicle Timeline */}
        <FadeInSection>
          <section className="py-10 lg:py-14" aria-label={lang === "EN" ? "Family chronicle" : "Семейная хроника"}>
            <FamilyTimeline lang={lang} events={data.events} />
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
