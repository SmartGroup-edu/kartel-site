import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeClient from "../components/HomeClient";

// HOME = the Kartel coat of arms (R0 2026-11-14: "coat of arm make the main"). Public and
// indexable. NO personal data: family names, tree and chronicle stay in the gated /family area
// (app/content/family-private.ts, server-only) — this page must never import it.
// The KARTEL Core registry stays at /core and /registry, one click away in the main menu.
// /{lang}/family/crest → 308 here (next.config.ts redirects).

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

const pageMeta: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: "Kartel Coat of Arms — Virtus et Potestas",
    description:
      "The Kartel family coat of arms: griffin, crossed keys, coronet, swords, fleur-de-lis and wings, with the Latin motto Virtus et Potestas (Strength and Power).",
    keywords: ["Kartel coat of arms", "Kartel heraldry", "griffin", "Virtus et Potestas", "Kartel family crest"],
  },
  ru: {
    title: "Герб семьи Картель — Virtus et Potestas",
    description:
      "Фамильный герб Картель: грифон, скрещённые ключи, корона, мечи, лилии и крылья, латинский девиз Virtus et Potestas (Сила и Власть).",
    keywords: ["герб Картель", "геральдика Картель", "грифон", "Virtus et Potestas", "фамильный герб Картель"],
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
    // Page-level OG/Twitter replace the layout's (site default = KARTEL Core), so the home's
    // share card says "coat of arms". Image = the generated crest card (app/opengraph-image.tsx).
    openGraph: {
      type: "website",
      locale: lang === "ru" ? "ru_RU" : "en_GB",
      alternateLocale: lang === "ru" ? ["en_GB"] : ["ru_RU"],
      siteName: "KARTEL",
      title: m.title,
      description: m.description,
      url: `https://kartel.org.uk/${lang}`,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "KARTEL — Coat of Arms of the Kartel Family. Virtus et Potestas.", type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: [{ url: "/opengraph-image", alt: "KARTEL — Coat of Arms of the Kartel Family. Virtus et Potestas." }],
    },
    alternates: {
      canonical: `https://kartel.org.uk/${lang}`,
      languages: {
        en: "https://kartel.org.uk/en",
        ru: "https://kartel.org.uk/ru",
        "x-default": "https://kartel.org.uk/en",
      },
    },
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
      },
      {
        "@type": "Organization",
        "@id": "https://kartel.org.uk/#organization",
        "name": "KARTEL",
        "url": "https://kartel.org.uk",
        "logo": "https://kartel.org.uk/crest.jpeg",
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        "url": url,
        "name": pageMeta[lang].title,
        "description": pageMeta[lang].description,
        "isPartOf": { "@id": "https://kartel.org.uk/#website" },
        "inLanguage": lang,
        "primaryImageOfPage": {
          "@type": "ImageObject",
          "url": "https://kartel.org.uk/crest.jpeg",
          "width": 800,
          "height": 800,
          "caption": lang === "en" ? "Coat of Arms of the Kartel Family" : "Герб семьи Картель",
        },
        "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".motto"] },
      },
      {
        "@type": "Article",
        "headline": lang === "en" ? "The Coat of Arms of the Kartel Family" : "Фамильный герб семьи Картель",
        "description":
          lang === "en"
            ? "A detailed description of the Kartel family heraldic coat of arms: griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the Latin motto Virtus et Potestas (Strength and Power)."
            : "Подробное описание фамильного герба Картель: грифон, скрещённые ключи, корона, мечи, лилии, крылья и латинский девиз Virtus et Potestas (Сила и Власть).",
        "image": "https://kartel.org.uk/crest.jpeg",
        "url": url,
        "inLanguage": lang,
        "author": { "@type": "Organization", "name": "Kartel Family", "url": "https://kartel.org.uk" },
        "publisher": {
          "@type": "Organization",
          "name": "Kartel Family",
          "url": "https://kartel.org.uk",
          "logo": { "@type": "ImageObject", "url": "https://kartel.org.uk/crest.jpeg" },
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
        "@type": "VisualArtwork",
        "name": lang === "en" ? "Coat of Arms of the Kartel Family" : "Герб семьи Картель",
        "description":
          lang === "en"
            ? "A heraldic coat of arms featuring a griffin, crossed keys, coronet, swords, and the motto Virtus et Potestas (Strength and Power)."
            : "Геральдический герб с грифоном, скрещёнными ключами, короной, мечами и девизом Virtus et Potestas (Сила и Власть).",
        "artform": "Heraldry",
        "artMedium": "Digital illustration",
        "image": "https://kartel.org.uk/crest.jpeg",
        "creator": { "@type": "Organization", "name": "Kartel Family" },
      },
    ],
  };
}

function buildFaq(lang: Locale) {
  const en = [
    { q: "What is the Kartel coat of arms?", a: "The Kartel coat of arms is a heraldic composition created for the Kartel family, based in London. It features a griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the Latin motto 'Virtus et Potestas' (Strength and Power)." },
    { q: "What does Virtus et Potestas mean?", a: "'Virtus et Potestas' translates from Latin as 'Strength and Power.' In the Kartel family context, strength is the ability to follow one's convictions to the end, while power signifies maturity, confidence, and acknowledgment of the heights attained." },
    { q: "What does the griffin symbolize in the Kartel coat of arms?", a: "The griffin combines the lion (earthly strength) and the eagle (celestial vision), representing strength, protection, foresight, and the union of opposites. It is depicted in motion with head held high and wings spread, symbolizing perpetual readiness to act." },
    { q: "What do the crossed keys represent in the Kartel coat of arms?", a: "The crossed keys at the base of the shield symbolize knowledge, sacred mystery, and the union between reason and faith. Historically linked to the Apostle Peter, they represent the idea that every person holds the keys to their own destiny." },
    { q: "What are the heraldic colours of the Kartel coat of arms?", a: "The coat of arms uses four heraldic colours: gold/or (nobility, wisdom, enlightenment), sable/black (willpower, endurance, discipline), argent/silver (truth, virtue, sincerity), and gules/red (courage, passion, leadership, strength of spirit)." },
  ];
  const ru = [
    { q: "Что представляет собой герб семьи Картель?", a: "Герб Картель — геральдическая композиция, созданная для семьи Картель из Лондона. В ней грифон, скрещённые ключи, корона, мечи, лилии, крылья и латинский девиз «Virtus et Potestas» (Сила и Власть)." },
    { q: "Что означает Virtus et Potestas?", a: "«Virtus et Potestas» переводится с латыни как «Сила и Власть». Сила — способность идти за своими убеждениями до конца, власть — мерило зрелости, уверенности и признания достигнутых высот." },
    { q: "Что символизирует грифон в гербе Картель?", a: "Грифон объединяет льва (земная сила) и орла (небесное зрение), олицетворяя силу, защиту, дальновидность и единство противоположностей. Изображён в движении — знак постоянной готовности действовать." },
    { q: "Что означают скрещённые ключи в гербе Картель?", a: "Скрещённые ключи у основания щита символизируют знание, священную тайну и союз разума и веры. Исторически связаны с апостолом Петром: каждый владеет ключами от собственной судьбы." },
    { q: "Какие геральдические цвета у герба Картель?", a: "Четыре геральдических цвета: золото (благородство, мудрость), чёрный (воля, стойкость, дисциплина), серебро (истина, добродетель, искренность) и красный (отвага, страсть, лидерство, сила духа)." },
  ];
  const items = lang === "en" ? en : ru;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": items.map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
  };
}

export default async function HomePage({
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildStructuredData(locale)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaq(locale)) }} />
      <HomeClient lang={upperLang} />
    </>
  );
}
