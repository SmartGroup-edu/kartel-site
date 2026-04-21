import FamilyClient from "../components/FamilyClient";

export const metadata = {
  title: "Kartel Family Members — London",
  description:
    "Members of the Kartel family including Igor Gor Kartel, Diana Kartel, Dominika Kartel, Arina Kartel, Igor Kaid Kartel, Feliks Kartel, Piotr Kartel, Valentina Kartel.",
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
    "семья Картель",
    "Игорь Гор Картель",
    "Диана Картель",
    "Доминика Картель",
    "Арина Картель",
    "Игорь Каид Картель",
    "Феликс Картель",
    "Петр Картель",
    "Валентина Картель",
  ],
  alternates: {
    canonical: "/family",
    languages: {
      "en": "https://kartel.org.uk/family?lang=EN",
      "ru": "https://kartel.org.uk/family?lang=RU",
      "x-default": "https://kartel.org.uk/family",
    },
  },
  openGraph: {
    type: "website" as const,
    locale: "en_GB",
    alternateLocale: "ru_RU",
    siteName: "KARTEL",
    title: "Kartel Family Members — London",
    description:
      "Members of the Kartel family. A living line of continuity joined by name, memory, and legacy.",
    url: "https://kartel.org.uk/family",
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
    card: "summary_large_image" as const,
    title: "Kartel Family Members — London",
    description:
      "Members of the Kartel family. A living line of continuity joined by name, memory, and legacy.",
    images: [
      {
        url: "/opengraph-image",
        alt: "KARTEL — Coat of Arms of the Kartel Family",
      },
    ],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://kartel.org.uk",
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Family",
          "item": "https://kartel.org.uk/family",
        },
      ],
    },
    {
      "@type": "CollectionPage",
      "@id": "https://kartel.org.uk/family#page",
      "name": "Kartel Family Members",
      "alternateName": "Члены семьи Картель",
      "description": "Members of the Kartel family spanning three generations, based in London. A living line of continuity joined by name, memory, and legacy.",
      "url": "https://kartel.org.uk/family",
      "inLanguage": ["en", "ru"],
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
      "description": "Family representative in London. Present generation of the Kartel family.",
      "url": "https://kartel.org.uk/family",
      "memberOf": { "@id": "https://kartel.org.uk/#organization" },
    },
    {
      "@type": "Person",
      "name": "Diana Kartel",
      "alternateName": "Диана Картель",
      "description": "Present generation of the Kartel family.",
      "memberOf": { "@id": "https://kartel.org.uk/#organization" },
    },
    {
      "@type": "Person",
      "name": "Dominika Kartel",
      "alternateName": "Доминика Картель",
      "description": "Next generation of the Kartel family.",
      "memberOf": { "@id": "https://kartel.org.uk/#organization" },
    },
    {
      "@type": "Person",
      "name": "Arina Kartel",
      "alternateName": "Арина Картель",
      "description": "Next generation of the Kartel family.",
      "memberOf": { "@id": "https://kartel.org.uk/#organization" },
    },
    {
      "@type": "Person",
      "name": "Igor Kaid Kartel",
      "alternateName": "Игорь Каид Картель",
      "description": "Next generation of the Kartel family.",
      "memberOf": { "@id": "https://kartel.org.uk/#organization" },
    },
    {
      "@type": "Person",
      "name": "Feliks Kartel",
      "alternateName": "Феликс Картель",
      "description": "Next generation of the Kartel family.",
      "memberOf": { "@id": "https://kartel.org.uk/#organization" },
    },
    {
      "@type": "Person",
      "name": "Piotr Kartel",
      "alternateName": "Петр Картель",
      "description": "Elder generation of the Kartel family.",
      "memberOf": { "@id": "https://kartel.org.uk/#organization" },
    },
    {
      "@type": "Person",
      "name": "Valentina Kartel",
      "alternateName": "Валентина Картель",
      "description": "Elder generation of the Kartel family.",
      "memberOf": { "@id": "https://kartel.org.uk/#organization" },
    },
    {
      "@type": "ItemList",
      "@id": "https://kartel.org.uk/family#chronicle",
      "name": "Kartel Family Chronicle",
      "alternateName": "Семейная хроника Картель",
      "description": "Key milestones in the history of the Kartel family.",
      "numberOfItems": 6,
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "The Kartel Name", "description": "The family name Kartel carries an echo of strength and unity — the foundation of identity across generations." },
        { "@type": "ListItem", "position": 2, "name": "Piotr & Valentina Kartel", "description": "The elder generation laid the foundation of values, discipline, and faith." },
        { "@type": "ListItem", "position": 3, "name": "A New Chapter in London", "description": "The family established its presence in London, bringing heritage and ambition to a new horizon." },
        { "@type": "ListItem", "position": 4, "name": "Igor Gor & Diana Kartel", "description": "The present generation carries forward the family name with purpose." },
        { "@type": "ListItem", "position": 5, "name": "Dominika, Arina, Igor Kaid & Feliks", "description": "The next generation — the living continuation of the Kartel legacy." },
        { "@type": "ListItem", "position": 6, "name": "Virtus et Potestas", "description": "The creation of the family coat of arms — a heraldic symbol uniting all generations." },
      ],
    },
  ],
};

export default function FamilyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <FamilyClient />
    </>
  );
}