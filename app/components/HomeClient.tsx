"use client";

import { useMemo, useState } from "react";
import ParallaxImage from "./ParallaxImage";
import ImageLightbox from "./ImageLightbox";
import { useLang } from "./useLang";
import { useActiveSection } from "./useActiveSection";
import { useSectionKeyboard } from "./useSectionKeyboard";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import HeraldicDivider from "./HeraldicDivider";
import BackToTop from "./BackToTop";
import SkipToContent from "./SkipToContent";
import ReadingProgress from "./ReadingProgress";
import ShareButtons from "./ShareButtons";
import CrestExplorer from "./CrestExplorer";
import HeraldicPalette from "./HeraldicPalette";
import MottoBanner from "./MottoBanner";
import SectionDots from "./SectionDots";
import { homeContent } from "../content/home";

const SECTION_IDS = ["home", "meaning", "legacy"];

export default function HomeClient() {
  const { lang, toggleLang, isReady } = useLang();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const t = homeContent[lang];
  const activeSection = useActiveSection(SECTION_IDS);
  useSectionKeyboard(SECTION_IDS);

  const navItems = useMemo(() => [
    { label: t.navHome, href: "#home", active: activeSection === "home" },
    { label: t.navMeaning, href: "#meaning", active: activeSection === "meaning" },
    { label: t.navLegacy, href: "#legacy", active: activeSection === "legacy" },
    { label: t.navFamily, href: `/family?lang=${lang}` },
  ], [t, activeSection, lang]);

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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <ReadingProgress />
      <SkipToContent />
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={navItems} />
      <SectionDots
        sections={[
          { id: "home", label: t.navHome },
          { id: "meaning", label: t.navMeaning },
          { id: "legacy", label: t.navLegacy },
        ]}
        activeSection={activeSection}
      />

      <main id="main-content">
        {/* Hero */}
        <article id="home" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
            <FadeInSection>
              <h1 className="whitespace-pre-line text-center font-serif text-[28px] leading-[1.2] text-[var(--accent)] sm:text-[38px] lg:text-left lg:text-[58px]">
                {t.title}
              </h1>
              <div className="mt-8 flex justify-center lg:justify-start">
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
                    alt={lang === "EN" ? "Kartel family coat of arms — Virtus et Potestas" : "Герб семьи Картель — Virtus et Potestas"}
                    width={540}
                    height={540}
                    priority
                    speed={0.06}
                    sizes="(max-width: 640px) 280px, (max-width: 1024px) 380px, 540px"
                    className="w-full max-w-[280px] object-contain sm:max-w-[380px] lg:max-w-[540px]"
                  />
                </button>
              </div>
            </FadeInSection>

            <FadeInSection>
              <div className="drop-cap max-w-[700px] text-[16px] leading-[1.75] text-[var(--text-body)] sm:text-[18px] lg:text-[22px] lg:leading-[1.65]">
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
            <FadeInSection>
              <h2 className="mb-8 font-serif text-[22px] leading-[1.2] text-[var(--accent)] sm:text-[28px] lg:mb-12 lg:text-[36px]">
                {t.meaningTitle}
              </h2>
            </FadeInSection>
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
              <FadeInSection>
                <div className="text-[16px] leading-[1.8] text-[var(--text-secondary)] sm:text-[18px] lg:text-[21px] lg:leading-[1.7]">
                  {t.leftCol.split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left lg:text-justify">{p}</p>
                  ))}
                </div>
              </FadeInSection>
              <FadeInSection>
                <div className="text-[16px] leading-[1.8] text-[var(--text-secondary)] sm:text-[18px] lg:text-[21px] lg:leading-[1.7]">
                  {t.rightCol.split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left lg:text-justify">{p}</p>
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
            <FadeInSection>
              <h2 className="mb-8 font-serif text-[22px] leading-[1.2] text-[var(--accent)] sm:text-[28px] lg:mb-12 lg:text-[36px]">
                {t.legacyTitle}
              </h2>
            </FadeInSection>
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
              <FadeInSection>
                <div className="text-[16px] leading-[1.8] text-[var(--text-secondary)] sm:text-[18px] lg:text-[21px] lg:leading-[1.7]">
                  {t.finalLeft.split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left lg:text-justify">{p}</p>
                  ))}
                </div>
              </FadeInSection>
              <FadeInSection>
                <div className="text-[16px] leading-[1.8] text-[var(--text-secondary)] sm:text-[18px] lg:text-[21px] lg:leading-[1.7]">
                  {t.finalRight.split("\n\n").map((p, idx) => (
                    <p key={idx} className="mb-5 text-left lg:text-justify">{p}</p>
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

        {/* Names */}
        <aside className="border-t border-[var(--border)]" aria-label={lang === "EN" ? "Family names" : "Имена семьи"}>
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
            <FadeInSection>
              <h3 className="mb-6 text-center font-serif text-[18px] tracking-wide text-[var(--accent)] sm:text-[20px] lg:text-[22px]">
                {t.namesTitle}
              </h3>
              <div className="grid gap-6 text-center text-[14px] leading-[1.9] text-[var(--text-secondary)] sm:text-[15px] md:grid-cols-2 lg:text-[16px]">
                <div>{t.namesRu.map((name) => (<p key={name}>{name}</p>))}</div>
                <div>{t.namesEn.map((name) => (<p key={name}>{name}</p>))}</div>
              </div>
              <p className="mt-8 text-center text-[12px] tracking-[0.08em] text-[var(--muted)] sm:text-[13px] lg:text-[14px]">
                {t.namesFooter}
              </p>
            </FadeInSection>
          </div>
        </aside>

        {/* Share */}
        <FadeInSection>
          <div className="border-t border-[var(--border)] py-8 lg:py-10">
            <ShareButtons
              url="https://kartel.org.uk"
              title={lang === "EN" ? "KARTEL — Family Coat of Arms & Legacy" : "КАРТЕЛЬ — Фамильный герб и наследие"}
              lang={lang}
            />
          </div>
        </FadeInSection>
      </main>

      <SiteFooter motto={t.footerMotto} copy={t.footerCopy} />
      <BackToTop />
      <ImageLightbox
        src="/crest.jpeg"
        webpSrc="/crest.webp"
        alt={lang === "EN" ? "Kartel family coat of arms — Virtus et Potestas" : "Герб семьи Картель — Virtus et Potestas"}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
