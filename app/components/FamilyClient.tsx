"use client";

import { CrestThumb } from "./FamilyKodeks";
import { useLangToggle, type Lang } from "./useLang";
import { H1 } from "../lib/typeScale";
import SiteHeader from "./SiteHeader";
import FamilySubNav from "./FamilySubNav";
import { FAMILY_MAIN, FAMILY_HEADER_MAX } from "../lib/family-nav.mjs";
import Link from "next/link";
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

export default function FamilyClient({ lang, data, nav = { admin: false, editor: false, os: false, member: false } }: { lang: Lang; data: FamilyData; nav?: { admin: boolean; editor?: boolean; os: boolean; member: boolean } }) {
  const toggleLang = useLangToggle(lang);

  const t = data.content;

  const navItems = familyNav(lang);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={navItems} maxWidth={FAMILY_HEADER_MAX} />

      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin={nav.admin} editor={Boolean(nav.editor)} os={nav.os} active="heritage" />
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

        {nav.member && (
          <Link href={`/${lang === "EN" ? "en" : "ru"}/family/os`} data-os-entry=""
            className="mt-8 flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 transition-colors hover:border-[var(--accent)]">
            <span>
              <span className="block font-serif text-[19px] text-[var(--foreground)]">{lang === "EN" ? "Today in the family" : "Сегодня в семье"}</span>
              <span className="mt-0.5 block text-[15px] text-[var(--text-secondary)]">{lang === "EN" ? "Your day, the people and the family council." : "Ваш день, люди и семейный совет."}</span>
            </span>
            <span aria-hidden="true" className="text-[22px] text-[var(--accent)]">→</span>
          </Link>
        )}

        {/* bus 86 + kartel-agent 2026-11-18: the third way into the Кодекс — it grew out of the coat of arms */}
        {nav.member && (
          <Link href={`/${lang === "EN" ? "en" : "ru"}/family/os/kodeks`} data-kodeks-entry=""
            className="mt-3 flex items-center gap-4 rounded-lg border border-[var(--border)] border-l-2 border-l-[var(--pillar-kodeks)] bg-[var(--surface)] px-5 py-4 transition-colors hover:border-[var(--accent)]">
            <CrestThumb element="mantling" size={52} />
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-[19px] text-[var(--foreground)]">{lang === "EN" ? "The family code" : "Кодекс семьи"}</span>
              <span className="mt-0.5 block text-[15px] text-[var(--text-secondary)]">{lang === "EN" ? "Eight principles that grew out of the coat of arms." : "Восемь принципов, выросших из герба."}</span>
            </span>
            <span aria-hidden="true" className="text-[22px] text-[var(--accent)]">→</span>
          </Link>
        )}

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
