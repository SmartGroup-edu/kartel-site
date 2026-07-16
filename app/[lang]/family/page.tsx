import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import FamilyClient from "../../components/FamilyClient";
import { familyEnv } from "@/app/lib/family-env";
import { familyGateDecision } from "@/app/lib/family-gate";

// Gated area: must render per-request (auth), never statically prerender.
export const dynamic = "force-dynamic";

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

const pageMeta: Record<Locale, { title: string; description: string; ogDescription: string; keywords: string[] }> = {
  en: {
    title: "Kartel Family Members — London",
    description:
      "Members of the Kartel family including Igor Gor Kartel, Diana Kartel, Dominika Kartel, Arina Kartel, Igor Kaid Kartel, Feliks Kartel, Piotr Kartel, Valentina Kartel.",
    ogDescription:
      "Members of the Kartel family. A living line of continuity joined by name, memory, and legacy.",
    keywords: [
      "Kartel family",
      "Kartel family London",
      "Igor Gor Kartel",
      "Diana Kartel",
      "Dominika Kartel",
      "Arina Kartel",
      "Igor Kaid Kartel",
      "Feliks Kartel",
      "Piotr Kartel",
      "Valentina Kartel",
    ],
  },
  ru: {
    title: "Члены семьи Картель — Лондон",
    description:
      "Члены семьи Картель: Игорь Гор Картель, Диана Картель, Доминика Картель, Арина Картель, Игорь Каид Картель, Феликс Картель, Пётр Картель, Валентина Картель.",
    ogDescription:
      "Члены семьи Картель. Живая нить преемственности, связанная именем, памятью и наследием.",
    keywords: [
      "семья Картель",
      "семья Картель Лондон",
      "Игорь Гор Картель",
      "Диана Картель",
      "Доминика Картель",
      "Арина Картель",
      "Игорь Каид Картель",
      "Феликс Картель",
      "Петр Картель",
      "Валентина Картель",
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
  const url = `https://kartel.org.uk/${lang}/family`;
  return {
    title: m.title,
    description: m.description,
    keywords: m.keywords,
    alternates: {
      canonical: `/${lang}/family`,
      languages: {
        en: "https://kartel.org.uk/en/family",
        ru: "https://kartel.org.uk/ru/family",
        "x-default": "https://kartel.org.uk/en/family",
      },
    },
    openGraph: {
      type: "website",
      locale: lang === "en" ? "en_GB" : "ru_RU",
      alternateLocale: lang === "en" ? "ru_RU" : "en_GB",
      siteName: "KARTEL",
      title: m.title,
      description: m.ogDescription,
      url,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "KARTEL — Coat of Arms of the Kartel Family. Virtus et Potestas.",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.ogDescription,
      images: [
        {
          url: "/opengraph-image",
          alt: "KARTEL — Coat of Arms of the Kartel Family",
        },
      ],
    },
  };
}

function buildStructuredData(lang: Locale) {
  const url = `https://kartel.org.uk/${lang}/family`;
  const home = `https://kartel.org.uk/${lang}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": lang === "en" ? "Home" : "Главная",
            "item": home,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": lang === "en" ? "Family" : "Семья",
            "item": url,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        "name": pageMeta[lang].title,
        "alternateName":
          lang === "en" ? "Члены семьи Картель" : "Kartel Family Members",
        "description":
          lang === "en"
            ? "Members of the Kartel family spanning three generations, based in London. A living line of continuity joined by name, memory, and legacy."
            : "Члены семьи Картель, охватывающие три поколения, проживающие в Лондоне. Живая нить преемственности, связанная именем, памятью и наследием.",
        "url": url,
        "inLanguage": lang,
        "isPartOf": { "@id": "https://kartel.org.uk/#website" },
        "mainEntity": {
          "@type": "ItemList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Piotr Kartel" },
            { "@type": "ListItem", "position": 2, "name": "Valentina Kartel" },
            { "@type": "ListItem", "position": 3, "name": "Igor Gor Kartel" },
            { "@type": "ListItem", "position": 4, "name": "Diana Kartel" },
            { "@type": "ListItem", "position": 5, "name": "Dominika Kartel" },
            { "@type": "ListItem", "position": 6, "name": "Arina Kartel" },
            { "@type": "ListItem", "position": 7, "name": "Igor Kaid Kartel" },
            { "@type": "ListItem", "position": 8, "name": "Feliks Kartel" },
          ],
        },
      },
      {
        "@type": "Person",
        "name": "Igor Gor Kartel",
        "alternateName": "Игорь Гор Картель",
        "description":
          lang === "en"
            ? "Family representative in London. Present generation of the Kartel family."
            : "Представитель семьи в Лондоне. Настоящее поколение семьи Картель.",
        "url": url,
        "memberOf": { "@id": "https://kartel.org.uk/#organization" },
      },
      {
        "@type": "Person",
        "name": "Diana Kartel",
        "alternateName": "Диана Картель",
        "description":
          lang === "en"
            ? "Present generation of the Kartel family."
            : "Настоящее поколение семьи Картель.",
        "memberOf": { "@id": "https://kartel.org.uk/#organization" },
      },
      {
        "@type": "Person",
        "name": "Dominika Kartel",
        "alternateName": "Доминика Картель",
        "description":
          lang === "en"
            ? "Next generation of the Kartel family."
            : "Следующее поколение семьи Картель.",
        "memberOf": { "@id": "https://kartel.org.uk/#organization" },
      },
      {
        "@type": "Person",
        "name": "Arina Kartel",
        "alternateName": "Арина Картель",
        "description":
          lang === "en"
            ? "Next generation of the Kartel family."
            : "Следующее поколение семьи Картель.",
        "memberOf": { "@id": "https://kartel.org.uk/#organization" },
      },
      {
        "@type": "Person",
        "name": "Igor Kaid Kartel",
        "alternateName": "Игорь Каид Картель",
        "description":
          lang === "en"
            ? "Next generation of the Kartel family."
            : "Следующее поколение семьи Картель.",
        "memberOf": { "@id": "https://kartel.org.uk/#organization" },
      },
      {
        "@type": "Person",
        "name": "Feliks Kartel",
        "alternateName": "Феликс Картель",
        "description":
          lang === "en"
            ? "Next generation of the Kartel family."
            : "Следующее поколение семьи Картель.",
        "memberOf": { "@id": "https://kartel.org.uk/#organization" },
      },
      {
        "@type": "Person",
        "name": "Piotr Kartel",
        "alternateName": "Петр Картель",
        "birthDate": "1955-02-08",
        "deathDate": "2026-01-03",
        "birthPlace": {
          "@type": "Place",
          "name": lang === "en" ? "Belarus" : "Беларусь",
        },
        "description":
          lang === "en"
            ? "Elder generation of the Kartel family. 1955–2026. In memoriam."
            : "Старшее поколение семьи Картель. 1955–2026. Светлая память.",
        "memberOf": { "@id": "https://kartel.org.uk/#organization" },
      },
      {
        "@type": "Person",
        "name": "Valentina Kartel",
        "alternateName": "Валентина Картель",
        "description":
          lang === "en"
            ? "Elder generation of the Kartel family."
            : "Старшее поколение семьи Картель.",
        "memberOf": { "@id": "https://kartel.org.uk/#organization" },
      },
    ],
  };
}

export default async function FamilyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  const locale = lang as Locale;

  // FAMILY-GATE page guard (fail-closed). The edge proxy only checks the FAMILY_GATE flag and
  // lets /family through when it is "on"; THIS is where access is actually enforced. When the
  // gate is off the proxy hard-redirects to home and this never runs.
  if (familyEnv.gateOn()) {
    const { decision } = await familyGateDecision();
    if (decision === "login")
      redirect(`/api/family-auth/login?returnTo=${encodeURIComponent(`/${lang}/family`)}`);
    if (decision === "pending") redirect(`/${lang}/family/pending`);
  }

  const upperLang: "EN" | "RU" = locale === "en" ? "EN" : "RU";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildStructuredData(locale)) }}
      />
      <FamilyClient lang={upperLang} />
    </>
  );
}
