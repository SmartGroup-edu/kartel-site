import HomeClient from "./components/HomeClient";

export const metadata = {
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
    "герб семьи Картель",
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
      "@type": "WebSite",
      "name": "KARTEL",
      "url": "https://kartel.org.uk",
      "inLanguage": ["en", "ru"],
    },
    {
      "@type": "Organization",
      "name": "Kartel Family",
      "alternateName": "Семья Картель",
      "url": "https://kartel.org.uk",
      "description":
        "Kartel family coat of arms, family legacy, and identity based in London.",
      "areaServed": "London, United Kingdom",
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

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomeClient />
    </>
  );
}