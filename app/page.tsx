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
      "@id": "https://kartel.org.uk/#webpage",
      "url": "https://kartel.org.uk",
      "name": "Kartel Family — Coat of Arms, Legacy, London",
      "description": "The Kartel family coat of arms, family legacy, and identity. Heraldic composition featuring a griffin, crossed keys, coronet, swords, and the motto Virtus et Potestas.",
      "isPartOf": { "@id": "https://kartel.org.uk/#website" },
      "inLanguage": ["en", "ru"],
      "primaryImageOfPage": {
        "@type": "ImageObject",
        "url": "https://kartel.org.uk/crest.jpeg",
        "width": 800,
        "height": 800,
        "caption": "Coat of Arms of the Kartel Family",
      },
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", "h2", ".motto"],
      },
    },
    {
      "@type": "Article",
      "headline": "The Coat of Arms of the Kartel Family",
      "alternativeHeadline": "Фамильный герб семьи Картель",
      "description": "A detailed description of the Kartel family heraldic coat of arms: griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the Latin motto Virtus et Potestas (Strength and Power).",
      "image": "https://kartel.org.uk/crest.jpeg",
      "url": "https://kartel.org.uk",
      "inLanguage": "en",
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
      "mainEntityOfPage": { "@id": "https://kartel.org.uk/#webpage" },
      "about": [
        { "@type": "Thing", "name": "Heraldry" },
        { "@type": "Thing", "name": "Coat of Arms" },
        { "@type": "Thing", "name": "Kartel Family Heritage" },
      ],
      "keywords": "Kartel, coat of arms, heraldry, griffin, Virtus et Potestas, family legacy, London",
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://kartel.org.uk",
        },
      ],
    },
    {
      "@type": "VisualArtwork",
      "name": "Coat of Arms of the Kartel Family",
      "alternateName": "Фамильный герб семьи Картель",
      "description": "A heraldic coat of arms featuring a griffin, crossed keys, coronet, swords, and the motto Virtus et Potestas (Strength and Power).",
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
        "description": "Family coat of arms symbolising dignity, inner strength, and respect — Virtus et Potestas.",
      },
    },
    {
      "@type": "Organization",
      "name": "Kartel Family",
      "alternateName": "Семья Картель",
      "url": "https://kartel.org.uk",
      "logo": "https://kartel.org.uk/crest.jpeg",
      "description":
        "Kartel family coat of arms, family legacy, and identity based in London.",
      "areaServed": "London, United Kingdom",
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "gor@kartel.org.uk",
        "contactType": "general",
      },
      "sameAs": [
        "https://kartel.org.uk",
      ],
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

const faqData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the Kartel coat of arms?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The Kartel coat of arms is a heraldic composition created for the Kartel family, based in London. It features a griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the Latin motto 'Virtus et Potestas' (Strength and Power).",
      },
    },
    {
      "@type": "Question",
      "name": "What does Virtus et Potestas mean?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "'Virtus et Potestas' translates from Latin as 'Strength and Power.' In the Kartel family context, strength is the ability to follow one's convictions to the end, while power signifies maturity, confidence, and acknowledgment of the heights attained.",
      },
    },
    {
      "@type": "Question",
      "name": "Who are the members of the Kartel family?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The Kartel family includes Igor Gor Kartel (London representative), Diana Kartel, Dominika Kartel, Arina Kartel, Igor Kaid Kartel, Feliks Kartel, Piotr Kartel, and Valentina Kartel. The family spans three generations: elders, present generation, and next generation.",
      },
    },
    {
      "@type": "Question",
      "name": "What does the griffin symbolize in the Kartel coat of arms?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The griffin combines the lion (earthly strength) and the eagle (celestial vision), representing superiority, protection, foresight, and the union of opposites. It is depicted in motion with head held high and wings spread, symbolizing perpetual readiness to act.",
      },
    },
    {
      "@type": "Question",
      "name": "What do the crossed keys represent in the Kartel coat of arms?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The crossed keys at the base of the shield symbolize knowledge, sacred mystery, and the union between reason and faith. Historically linked to the Apostle Peter, they represent the idea that every person holds the keys to their own destiny.",
      },
    },
    {
      "@type": "Question",
      "name": "What are the heraldic colours of the Kartel coat of arms?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The coat of arms uses four heraldic colours: gold/or (nobility, wisdom, enlightenment), sable/black (willpower, endurance, discipline), argent/silver (truth, virtue, sincerity), and gules/red (courage, passion, leadership, strength of spirit).",
      },
    },
  ],
};

export default function Page() {
  return (
    <>
      {/* Preload hero image for faster LCP */}
      <link rel="preload" as="image" href="/crest.webp" type="image/webp" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <HomeClient />
    </>
  );
}