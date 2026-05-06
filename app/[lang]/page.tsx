import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeClient from "../components/HomeClient";

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

const pageMeta: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: "Kartel Family — Coat of Arms, Legacy, London",
    description:
      "Kartel family coat of arms, family legacy, and identity based in London. Includes Igor Gor Kartel, Diana Kartel, Dominika Kartel, Arina Kartel, Igor Kaid Kartel, Feliks Kartel, Piotr Kartel, Valentina Kartel.",
    keywords: [
      "Kartel family",
      "Igor Gor Kartel",
      "Diana Kartel",
      "Dominika Kartel",
      "Arina Kartel",
      "Igor Kaid Kartel",
      "Feliks Kartel",
      "Piotr Kartel",
      "Valentina Kartel",
      "Kartel coat of arms",
      "Kartel London",
    ],
  },
  ru: {
    title: "Семья Картель — герб, наследие, Лондон",
    description:
      "Фамильный герб семьи Картель, наследие и идентичность. Базируется в Лондоне. Игорь Гор Картель, Диана Картель, Доминика Картель, Арина Картель, Игорь Каид Картель, Феликс Картель, Пётр Картель, Валентина Картель.",
    keywords: [
      "семья Картель",
      "Игорь Гор Картель",
      "Диана Картель",
      "Доминика Картель",
      "Арина Картель",
      "Игорь Каид Картель",
      "Феликс Картель",
      "Петр Картель",
      "Валентина Картель",
      "герб семьи Картель",
      "Картель Лондон",
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  const m = pageMeta[lang as Locale];
  return {
    title: m.title,
    description: m.description,
    keywords: m.keywords,
  };
}

function buildStructuredData(lang: Locale) {
  const url = `https://kartel.org.uk/${lang}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://kartel.org.uk/#website",
        "name": "KARTEL",
        "url": "https://kartel.org.uk",
        "inLanguage": ["en", "ru"],
        "potentialAction": {
          "@type": "ReadAction",
          "target": "https://kartel.org.uk",
        },
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        "url": url,
        "name": pageMeta[lang].title,
        "description":
          lang === "en"
            ? "The Kartel family coat of arms, family legacy, and identity. Heraldic composition featuring a griffin, crossed keys, coronet, swords, and the motto Virtus et Potestas."
            : "Фамильный герб семьи Картель, наследие и идентичность. Геральдическая композиция: грифон, скрещённые ключи, корона, мечи и девиз Virtus et Potestas.",
        "isPartOf": { "@id": "https://kartel.org.uk/#website" },
        "inLanguage": lang,
        "primaryImageOfPage": {
          "@type": "ImageObject",
          "url": "https://kartel.org.uk/crest.jpeg",
          "width": 800,
          "height": 800,
          "caption":
            lang === "en"
              ? "Coat of Arms of the Kartel Family"
              : "Герб семьи Картель",
        },
        "speakable": {
          "@type": "SpeakableSpecification",
          "cssSelector": ["h1", "h2", ".motto"],
        },
      },
      {
        "@type": "Article",
        "headline":
          lang === "en"
            ? "The Coat of Arms of the Kartel Family"
            : "Фамильный герб семьи Картель",
        "alternativeHeadline":
          lang === "en"
            ? "Фамильный герб семьи Картель"
            : "The Coat of Arms of the Kartel Family",
        "description":
          lang === "en"
            ? "A detailed description of the Kartel family heraldic coat of arms: griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the Latin motto Virtus et Potestas (Strength and Power)."
            : "Подробное описание фамильного герба Картель: грифон, скрещённые ключи, корона, мечи, лилии, крылья и латинский девиз Virtus et Potestas (Сила и Власть).",
        "image": "https://kartel.org.uk/crest.jpeg",
        "url": url,
        "inLanguage": lang,
        "author": {
          "@type": "Organization",
          "name": "Kartel Family",
          "url": "https://kartel.org.uk",
        },
        "publisher": {
          "@type": "Organization",
          "name": "Kartel Family",
          "url": "https://kartel.org.uk",
          "logo": {
            "@type": "ImageObject",
            "url": "https://kartel.org.uk/crest.jpeg",
          },
        },
        "datePublished": "2025-01-01",
        "dateModified": "2026-04-20",
        "mainEntityOfPage": { "@id": `${url}#webpage` },
        "about": [
          { "@type": "Thing", "name": "Heraldry" },
          { "@type": "Thing", "name": "Coat of Arms" },
          { "@type": "Thing", "name": "Kartel Family Heritage" },
        ],
        "keywords": pageMeta[lang].keywords.join(", "),
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": lang === "en" ? "Home" : "Главная",
            "item": url,
          },
        ],
      },
      {
        "@type": "VisualArtwork",
        "name":
          lang === "en"
            ? "Coat of Arms of the Kartel Family"
            : "Герб семьи Картель",
        "alternateName":
          lang === "en"
            ? "Фамильный герб семьи Картель"
            : "Coat of Arms of the Kartel Family",
        "description":
          lang === "en"
            ? "A heraldic coat of arms featuring a griffin, crossed keys, coronet, swords, and the motto Virtus et Potestas (Strength and Power)."
            : "Геральдический герб с грифоном, скрещёнными ключами, короной, мечами и девизом Virtus et Potestas (Сила и Власть).",
        "artform": "Heraldry",
        "artMedium": "Digital illustration",
        "image": "https://kartel.org.uk/crest.jpeg",
        "creator": {
          "@type": "Organization",
          "name": "Kartel Family",
        },
        "about": {
          "@type": "Thing",
          "name": "Kartel Family Heritage",
          "description":
            "Family coat of arms symbolising dignity, inner strength, and respect — Virtus et Potestas.",
        },
      },
      {
        "@type": "Organization",
        "@id": "https://kartel.org.uk/#organization",
        "name": "Kartel Family",
        "alternateName": "Семья Картель",
        "url": "https://kartel.org.uk",
        "logo": "https://kartel.org.uk/crest.jpeg",
        "description":
          lang === "en"
            ? "Kartel family coat of arms, family legacy, and identity based in London."
            : "Фамильный герб семьи Картель, наследие и идентичность. Базируется в Лондоне.",
        "areaServed": "London, United Kingdom",
        "contactPoint": {
          "@type": "ContactPoint",
          "email": "gor@kartel.org.uk",
          "contactType": "general",
        },
        "sameAs": ["https://kartel.org.uk"],
        "member": [
          { "@type": "Person", "name": "Igor Gor Kartel" },
          { "@type": "Person", "name": "Diana Kartel" },
          { "@type": "Person", "name": "Dominika Kartel" },
          { "@type": "Person", "name": "Arina Kartel" },
          { "@type": "Person", "name": "Igor Kaid Kartel" },
          { "@type": "Person", "name": "Feliks Kartel" },
          { "@type": "Person", "name": "Piotr Kartel" },
          { "@type": "Person", "name": "Valentina Kartel" },
          { "@type": "Person", "name": "Игорь Гор Картель" },
          { "@type": "Person", "name": "Диана Картель" },
          { "@type": "Person", "name": "Доминика Картель" },
          { "@type": "Person", "name": "Арина Картель" },
          { "@type": "Person", "name": "Игорь Каид Картель" },
          { "@type": "Person", "name": "Феликс Картель" },
          { "@type": "Person", "name": "Петр Картель" },
          { "@type": "Person", "name": "Валентина Картель" },
        ],
      },
    ],
  };
}

