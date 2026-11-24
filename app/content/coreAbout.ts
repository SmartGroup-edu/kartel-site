// Bilingual copy for /[lang]/core — the Public Trust Layer.
// Goal: a first-time visitor understands KARTEL in ~60 seconds — what it is,
// which projects exist, what CPIF is, what Canonical Geography is, why federation.

export const coreAboutContent = {
  EN: {
    motto: "Virtus et Potestas",
    copy: "KARTEL Core · public registry of the federation",
    metaTitle: "What is KARTEL Core?",
    metaDescription:
      "KARTEL Core in 60 seconds: a federation of cultural and educational platforms with one identity, one map of countries and regions and one set of rules.",
    eyebrow: "What is KARTEL?",
    title: "One ecosystem. One identity. One geography.",
    lede:
      "KARTEL Core is the authority behind a small federation of cultural and educational platforms. Instead of each platform reinventing identity, geography, and organisations, they share one canonical set — owned by Core, consumed by the platforms.",
    sections: [
      {
        h: "The projects",
        p: "MoyPolk (Immortal Regiment UK memorial), RusJAz (Russian-language education marketplace and LMS), and Community Group (cultural funding & trust). RusJAzz is planned. Each is a separate platform — federated, not merged.",
      },
      {
        h: "CPIF — one identity",
        p: "The Common Platform Identity Framework. A person is the same person on every platform — no duplicate accounts, no re-registration. Each platform stores only a reference to that person.",
      },
      {
        h: "Canonical geography — one map",
        p: "One canonical geography: countries (ISO 3166-1) and, within them, regions — ITL1, the official statistical regions, in the UK and ISO 3166-2 subdivisions elsewhere. Every platform tags its content with the same codes and consumes them from one source of truth. No platform invents its own regions.",
      },
      {
        h: "Why a federation?",
        p: "So a person, a place, and an organisation mean the same thing everywhere — once, correctly. Federation removes duplication and contradiction, keeps each platform independent, and makes a shared, trustworthy record possible. Authority stays with Core; platforms consume.",
      },
    ],
    ctaTitle: "Explore the canonical record",
    cta: [
      { label: "Registry", href: "/en/registry" },
      { label: "Layers", href: "/en/registry/layers" },
      { label: "Projects", href: "/en/registry/projects" },
    ],
  },
  RU: {
    motto: "Virtus et Potestas",
    copy: "Ядро KARTEL · публичный реестр федерации",
    metaTitle: "Что такое Ядро KARTEL?",
    metaDescription:
      "Ядро KARTEL за 60 секунд: федерация культурных и образовательных платформ с одной идентичностью, одной картой стран и регионов и едиными правилами.",
    eyebrow: "Что такое KARTEL?",
    title: "Одна экосистема. Одна идентичность. Одна география.",
    lede:
      "Ядро KARTEL — авторитет за небольшой федерацией культурных и образовательных платформ. Вместо того чтобы каждая платформа заново изобретала идентичность, географию и организации, они используют один канонический набор — которым владеет Ядро, а платформы потребляют.",
    sections: [
      {
        h: "Проекты",
        p: "MoyPolk (мемориал «Бессмертный полк UK»), RusJAz (маркетплейс русскоязычного образования и LMS) и Community Group (культурное финансирование и доверие). RusJAzz — в плане. Каждый — отдельная платформа: федерация, не слияние.",
      },
      {
        h: "CPIF — одна идентичность",
        p: "Common Platform Identity Framework. Человек остаётся тем же человеком на каждой платформе — без дублей аккаунтов и повторной регистрации. Каждая платформа хранит лишь ссылку на него.",
      },
      {
        h: "Каноническая география — одна карта",
        p: "Одна каноническая география: страны (ISO 3166-1) и регионы внутри них — в UK это ITL1, официальные статистические регионы, в других странах подразделения ISO 3166-2. Каждая платформа размечает контент одними кодами и потребляет их из единого источника истины. Никто не изобретает свои регионы.",
      },
      {
        h: "Зачем федерация?",
        p: "Чтобы человек, место и организация означали одно и то же везде — один раз и правильно. Федерация убирает дублирование и противоречия, сохраняет независимость платформ и делает возможным общий достоверный учёт. Авторитет остаётся у Ядра; платформы потребляют.",
      },
    ],
    ctaTitle: "Изучить канонический учёт",
    cta: [
      { label: "Реестр", href: "/ru/registry" },
      { label: "Слои", href: "/ru/registry/layers" },
      { label: "Проекты", href: "/ru/registry/projects" },
    ],
  },
} as const;
