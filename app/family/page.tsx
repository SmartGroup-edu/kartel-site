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
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "name": "Kartel Family Members",
      "alternateName": "Члены семьи Картель",
      "url": "https://kartel.org.uk/family",
      "isPartOf": {
        "@type": "WebSite",
        "name": "KARTEL",
        "url": "https://kartel.org.uk",
      },
    },
    {
      "@type": "Person",
      "name": "Igor Gor Kartel",
      "alternateName": "Игорь Гор Картель",
      "memberOf": {
        "@type": "Organization",
        "name": "Kartel Family",
      },
    },
    {
      "@type": "Person",
      "name": "Diana Kartel",
      "alternateName": "Диана Картель",
      "memberOf": {
        "@type": "Organization",
        "name": "Kartel Family",
      },
    },
    {
      "@type": "Person",
      "name": "Dominika Kartel",
      "alternateName": "Доминика Картель",
      "memberOf": {
        "@type": "Organization",
        "name": "Kartel Family",
      },
    },
    {
      "@type": "Person",
      "name": "Arina Kartel",
      "alternateName": "Арина Картель",
      "memberOf": {
        "@type": "Organization",
        "name": "Kartel Family",
      },
    },
    {
      "@type": "Person",
      "name": "Igor Kaid Kartel",
      "alternateName": "Игорь Каид Картель",
      "memberOf": {
        "@type": "Organization",
        "name": "Kartel Family",
      },
    },
    {
      "@type": "Person",
      "name": "Feliks Kartel",
      "alternateName": "Феликс Картель",
      "memberOf": {
        "@type": "Organization",
        "name": "Kartel Family",
      },
    },
    {
      "@type": "Person",
      "name": "Piotr Kartel",
      "alternateName": "Петр Картель",
      "description": "Representative of the older generation of the Kartel family.",
      "memberOf": {
        "@type": "Organization",
        "name": "Kartel Family",
      },
    },
    {
      "@type": "Person",
      "name": "Valentina Kartel",
      "alternateName": "Валентина Картель",
      "description": "Representative of the older generation of the Kartel family.",
      "memberOf": {
        "@type": "Organization",
        "name": "Kartel Family",
      },
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