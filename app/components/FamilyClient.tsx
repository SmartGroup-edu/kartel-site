"use client";

import { useLang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import HeraldicDivider from "./HeraldicDivider";
import BackToTop from "./BackToTop";
import SkipToContent from "./SkipToContent";

type Generation = "elder" | "current" | "next";

interface FamilyMember {
  name: string;
  description: string;
  generation: Generation;
}

interface GenerationGroup {
  key: Generation;
  title: string;
  members: FamilyMember[];
}

const content = {
  EN: {
    title: "The Kartel Family",
    intro:
      "The Kartel family is presented here as a living line of continuity: a family joined by name, memory, responsibility, and the conscious preservation of legacy.",
    homeLabel: "Home",
    familyLabel: "Family",
    footerMotto: "Virtus et Potestas",
    footerCopy: "The Kartel Family. London.",
    generationLabels: {
      elder: "Elders",
      current: "Present Generation",
      next: "Next Generation",
    } as Record<Generation, string>,
    people: [
      { name: "Igor Gor Kartel", description: "Family representative in London.", generation: "current" as Generation },
      { name: "Diana Kartel", description: "Member of the Kartel family.", generation: "current" as Generation },
      { name: "Dominika Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Arina Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Igor Kaid Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Feliks Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Piotr Kartel", description: "Representative of the older generation of the Kartel family.", generation: "elder" as Generation },
      { name: "Valentina Kartel", description: "Representative of the older generation of the Kartel family.", generation: "elder" as Generation },
    ],
  },
  RU: {
    title: "Семья Картель",
    intro:
      "Семья Картель — это линия преемственности, объединённая именем, памятью и наследием.",
    homeLabel: "Главная",
    familyLabel: "Семья",
    footerMotto: "Virtus et Potestas",
    footerCopy: "Семья Картель. Лондон.",
    generationLabels: {
      elder: "Старшее поколение",
      current: "Настоящее поколение",
      next: "Новое поколение",
    } as Record<Generation, string>,
    people: [
      { name: "Игорь Гор Картель", description: "Представитель семьи в Лондоне.", generation: "current" as Generation },
      { name: "Диана Картель", description: "Член семьи Картель.", generation: "current" as Generation },
      { name: "Доминика Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Арина Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Игорь Каид Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Феликс Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Петр Картель", description: "Представитель старшего поколения семьи Картель.", generation: "elder" as Generation },
      { name: "Валентина Картель", description: "Представительница старшего поколения семьи Картель.", generation: "elder" as Generation },
    ],
  },
};

function groupByGeneration(people: FamilyMember[], labels: Record<Generation, string>): GenerationGroup[] {
  const order: Generation[] = ["elder", "current", "next"];
  return order
    .map((gen) => ({
      key: gen,
      title: labels[gen],
      members: people.filter((p) => p.generation === gen),
    }))
    .filter((g) => g.members.length > 0);
}

export default function FamilyClient() {
  const { lang, toggleLang, isReady } = useLang();

  const t = content[lang];

  const navItems = [
    { label: t.homeLabel, href: `/?lang=${lang}` },
    { label: t.familyLabel, href: `/family?lang=${lang}`, active: true },
  ];

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eeebe5]">
        <span className="font-serif text-[24px] tracking-[0.12em] text-[#9b723a] sm:text-[28px]">
          KARTEL
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#eeebe5] text-[#2b2824]">
      <SkipToContent />
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={navItems} maxWidth="max-w-6xl" />

      <main id="main-content" className="mx-auto max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-20">
        {/* Hero */}
        <FadeInSection>
          <header className="border-b border-[#d7d1c7] pb-8">
            <h1 className="font-serif text-[28px] leading-[1.2] text-[#9b723a] sm:text-[36px] lg:text-[48px]">
              {t.title}
            </h1>
            <p className="mt-6 max-w-4xl text-[16px] leading-[1.8] text-[#3a3630] sm:text-[18px] lg:text-[19px]">
              {t.intro}
            </p>
          </header>
        </FadeInSection>

        {groupByGeneration(t.people, t.generationLabels).map((group) => (
          <div key={group.key}>
            <HeraldicDivider />

            <section className="py-8 lg:py-12" aria-label={group.title}>
              <FadeInSection>
                <h2 className="mb-6 font-serif text-[18px] tracking-wide text-[#9b723a] sm:text-[20px] lg:mb-8 lg:text-[22px]">
                  {group.title}
                </h2>
              </FadeInSection>

              <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
                {group.members.map((p) => (
                  <FadeInSection key={p.name}>
                    <article
                      className="group h-full border border-[#d7d1c7] bg-[#f4f1eb] p-5 transition-all duration-200 hover:border-[#c4b89a] hover:shadow-md sm:p-6"
                      itemScope
                      itemType="https://schema.org/Person"
                    >
                      <h3
                        className="font-serif text-[20px] leading-[1.3] text-[#9b723a] transition-colors group-hover:text-[#85612f] sm:text-[22px] lg:text-[24px]"
                        itemProp="name"
                      >
                        {p.name}
                      </h3>
                      <p className="mt-3 text-[15px] leading-[1.8] text-[#3a3630] sm:text-[16px]" itemProp="description">
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
