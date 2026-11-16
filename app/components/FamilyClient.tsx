"use client";

import { useLangToggle, type Lang } from "./useLang";
import { H1 } from "../lib/typeScale";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import HeraldicDivider from "./HeraldicDivider";
import BackToTop from "./BackToTop";
import FamilyTree from "./FamilyTree";
import FamilyTimeline from "./FamilyTimeline";
import type { TreeNode, TimelineEvent } from "../content/family";
import type { FamilyMediaContent } from "../lib/family-media";
import type { familyContent } from "../content/family-private";
import { familyNav } from "../content/siteNav";

/** Everything personal arrives as props from the gated server page (app/[lang]/family/page.tsx),
 *  never from a client-side import — so no name is ever in the public JS bundle. */
export interface FamilyData {
  content: (typeof familyContent)[Lang];
  nodes: TreeNode[];
  events: TimelineEvent[];
  /** Published portraits, dates, places, professions, stories and photos from the family editor. */
  media: FamilyMediaContent;
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
            <h1 className={H1}>
              {t.title}
            </h1>
            <p className="mt-6 max-w-[68ch] text-[17px] leading-[1.65] text-[var(--text-secondary)] lg:text-[19px] lg:leading-[1.7]">
              {t.intro}
            </p>
          </header>
        </FadeInSection>

        {/* Family Tree Visualization */}
        <FadeInSection>
          <section className="py-10 lg:py-14" aria-label={lang === "EN" ? "Family tree" : "Родословное древо"}>
            <FamilyTree lang={lang} nodes={data.nodes} persons={data.media.persons} />
          </section>
        </FadeInSection>

        {/* Family Chronicle Timeline */}
        <FadeInSection>
          <section className="py-10 lg:py-14" aria-label={lang === "EN" ? "Family chronicle" : "Семейная хроника"}>
            <FamilyTimeline lang={lang} events={data.events} details={data.media.events} dims={data.media.dims} />
          </section>
        </FadeInSection>

        <HeraldicDivider />

        {/* Per-generation cards removed (gated UI/UX audit 2026-11-14 #4): the tree and the chronicle
            already show every level; unique details moved into the chronicle. */}
      </main>

      <SiteFooter motto={t.footerMotto} copy={t.footerCopy} maxWidth="max-w-6xl" />
      <BackToTop />
    </div>
  );
}
