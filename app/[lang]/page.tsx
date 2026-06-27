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
    title: "KARTEL Core — federation authority, registry, governance",
    description:
      "KARTEL Core is the authority surface of a federation of cultural and educational platforms (MoyPolk, RusJAz, Community Group). It owns the canonical layers — identity (CPIF), geography (ITL1), organisations, federation — which platforms consume. Official public registry and governance.",
    keywords: [
      "KARTEL", "KARTEL Core", "federation", "CPIF", "canonical geography",
      "MoyPolk", "RusJAz", "Community Group", "registry", "governance",
    ],
  },
  ru: {
    title: "Ядро KARTEL — авторитетность федерации, реестр, governance",
    description:
      "Ядро KARTEL — слой авторитетности федерации культурных и образовательных платформ (MoyPolk, RusJAz, Community Group). Владеет каноническими слоями — идентичность (CPIF), география (ITL1), организации, федерация — которые потребляют платформы. Официальный публичный реестр и governance.",
    keywords: [
      "KARTEL", "Ядро KARTEL", "KARTEL Core", "федерация", "CPIF", "каноническая география",
      "MoyPolk", "RusJAz", "Community Group", "реестр", "governance",
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
            ? "Authority surface of a federation of cultural and educational platforms."
            : "Слой авторитетности федерации культурных и образовательных платформ.",
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
