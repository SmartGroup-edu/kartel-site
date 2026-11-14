// KARTEL Core — home content. Bilingual (EN/RU).
// Block order (R0): Hero · KARTEL Core · Four Canonical Layers · Ecosystem
// Projects. (Registry Access block removed 2026-11-14 — it duplicated the header menu.) Project data is read from
// registry.public.json; this module holds the institutional copy only.

export const coreContent = {
  EN: {
    motto: "Virtus et Potestas",
    copy: "KARTEL Core · public registry of the federation",
    eyebrow: "KARTEL Core",
    heroTitle: "The public registry of the KARTEL federation",
    heroLede:
      "Cultural and educational platforms share one identity, one map of UK regions and one organisation model. KARTEL Core keeps those shared layers and the rules every platform follows — this site is their public record.",
    layersTitle: "Four canonical layers",
    layersLede: "One identity. One geography. One organisation model. One federation.",
    layers: [
      { code: "Identity", sub: "CPIF", desc: "One person, one identity across every platform (CPIF).", status: "live" },
      { code: "Geography", sub: "ITL1", desc: "One canonical UK region taxonomy (ITL1). Platforms consume; they never self-author regions.", status: "live" },
      { code: "Organisations", sub: "Anchor", desc: "One canonical organisation hierarchy: CEA → Foundation → School → Venue.", status: "pending" },
      { code: "Federation", sub: "Gate", desc: "Eight integration requirements every project passes before production.", status: "active" },
    ],
    projectsTitle: "Ecosystem projects",
    projectsLede: "Each platform consumes or stewards the canonical layers.",
    ctaPrimary: { label: "Open the registry", href: "/en/registry" },
    ctaSecondary: { label: "What is KARTEL Core?", href: "/en/core" },
    familyTitle: "Family Heritage",
    familyLede: "Historical and family heritage of the Kartel family — a separate area, kept distinct from the institutional surface.",
    familyButton: "Explore Family Heritage",
    statusLabels: { live: "live", pending: "pending", active: "active", planned: "planned" },
  },
  RU: {
    motto: "Virtus et Potestas",
    copy: "Ядро KARTEL · публичный реестр федерации",
    eyebrow: "Ядро KARTEL",
    heroTitle: "Публичный реестр федерации KARTEL",
    heroLede:
      "Культурные и образовательные платформы пользуются единой идентичностью, единой картой регионов UK и единой моделью организаций. Ядро KARTEL хранит эти общие слои и правила для всех платформ — здесь их публичная запись.",
    layersTitle: "Четыре канонических слоя",
    layersLede: "Одна идентичность. Одна география. Одна модель организаций. Одна федерация.",
    layers: [
      { code: "Идентичность", sub: "CPIF", desc: "Один человек — одна идентичность на всех платформах (CPIF).", status: "live" },
      { code: "География", sub: "ITL1", desc: "Одна каноническая таксономия регионов UK (ITL1). Платформы потребляют, не создают регионы сами.", status: "live" },
      { code: "Организации", sub: "Anchor", desc: "Одна каноническая иерархия организаций: CEA → фонд → школа → площадка.", status: "pending" },
      { code: "Федерация", sub: "Gate", desc: "Восемь требований интеграции, которые проходит каждый проект до запуска.", status: "active" },
    ],
    projectsTitle: "Проекты экосистемы",
    projectsLede: "Каждая платформа потребляет или обслуживает канонические слои.",
    ctaPrimary: { label: "Открыть реестр", href: "/ru/registry" },
    ctaSecondary: { label: "Что такое Ядро KARTEL?", href: "/ru/core" },
    familyTitle: "Семейное наследие",
    familyLede: "Историческое и семейное наследие семьи Картель — отдельный раздел, не смешиваемый с институциональной поверхностью.",
    familyButton: "Открыть семейное наследие",
    statusLabels: { live: "активно", pending: "ожидается", active: "активно", planned: "план" },
  },
} as const;
