// Bilingual copy for /[lang]/core — the Public Trust Layer.
// Goal: a first-time visitor understands KARTEL in ~60 seconds — what it is,
// which projects exist, what CPIF is, what Canonical Geography is, why federation.

export const coreAboutContent = {
  EN: {
    nav: [
      { label: "Core", href: "/en/core", active: true },
      { label: "Registry", href: "/en/registry" },
      { label: "Projects", href: "/en/registry/projects" },
      { label: "Family Heritage", href: "/en/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Core authority surface",
    metaTitle: "What is KARTEL Core? — federation, identity, geography",
    metaDescription:
      "KARTEL Core in 60 seconds: a federation of cultural and educational platforms with one identity (CPIF), one geography (ITL1), and one governance. What it is, which projects exist, and why a federation.",
    eyebrow: "What is KARTEL?",
    title: "One ecosystem. One identity. One geography.",
    lede:
      "KARTEL Core is the authority behind a small federation of cultural and educational platforms. Instead of each platform reinventing identity, geography, and organisations, they share one canonical set — owned by Core, consumed by the platforms.",
    sections: [
      {
        h: "The projects",
        p: "MoyPolk (Immortal Regiment UK memorial), RusJAz (Russian-language education marketplace + LMS), and Community Group (cultural funding & trust). RusJAzz is planned. Each is a separate platform — federated, not merged.",
      },
      {
        h: "CPIF — one identity",
        p: "The Common Platform Identity Framework. A person logs in once through the shared identity provider and is the same subject on every platform — no duplicate accounts, no re-registration. The platform stores only a reference to that subject.",
      },
      {
        h: "Canonical Geography — one map",
        p: "One canonical UK region taxonomy (ITL1 — the official statistical regions). Every platform tags its content with the same region codes and consumes them from one source of truth. No platform invents its own regions.",
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
    nav: [
      { label: "Core", href: "/ru/core", active: true },
      { label: "Реестр", href: "/ru/registry" },
      { label: "Проекты", href: "/ru/registry/projects" },
      { label: "Семейное наследие", href: "/ru/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Слой канонической авторитетности",
    metaTitle: "Что такое KARTEL Core? — федерация, идентичность, география",
    metaDescription:
      "KARTEL Core за 60 секунд: федерация культурных и образовательных платформ с одной идентичностью (CPIF), одной географией (ITL1) и одним governance. Что это, какие проекты и зачем федерация.",
    eyebrow: "Что такое KARTEL?",
    title: "Одна экосистема. Одна идентичность. Одна география.",
    lede:
      "KARTEL Core — авторитет за небольшой федерацией культурных и образовательных платформ. Вместо того чтобы каждая платформа заново изобретала идентичность, географию и организации, они используют один канонический набор — которым владеет Core, а платформы потребляют.",
    sections: [
      {
        h: "Проекты",
        p: "MoyPolk (мемориал «Бессмертный полк UK»), RusJAz (маркетплейс русскоязычного образования + LMS) и Community Group (культурное финансирование и доверие). RusJAzz — в плане. Каждый — отдельная платформа: федерация, не слияние.",
      },
      {
        h: "CPIF — одна идентичность",
        p: "Common Platform Identity Framework. Человек входит один раз через общий провайдер идентичности и остаётся тем же субъектом на каждой платформе — без дублей аккаунтов и повторной регистрации. Платформа хранит лишь ссылку на этот субъект.",
      },
      {
        h: "Каноническая география — одна карта",
        p: "Одна каноническая таксономия регионов UK (ITL1 — официальные статистические регионы). Каждая платформа размечает контент одними кодами регионов и потребляет их из единого источника истины. Никто не изобретает свои регионы.",
      },
      {
        h: "Зачем федерация?",
        p: "Чтобы человек, место и организация означали одно и то же везде — один раз и правильно. Федерация убирает дублирование и противоречия, сохраняет независимость платформ и делает возможным общий достоверный учёт. Авторитет остаётся у Core; платформы потребляют.",
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