function buildSiteNav(lang: Locale) {
  const base = `https://kartel.org.uk/${lang}`;
  return {
    "@context": "https://schema.org",
    "@type": "SiteNavigationElement",
    "name": "Main Navigation",
    "url": base,
    "hasPart": [
      { "@type": "SiteNavigationElement", "name": lang === "en" ? "Home" : "Главная", "url": base },
      { "@type": "SiteNavigationElement", "name": lang === "en" ? "Meaning" : "Смысл", "url": `${base}#meaning` },
      { "@type": "SiteNavigationElement", "name": lang === "en" ? "Legacy" : "Наследие", "url": `${base}#legacy` },
      { "@type": "SiteNavigationElement", "name": lang === "en" ? "Family" : "Семья", "url": `${base}/family` },
    ],
  };
}

function buildFaq(lang: Locale) {
  const en = [
    {
      q: "What is the Kartel coat of arms?",
      a: "The Kartel coat of arms is a heraldic composition created for the Kartel family, based in London. It features a griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the Latin motto 'Virtus et Potestas' (Strength and Power).",
    },
    {
      q: "What does Virtus et Potestas mean?",
      a: "'Virtus et Potestas' translates from Latin as 'Strength and Power.' In the Kartel family context, strength is the ability to follow one's convictions to the end, while power signifies maturity, confidence, and acknowledgment of the heights attained.",
    },
    {
      q: "Who are the members of the Kartel family?",
      a: "The Kartel family includes Igor Gor Kartel (London representative), Diana Kartel, Dominika Kartel, Arina Kartel, Igor Kaid Kartel, Feliks Kartel, Piotr Kartel, and Valentina Kartel. The family spans three generations: elders, present generation, and next generation.",
    },
    {
      q: "What does the griffin symbolize in the Kartel coat of arms?",
      a: "The griffin combines the lion (earthly strength) and the eagle (celestial vision), representing superiority, protection, foresight, and the union of opposites. It is depicted in motion with head held high and wings spread, symbolizing perpetual readiness to act.",
    },
    {
      q: "What do the crossed keys represent in the Kartel coat of arms?",
      a: "The crossed keys at the base of the shield symbolize knowledge, sacred mystery, and the union between reason and faith. Historically linked to the Apostle Peter, they represent the idea that every person holds the keys to their own destiny.",
    },
    {
      q: "What are the heraldic colours of the Kartel coat of arms?",
      a: "The coat of arms uses four heraldic colours: gold/or (nobility, wisdom, enlightenment), sable/black (willpower, endurance, discipline), argent/silver (truth, virtue, sincerity), and gules/red (courage, passion, leadership, strength of spirit).",
    },
  ];
  const ru = [
    {
      q: "Что представляет собой герб семьи Картель?",
      a: "Герб Картель — геральдическая композиция, созданная для семьи Картель из Лондона. В ней грифон, скрещённые ключи, корона, мечи, лилии, крылья и латинский девиз «Virtus et Potestas» (Сила и Власть).",
    },
    {
      q: "Что означает Virtus et Potestas?",
      a: "«Virtus et Potestas» переводится с латыни как «Сила и Власть». В контексте семьи Картель сила — это способность идти за своими убеждениями до конца, а власть — мерило зрелости, уверенности и признания достигнутых высот.",
    },
    {
      q: "Кто входит в семью Картель?",
      a: "В семью Картель входят: Игорь Гор Картель (представитель в Лондоне), Диана Картель, Доминика Картель, Арина Картель, Игорь Каид Картель, Феликс Картель, Пётр Картель и Валентина Картель. Семья охватывает три поколения.",
    },
    {
      q: "Что символизирует грифон в гербе Картель?",
      a: "Грифон объединяет льва (земная сила) и орла (небесное зрение), олицетворяя превосходство, защиту, дальновидность и единство противоположностей. Он изображён в движении, с поднятой головой и расправленными крыльями — знак постоянной готовности действовать.",
    },
    {
      q: "Что означают скрещённые ключи в гербе Картель?",
      a: "Скрещённые ключи у основания щита символизируют знание, священную тайну и союз разума и веры. Исторически связаны с апостолом Петром и напоминают: каждый владеет ключами от собственной судьбы.",
    },
    {
      q: "Какие геральдические цвета у герба Картель?",
      a: "В гербе используются четыре геральдических цвета: золото (благородство, мудрость, просвещённость), чёрный (воля, стойкость, дисциплина), серебро (истина, добродетель, искренность) и красный (отвага, страсть, лидерство, сила духа).",
    },
  ];
  const items = lang === "en" ? en : ru;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": items.map(({ q, a }) => ({
      "@type": "Question",
      "name": q,
      "acceptedAnswer": { "@type": "Answer", "text": a },
    })),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  const locale = lang as Locale;
  const upperLang: "EN" | "RU" = locale === "en" ? "EN" : "RU";

  return (
    <>
      <link rel="preload" as="image" href="/crest.webp" type="image/webp" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildStructuredData(locale)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSiteNav(locale)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaq(locale)) }}
      />
      <HomeClient lang={upperLang} />
    </>
  );
}
