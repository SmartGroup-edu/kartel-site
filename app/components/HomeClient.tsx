"use client";

import { useState } from "react";
import { latinMotto } from "../lib/latin";
import { H2, H3 } from "../lib/typeScale";
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

const SECTION_IDS = ["office", "companies", "home", "meaning", "legacy"];

/** Public home. Bus 172 P5 (mockup v5, R0-approved 26.11.2026): the family-office view (PublicOffice — hero, registry
 *  counts, companies) opens the page; the coat of arms (R0 2026-11-14: the main page) follows in full, unchanged
 *  below its heading, which is now an H2. No personal data here — family names live only in the gated /family area
 *  (app/content/family-private.ts). */
/**
 * The Meaning essay grouped under element subheadings (cycle 10 #1), split only at the existing
 * paragraph boundaries — no copy changes. The first paragraph is about the staff the griffin holds
 * (the griffin itself is described in the story), and the mantling has no marker on the crest, so
 * it gets a heading but no "See on the crest" link. Names follow the explorer's labels.
 */
const MEANING_ORDER = [
  { id: "staff", en: "Staff", ru: "Жезл", count: 1, onCrest: true },
  { id: "keys", en: "Crossed keys", ru: "Скрещённые ключи", count: 2, onCrest: true },
  { id: "wings", en: "Wings", ru: "Крылья", count: 2, onCrest: true },
  { id: "mantling", en: "Mantling", ru: "Намёт", count: 1, onCrest: false },
  { id: "coronet", en: "Coronet", ru: "Корона", count: 1, onCrest: true },
  { id: "fleurdelis", en: "Fleur-de-lis", ru: "Лилии", count: 1, onCrest: true },
  { id: "swords", en: "Swords", ru: "Мечи", count: 1, onCrest: true },
  { id: "motto", en: "Motto", ru: "Девиз", count: 1, onCrest: true },
] as const;

function meaningGroups(paras: string[]) {
  let at = 0;
  const groups = MEANING_ORDER.map((g) => {
    const slice = paras.slice(at, at + g.count);
    at += g.count;
    return { ...g, paras: slice };
  });
  // Any paragraphs beyond the map stay visible under the last heading rather than vanish.
  if (at < paras.length) groups[groups.length - 1].paras.push(...paras.slice(at));
  return groups.filter((g) => g.paras.length > 0);
}

