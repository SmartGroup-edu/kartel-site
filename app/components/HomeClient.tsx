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
        {/* Hero — the crest is in the first screen at every width (prod QA 2026-11-14: it sat
            below the fold at 1024–1920). Phones: title · crest · text. lg+: crest left, spanning
            both rows; title and text right. DOM order keeps the h1 first. */}
        <article id="home" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-10">
          <div className="grid items-start gap-8 [grid-template-areas:'title'_'crest'_'intro'] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-x-12 lg:gap-y-6 lg:[grid-template-areas:'crest_title'_'crest_intro']">
            <FadeInSection className="[grid-area:title]">
              <h1 className="whitespace-pre-line text-center font-serif text-[28px] leading-[1.2] text-[var(--accent)] sm:text-[38px] lg:text-left lg:text-[40px] xl:text-[46px]">
                {t.title}
              </h1>
              <p className="mx-auto mt-4 max-w-[60ch] text-center font-serif text-[18px] leading-[1.5] text-[var(--muted)] sm:text-[20px] lg:mx-0 lg:text-left">
                {t.lede}
              </p>
            </FadeInSection>

            <FadeInSection className="[grid-area:crest] lg:self-start">
              <div className="flex justify-center">
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
                    width={540}
                    height={540}
                    priority
                    speed={0.06}
                    sizes="(max-width: 640px) 280px, (max-width: 1023px) 380px, (max-width: 1279px) 400px, 460px"
                    className="w-full max-w-[280px] object-contain sm:max-w-[380px] lg:max-w-[400px] xl:max-w-[460px]"
                  />
                </button>
              </div>
            </FadeInSection>

            <FadeInSection className="[grid-area:intro]">
              <div className="drop-cap max-w-[68ch] text-[16px] leading-[1.75] text-[var(--text-body)] sm:text-[18px] lg:text-[19px] lg:leading-[1.65] xl:text-[20px]">
                {t.intro.split("\n\n").map((p, idx) => (
                  <p key={idx} className="mb-5 text-left">{p}</p>
                ))}
              </div>
            </FadeInSection>
          </div>
        </article>

        <FadeInSection>
          <MottoBanner lang={lang} />
        </FadeInSection>

        {/* Meaning */}
        <section id="meaning" className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
            {/* Reading column centred at lg+ (re-check 2026-11-14): h2 + text share one
                ≤68ch measure; ch is resolved at the 20px text size so both edges line up. */}
            <div className="lg:mx-auto lg:max-w-[68ch] lg:text-[20px]">
              <FadeInSection>
                <h2 className="mb-8 font-serif text-[22px] leading-[1.2] text-[var(--accent)] sm:text-[28px] lg:mb-12 lg:text-[36px]">
                  {t.meaningTitle}
                </h2>
              </FadeInSection>
              {/* One reading column, left-aligned, ≤68ch (UI/UX audit 2026-11-14 #1, #5). */}
              <FadeInSection>
                <div className="max-w-[68ch] text-[16px] leading-[1.8] text-[var(--text-secondary)] sm:text-[18px] lg:text-[20px] lg:leading-[1.7]">
                  {[t.leftCol, t.rightCol].join("\n\n").split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left">{p}</p>
                  ))}
                </div>
              </FadeInSection>
            </div>
          </div>
        </section>

        {/* Interactive Explorer */}
        <section className="border-t border-[var(--border)]" aria-label={lang === "EN" ? "Interactive coat of arms explorer" : "Интерактивный просмотр герба"}>
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
            <div className="lg:mx-auto lg:max-w-[68ch] lg:text-[20px]">
              <FadeInSection>
                <h2 className="mb-8 font-serif text-[22px] leading-[1.2] text-[var(--accent)] sm:text-[28px] lg:mb-12 lg:text-[36px]">
                  {t.legacyTitle}
                </h2>
              </FadeInSection>
              {/* One reading column, left-aligned, ≤68ch (UI/UX audit 2026-11-14 #1, #5). */}
              <FadeInSection>
                <div className="max-w-[68ch] text-[16px] leading-[1.8] text-[var(--text-secondary)] sm:text-[18px] lg:text-[20px] lg:leading-[1.7]">
                  {[t.finalLeft, t.finalRight].join("\n\n").split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left">{p}</p>
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


        {/* Share */}
        <FadeInSection>
          <div className="border-t border-[var(--border)] py-8 lg:py-10">
            <CopyLinkButton url={`https://kartel.org.uk/${langPath}`} lang={lang} />
          </div>
        </FadeInSection>
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
