import type { Metadata } from "next";
import { ogAlt, ogImagePath } from "../lib/ogCard";
import { notFound } from "next/navigation";
import HomeClient from "../components/HomeClient";
import PublicOffice from "../components/PublicOffice";

// HOME = the family-office view of mockup v5 (bus 172 P5: hero, registry counts, companies — PublicOffice, rendered
// here on the server), then the Kartel coat of arms in full (R0 2026-11-14: "coat of arm make the main"). Public and
// indexable. NO personal data: family names, tree and chronicle stay in the gated /family area
// (app/content/family-private.ts, server-only) — this page must never import it.
// The KARTEL Core registry stays at /core and /registry, one click away in the main menu.
// /{lang}/family/crest → 308 here (next.config.ts redirects).

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// bus 173: the title, the share card and the JSON-LD describe KARTEL the family office; the crest is its emblem, below.
const pageMeta: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: "KARTEL — a family office in London",
    description:
      "KARTEL is a family office in London. The federation projects the family runs — in education, culture and communities — share rules, decisions and responsibility. Its coat of arms bears the motto Virtus et Potestas (Strength and Power).",
    keywords: ["KARTEL", "Kartel family office", "family office London", "KARTEL federation", "Virtus et Potestas"],
  },
  ru: {
    title: "KARTEL — семейный офис в Лондоне",
    description:
      "KARTEL — семейный офис в Лондоне. Проекты федерации, которые ведёт семья, — в образовании, культуре и сообществах — объединены общими правилами, решениями и ответственностью. Девиз фамильного герба — Virtus et Potestas (Сила и Власть).",
    keywords: ["KARTEL", "семейный офис Картель", "семейный офис Лондон", "федерация KARTEL", "Virtus et Potestas"],
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
    // Page-level OG/Twitter replace the layout's (site default = KARTEL Core), so the home's share card names
    // the family office. Image = the generated card (app/lib/ogCard.tsx), RU on its own URL.
    openGraph: {
      type: "website",
      locale: lang === "ru" ? "ru_RU" : "en_GB",
      alternateLocale: lang === "ru" ? ["en_GB"] : ["ru_RU"],
      siteName: "KARTEL",
      title: m.title,
      description: m.description,
      url: `https://kartel.org.uk/${lang}`,
      images: [{ url: ogImagePath(lang), width: 1200, height: 630, alt: ogAlt(lang === "ru" ? "ru" : "en"), type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: [{ url: ogImagePath(lang), alt: ogAlt(lang === "ru" ? "ru" : "en") }],
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
        "description":
          lang === "en"
            ? "A family office in London. The family runs the KARTEL federation projects in education, culture and communities."
            : "Семейный офис в Лондоне. Семья ведёт проекты федерации KARTEL в образовании, культуре и сообществах.",
        "slogan": "Virtus et Potestas",
        "location": { "@type": "Place", "name": "London" },
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        "url": url,
        "name": pageMeta[lang].title,
        "description": pageMeta[lang].description,
        "isPartOf": { "@id": "https://kartel.org.uk/#website" },
        "about": { "@id": "https://kartel.org.uk/#organization" },
        "mainEntity": { "@id": "https://kartel.org.uk/#organization" },
        "inLanguage": lang,
        "primaryImageOfPage": {
          "@type": "ImageObject",
          "url": "https://kartel.org.uk/crest.jpeg",
          "width": 800,
          "height": 800,
          "caption": lang === "en" ? "The KARTEL emblem — the Kartel family coat of arms" : "Эмблема KARTEL — фамильный герб Картель",
        },
        "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2", ".motto"] },
      },
      {
        "@type": "VisualArtwork",
        "name": lang === "en" ? "Coat of Arms of the Kartel Family" : "Фамильный герб Картель",
        "description":
          lang === "en"
            ? "A heraldic coat of arms featuring a griffin, crossed keys, coronet, swords, and the motto Virtus et Potestas (Strength and Power)."
            : "Геральдический герб с грифоном, скрещёнными ключами, короной, мечами и девизом Virtus et Potestas (Сила и Власть).",
        "artform": "Heraldry",
        "artMedium": "Digital illustration",
        "image": "https://kartel.org.uk/crest.jpeg",
        "creator": { "@type": "Organization", "name": "Kartel Family" },
        "isPartOf": { "@id": `${url}#webpage` },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildStructuredData(locale)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaq(locale)) }} />
      <HomeClient lang={upperLang} office={<PublicOffice lang={upperLang} />} />
    </>
  );
}