/** `office`: the server-rendered PublicOffice block, passed in so the registry JSON it reads never ships to the browser. */
export default function HomeClient({ lang, office }: { lang: Lang; office: React.ReactNode }) {
  const toggleLang = useLangToggle(lang);
  const langPath = lang.toLowerCase();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const t = homeContent[lang];
  useSectionKeyboard(SECTION_IDS);

  // The one site menu (SiteHeader default); the page's own sections sit in the second row.
  // First section is the crest itself; "Home" here would repeat the header's Home link.
  const overviewLabel = lang === "RU" ? "Обзор" : "Overview";
  const sectionNav = [
    { label: overviewLabel, href: "#office" },
    { label: lang === "RU" ? "Компании" : "Companies", href: "#companies" },
    { label: lang === "RU" ? "Герб" : "Coat of arms", href: "#home" },
    { label: t.navMeaning, href: "#meaning" },
    { label: t.navLegacy, href: "#legacy" },
  ];

  return (
    // [data-fos]: the v5 palette and type (app/globals.css) for the whole home, crest sections included.
    <div data-fos="" className="min-h-screen bg-[var(--fos-bg)] text-[var(--foreground)]">
      <ReadingProgress />
      <SiteHeader
        lang={lang}
        toggleLang={toggleLang}
        subNav={sectionNav}
        subNavLabel={lang === "RU" ? "Разделы главной страницы" : "Home page sections"}
      />

      <main id="main">
        {office}

        {/* The coat of arms (the hero until bus 172 P5; design pass 2026-11-15): crest + heading + lede + two actions; the essay starts below.
            Below 1024px: title · crest · lede · actions (h1 first in the DOM) — at tablet width two
            half columns squeezed the crest and broke the title (cycle 9 #2). 640–1023 centres all
            four on one axis (cycle 10 #2); phones stay left-aligned for the longer lede. lg+ and phones held
            sideways: crest left, the text block vertically centred against it; sideways the crest
            is sized by the viewport height. One edge (or one axis, 640–1023) for all hero text. */}
        <article id="home" aria-labelledby="crest-title" className="mx-auto max-w-7xl scroll-mt-28 border-t border-[var(--border)] px-4 py-12 sm:px-6 lg:px-10 lg:py-20 short-land:py-4">
          <div className="grid w-full gap-6 [grid-template-areas:'title'_'crest'_'text'] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-16 lg:[grid-template-areas:'crest_.'_'crest_title'_'crest_text'_'crest_.'] lg:[grid-template-rows:1fr_auto_auto_1fr] short-land:grid-cols-[auto_minmax(0,1fr)] short-land:gap-x-8 short-land:gap-y-4 short-land:[grid-template-areas:'crest_.'_'crest_title'_'crest_text'_'crest_.'] short-land:[grid-template-rows:1fr_auto_auto_1fr]">
            <div className="[grid-area:title] sm:text-center lg:text-left short-land:text-left">
              <h2 id="crest-title" className={`${H2} text-balance short-land:text-[30px]`}>
                {t.title}
              </h2>
            </div>

            <div className="[grid-area:crest] flex justify-center lg:items-center short-land:items-center">
              <span id="crest-desc" className="sr-only">
                {latinMotto(lang === "EN"
                  ? "Heraldic coat of arms featuring a griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the motto Virtus et Potestas. Click to view full size."
                  : "Геральдический герб с грифоном, скрещёнными ключами, короной, мечами, лилиями, крыльями и девизом Virtus et Potestas. Нажмите для увеличения.")}
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
                  sizes="(max-width: 639px) 300px, (max-width: 1023px) 380px, (max-width: 1279px) 440px, 500px"
                  className="h-auto w-full max-w-[300px] object-contain sm:max-w-[380px] lg:max-w-[440px] xl:max-w-[500px] short-land:h-[calc(100svh-5.5rem)] short-land:w-auto short-land:max-w-none"
                />
              </button>
            </div>

            <div className="[grid-area:text] sm:text-center lg:text-left short-land:text-left">
              <p className="max-w-[36ch] font-serif text-[20px] leading-[1.45] text-[var(--text-body)] sm:mx-auto lg:mx-0 lg:text-[24px] short-land:mx-0 short-land:max-w-[44ch] short-land:text-[17px]">
                {latinMotto(noDashLineStart(t.lede))}
              </p>
              <div className="mt-8 flex flex-wrap gap-3 sm:justify-center lg:justify-start print:hidden short-land:mt-4 short-land:justify-start">
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
              <h2 className={`mb-8 lg:mb-10 ${H2}`}>
                {lang === "EN" ? "The story" : "История"}
              </h2>
              {t.intro.split("\n\n").map((p, idx) => (
                <p key={idx} className="mb-5 text-left">{latinMotto(noDashLineStart(p))}</p>
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
                <h2 className={`mb-8 lg:mb-10 ${H2}`}>
                  {t.meaningTitle}
                </h2>
              </FadeInSection>
              {/* One reading column, left-aligned, ≤68ch (UI/UX audit 2026-11-14 #1, #5). */}
              <FadeInSection>
                <div className="max-w-[68ch] text-[17px] leading-[1.65] text-[var(--text-body)] lg:text-[19px] lg:leading-[1.7]">
                  {meaningGroups([t.leftCol, t.rightCol].join("\n\n").split("\n\n")).map((g) => (
                    <div key={g.id} className="mt-10 first:mt-0">
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className={H3}>{lang === "EN" ? g.en : g.ru}</h3>
                        {g.onCrest && (
                          <a
                            href={`#explorer-${g.id}`}
                            onClick={(e) => {
                              // Same hash twice fires no hashchange — re-run the deep link ourselves.
                              if (window.location.hash === `#explorer-${g.id}`) {
                                e.preventDefault();
                                window.dispatchEvent(new HashChangeEvent("hashchange"));
                              }
                            }}
                            className="rounded-sm text-[15px] text-[var(--accent)] underline decoration-1 underline-offset-4 hover:text-[var(--accent-hover)] print:hidden"
                          >
                            {lang === "EN" ? "See on the crest" : "Показать на гербе"}
                          </a>
                        )}
                      </div>
                      {g.paras.map((p, idx) => (
                        <p key={idx} className="mb-5 text-left">{latinMotto(noDashLineStart(p))}</p>
                      ))}
                    </div>
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

        {/* One separator per break: the ornament, no rule under it (cycle 2 #3). */}
        <HeraldicDivider />

        {/* Legacy */}
        <section id="legacy">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
            {/* Reading column centred at lg+ (re-check 2026-11-14): h2 + text share one
                ≤68ch measure; ch is resolved at the 20px text size so both edges line up. */}
            <div className="mx-auto max-w-[68ch] lg:text-[19px]">
              <FadeInSection>
                <h2 className={`mb-8 lg:mb-10 ${H2}`}>
                  {t.legacyTitle}
                </h2>
              </FadeInSection>
              {/* One reading column, left-aligned, ≤68ch (UI/UX audit 2026-11-14 #1, #5). */}
              <FadeInSection>
                <div className="max-w-[68ch] text-[17px] leading-[1.65] text-[var(--text-body)] lg:text-[19px] lg:leading-[1.7]">
                  {[t.finalLeft, t.finalRight].join("\n\n").split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left">{latinMotto(noDashLineStart(p))}</p>
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
        <section data-closing="" aria-label={lang === "EN" ? "Motto" : "Девиз"}>
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
            <p className="font-serif text-[40px] italic leading-[1.1] text-[var(--accent)] lg:text-[56px]" lang="la">
              Virtus et Potestas
            </p>
            <p className="mt-3 text-[17px] text-[var(--text-body)] lg:text-[19px]">
              {lang === "EN" ? "Strength and Power" : "Сила и Власть"}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 print:hidden">
              <a
                href="#explorer"
                className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-[15px] font-medium text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {lang === "EN" ? "Explore the coat of arms" : "Исследовать герб"}
              </a>
              <a
                href={`/${langPath}/family/os`}
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--accent)] px-5 text-[15px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {lang === "EN" ? "Family area — members only" : "Семейный кабинет — только для членов семьи"}
              </a>
            </div>
            <div className="mt-6 print:hidden">
              <CopyLinkButton url={`https://kartel.org.uk/${langPath}`} lang={lang} />
            </div>
          </div>
        </section>
      </main>

      {/* Public home: no personal contact address (same rule as the previous public home). */}
      <SiteFooter copy={t.footerCopy} contactEmail={null} />
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
