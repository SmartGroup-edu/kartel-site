"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ParallaxImage from "./ParallaxImage";
import ImageLightbox from "./ImageLightbox";
import { useLangToggle, type Lang } from "./useLang";
import { useSectionKeyboard } from "./useSectionKeyboard";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import HeraldicDivider from "./HeraldicDivider";
import BackToTop from "./BackToTop";
import ReadingProgress from "./ReadingProgress";
import CopyLinkButton from "./CopyLinkButton";
import HeraldicPalette from "./HeraldicPalette";
import MottoBanner from "./MottoBanner";
import { homeContent } from "../content/home";
import { noDashLineStart } from "../lib/typography";

// Below-the-fold interactive widget — split into its own chunk so the
// 8 heraldic-element descriptions (~16KB of EN+RU prose) don't ship with
// the initial page bundle. SSR is preserved so the section text still
// lands in the prerendered HTML for SEO.
const CrestExplorer = dynamic(() => import("./CrestExplorer"));

const SECTION_IDS = ["home", "meaning", "legacy"];

/** Public home (R0 2026-11-14: the coat of arms is the main page). No personal data here —
 *  family names live only in the gated /family area (app/content/family-private.ts). */
export default function HomeClient({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const langPath = lang.toLowerCase();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const t = homeContent[lang];
  useSectionKeyboard(SECTION_IDS);

  // The one site menu (SiteHeader default); the page's own sections sit in the second row.
  // First section is the crest itself; "Home" here would repeat the header's Home link.
  const overviewLabel = lang === "RU" ? "Обзор" : "Overview";
  const sectionNav = [
    { label: overviewLabel, href: "#home" },
    { label: t.navMeaning, href: "#meaning" },
    { label: t.navLegacy, href: "#legacy" },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <ReadingProgress />
      <SiteHeader
        lang={lang}
        toggleLang={toggleLang}
        subNav={sectionNav}
        subNavLabel={lang === "RU" ? "Разделы страницы герба" : "Coat of arms sections"}
      />

      <main id="main">
        {/* Hero (design pass 2026-11-15): crest + H1 + lede + two actions; the essay starts below.
            Phones: title · crest · lede · actions (h1 first in the DOM). lg+: crest left, the text
            block vertically centred against it. One left edge for all hero text at every width. */}
        <article id="home" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:flex md:min-h-[calc(100svh-8.5rem)] md:items-center lg:px-10 lg:py-8">
          <div className="grid w-full gap-6 [grid-template-areas:'title'_'crest'_'text'] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-x-10 md:[grid-template-areas:'crest_.'_'crest_title'_'crest_text'_'crest_.'] md:[grid-template-rows:1fr_auto_auto_1fr] lg:gap-x-16">
            <div className="[grid-area:title]">
              <h1 className="font-serif text-[36px] leading-[1.1] tracking-[-0.01em] text-[var(--accent)] md:text-[44px] lg:text-[54px]">
                {t.title}
              </h1>
            </div>

            <div className="[grid-area:crest] flex justify-center md:items-center">
              <span id="crest-desc" className="sr-only">
                {lang === "EN"
                  ? "Heraldic coat of arms featuring a griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the motto Virtus et Potestas. Click to view full size."
                  : "Геральдический герб с грифоном, скрещёнными ключами, короной, мечами, лилиями, крыльями и девизом Virtus et Potestas. Нажмите для увеличения."}
              </span>
              <button
                onClick={() => setLightboxOpen(true)}
                className="cursor-zoom-in rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                aria-label={lang === "EN" ? "View coat of arms full size" : "Открыть герб в полном размере"}
                aria-describedby="crest-desc"
              >
                <ParallaxImage
                  src="/crest.jpeg"
                  alt={lang === "EN" ? "Kartel family coat of arms — Virtus et Potestas" : "Фамильный герб Картель — Virtus et Potestas"}
                  width={900}
                  height={1000}
                  priority
                  speed={0.06}
                  sizes="(max-width: 767px) 300px, (max-width: 1023px) 380px, (max-width: 1279px) 440px, 500px"
                  className="h-auto w-full max-w-[300px] object-contain sm:max-w-[380px] lg:max-w-[440px] xl:max-w-[500px]"
                />
              </button>
            </div>

            <div className="[grid-area:text]">
              <p className="max-w-[36ch] font-serif text-[20px] leading-[1.45] text-[var(--text-body)] lg:text-[24px]">
                {noDashLineStart(t.lede)}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#explorer"
                  className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-[15px] font-medium text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {lang === "EN" ? "Explore the coat of arms" : "Исследовать герб"}
                </a>
                <a
                  href="#story"
                  className="inline-flex min-h-11 items-center rounded-md border border-[var(--accent)] px-5 text-[15px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {lang === "EN" ? "Read the story" : "Читать"}
                </a>
              </div>
            </div>
          </div>
        </article>

        {/* The story — the essay opens here, in the one centred reading column (no drop cap). */}
        <section id="story" aria-label={lang === "EN" ? "The story" : "История"} className="scroll-mt-28 border-t border-[var(--border)]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
            <div className="mx-auto max-w-[68ch] text-[17px] leading-[1.65] text-[var(--text-body)] lg:text-[19px] lg:leading-[1.7]">
              <h2 className="mb-8 font-serif text-[28px] leading-[1.15] text-[var(--accent)] lg:mb-10 lg:text-[35px]">
                {lang === "EN" ? "The story" : "История"}
              </h2>
              {t.intro.split("\n\n").map((p, idx) => (
                <p key={idx} className="mb-5 text-left">{noDashLineStart(p)}</p>
              ))}
            </div>
          </div>
        </section>

        <FadeInSection>
          <MottoBanner lang={lang} />
        </FadeInSection>

        {/* Meaning */}
        <section id="meaning" className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
            {/* Reading column centred at lg+ (re-check 2026-11-14): h2 + text share one
                ≤68ch measure; ch is resolved at the 20px text size so both edges line up. */}
            <div className="mx-auto max-w-[68ch] lg:text-[19px]">
              <FadeInSection>
                <h2 className="mb-8 font-serif text-[28px] leading-[1.15] text-[var(--accent)] lg:mb-10 lg:text-[35px]">
                  {t.meaningTitle}
                </h2>
              </FadeInSection>
              {/* One reading column, left-aligned, ≤68ch (UI/UX audit 2026-11-14 #1, #5). */}
              <FadeInSection>
                <div className="max-w-[68ch] text-[17px] leading-[1.65] text-[var(--text-body)] lg:text-[19px] lg:leading-[1.7]">
                  {[t.leftCol, t.rightCol].join("\n\n").split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left">{noDashLineStart(p)}</p>
                  ))}
                </div>
              </FadeInSection>
            </div>
          </div>
        </section>

        {/* Interactive Explorer */}
        <section id="explorer" className="scroll-mt-28 border-t border-[var(--border)]" aria-label={lang === "EN" ? "Interactive coat of arms explorer" : "Интерактивный просмотр герба"}>
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
            <FadeInSection>
              <CrestExplorer lang={lang} />
            </FadeInSection>
          </div>
        </section>

        <HeraldicDivider />

        {/* Legacy */}
        <section id="legacy" className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
            {/* Reading column centred at lg+ (re-check 2026-11-14): h2 + text share one
                ≤68ch measure; ch is resolved at the 20px text size so both edges line up. */}
            <div className="mx-auto max-w-[68ch] lg:text-[19px]">
              <FadeInSection>
                <h2 className="mb-8 font-serif text-[28px] leading-[1.15] text-[var(--accent)] lg:mb-10 lg:text-[35px]">
                  {t.legacyTitle}
                </h2>
              </FadeInSection>
              {/* One reading column, left-aligned, ≤68ch (UI/UX audit 2026-11-14 #1, #5). */}
              <FadeInSection>
                <div className="max-w-[68ch] text-[17px] leading-[1.65] text-[var(--text-body)] lg:text-[19px] lg:leading-[1.7]">
                  {[t.finalLeft, t.finalRight].join("\n\n").split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left">{noDashLineStart(p)}</p>
                  ))}
                </div>
              </FadeInSection>
            </div>

            {/* Colour Palette */}
            <FadeInSection>
              <div className="mt-12 border-t border-[var(--border)] pt-12 lg:mt-16 lg:pt-16">
                <HeraldicPalette lang={lang} />
              </div>
            </FadeInSection>
          </div>
        </section>

        <HeraldicDivider />

        {/* Closing (home cycle 1 #5): the motto, then where to go next — and the copy-link control. */}
        <section aria-label="Virtus et Potestas" className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
            <p className="font-serif text-[40px] italic leading-[1.1] text-[var(--accent)] lg:text-[56px]" lang="la">
              Virtus et Potestas
            </p>
            <p className="mt-3 text-[17px] text-[var(--text-body)] lg:text-[19px]">
              {lang === "EN" ? "Strength and Power" : "Сила и Власть"}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#explorer"
                className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-[15px] font-medium text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {lang === "EN" ? "Explore the coat of arms" : "Исследовать герб"}
              </a>
              <a
                href={`/${langPath}/family`}
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--accent)] px-5 text-[15px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {lang === "EN" ? "Family Heritage — members only" : "Семейное наследие — только для членов семьи"}
              </a>
            </div>
            <div className="mt-6">
              <CopyLinkButton url={`https://kartel.org.uk/${langPath}`} lang={lang} />
            </div>
          </div>
        </section>
      </main>

      {/* Public home: no personal contact address (same rule as the previous public home). */}
      <SiteFooter motto={t.footerMotto} copy={t.footerCopy} contactEmail={null} />
      <BackToTop />
      <ImageLightbox
        src="/crest.jpeg"
        webpSrc="/crest.webp"
        alt={lang === "EN" ? "Kartel family coat of arms — Virtus et Potestas" : "Фамильный герб Картель — Virtus et Potestas"}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
