import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoreClient from "../components/CoreClient";

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

const pageMeta: Record<Locale, { title: string; description: string; keywords: string[] }> = {
  en: {
    title: "KARTEL Core — public registry of the KARTEL federation",
    description:
      "The public registry of the KARTEL federation: one identity, one map of UK regions and one organisation model, shared by MoyPolk, RusJAz and Community Group.",
    keywords: [
      "KARTEL", "KARTEL Core", "federation", "CPIF", "canonical geography",
      "MoyPolk", "RusJAz", "Community Group", "registry", "governance",
    ],
  },
  ru: {
    title: "Ядро KARTEL — публичный реестр федерации KARTEL",
    description:
      "Публичный реестр федерации KARTEL: единая идентичность, единая карта регионов UK и единая модель организаций для MoyPolk, RusJAz и Community Group.",
    keywords: [
      "KARTEL", "Ядро KARTEL", "KARTEL Core", "федерация", "CPIF", "каноническая география",
      "MoyPolk", "RusJAz", "Community Group", "реестр", "управление",
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
    alternates: {
      canonical: `https://kartel.org.uk/${lang}`,
      languages: { en: "https://kartel.org.uk/en", ru: "https://kartel.org.uk/ru", "x-default": "https://kartel.org.uk/en" },
    },
  };
}

function structuredData(lang: Locale) {
  const url = `https://kartel.org.uk/${lang}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://kartel.org.uk/#website",
        "name": "KARTEL Core",
        "url": "https://kartel.org.uk",
        "inLanguage": ["en", "ru"],
      },
      {
        "@type": "Organization",
        "@id": "https://kartel.org.uk/#organization",
        "name": "KARTEL",
        "url": "https://kartel.org.uk",
        "description":
          lang === "en"
            ? "Public registry of a federation of cultural and educational platforms."
            : "Публичный реестр федерации культурных и образовательных платформ.",
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        "url": url,
        "name": pageMeta[lang].title,
        "description": pageMeta[lang].description,
        "isPartOf": { "@id": "https://kartel.org.uk/#website" },
        "inLanguage": lang,
      },
    ],
  };
}

export default async function CorePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(lang as Locale)) }}
      />
      <CoreClient lang={lang.toUpperCase() as "EN" | "RU"} />
    </>
  );
}
