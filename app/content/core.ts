// KARTEL Core — home (authority surface) content. Bilingual (EN/RU).
// Block order (R0): Hero · KARTEL Core · Four Canonical Layers · Ecosystem
// Projects · Registry Access. Project data is read from
// registry.public.json; this module holds the institutional copy only.

export const coreContent = {
  EN: {
    nav: [
      { label: "Registry", href: "/en/registry" },
      { label: "Layers", href: "/en/registry/layers" },
      { label: "Projects", href: "/en/registry/projects" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Core authority surface",
    eyebrow: "KARTEL Core",
    heroTitle: "The authority surface of the KARTEL ecosystem",
    heroLede:
      "KARTEL Core owns the canonical layers of a federation of cultural and educational platforms. Projects consume or steward those layers — none owns Core. This is the official public registry and governance surface, not a product.",
    layersTitle: "Four canonical layers",
    layersLede: "One identity. One geography. One organisation model. One federation.",
    layers: [
      { code: "Identity", sub: "CPIF", desc: "One federated identity across every platform — the shared Keycloak subject (cpifSubjectId).", status: "live" },
      { code: "Geography", sub: "ITL1", desc: "One canonical UK region taxonomy (ITL1). Platforms consume; they never self-author regions.", status: "live" },
      { code: "Organisations", sub: "Anchor", desc: "One canonical organisation hierarchy: CEA → Foundation → School → Venue.", status: "pending" },
      { code: "Federation", sub: "Gate", desc: "Eight integration requirements every project passes before production.", status: "active" },
    ],
    projectsTitle: "Ecosystem projects",
    projectsLede: "Each platform consumes or stewards the canonical layers.",
    registryTitle: "Registry access",
    registryLede: "The canonical record of layers, projects, ownership, and the Federation Gate.",
    registryButtons: [
      { label: "Registry", href: "/en/registry" },
      { label: "Layers", href: "/en/registry/layers" },
      { label: "Projects", href: "/en/registry/projects" },
      { label: "Core", href: "/en/core" },
    ],
    familyTitle: "Family Heritage",
    familyLede: "Historical and family heritage of the Kartel family — a separate area, kept distinct from the institutional surface.",
    familyButton: "Explore Family Heritage",
    statusLabels: { live: "live", pending: "pending", active: "active", planned: "planned" },
  },
  RU: {
    nav: [
      { label: "Реестр", href: "/ru/registry" },
      { label: "Слои", href: "/ru/registry/layers" },
      { label: "Проекты", href: "/ru/registry/projects" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Слой канонической авторитетности",
    eyebrow: "Ядро KARTEL",
    heroTitle: "Слой авторитетности экосистемы KARTEL",
    heroLede:
      "Ядро KARTEL владеет каноническими слоями федерации культурных и образовательных платформ. Проекты потребляют или обслуживают эти слои — никто не владеет Ядром. Это официальный публичный реестр и слой governance, а не продукт.",
    layersTitle: "Четыре канонических слоя",
    layersLede: "Одна идентичность. Одна география. Одна модель организаций. Одна федерация.",
    layers: [
      { code: "Идентичность", sub: "CPIF", desc: "Одна федеративная идентичность на всех платформах — общий субъект Keycloak (cpifSubjectId).", status: "live" },
      { code: "География", sub: "ITL1", desc: "Одна каноническая таксономия регионов UK (ITL1). Платформы потребляют, не создают регионы сами.", status: "live" },
      { code: "Организации", sub: "Anchor", desc: "Одна каноническая иерархия организаций: CEA → Foundation → School → Venue.", status: "pending" },
      { code: "Федерация", sub: "Gate", desc: "Восемь требований интеграции, которые проходит каждый проект до production.", status: "active" },
    ],
    projectsTitle: "Проекты экосистемы",
    projectsLede: "Каждая платформа потребляет или обслуживает канонические слои.",
    registryTitle: "Доступ к реестру",
    registryLede: "Канонический учёт слоёв, проектов, владения и Шлюза интеграции в федерацию.",
    registryButtons: [
      { label: "Реестр", href: "/ru/registry" },
      { label: "Слои", href: "/ru/registry/layers" },
      { label: "Проекты", href: "/ru/registry/projects" },
      { label: "Ядро", href: "/ru/core" },
    ],
    familyTitle: "Семейное наследие",
    familyLede: "Историческое и семейное наследие семьи Картель — отдельный раздел, не смешиваемый с институциональной поверхностью.",
    familyButton: "Открыть семейное наследие",
    statusLabels: { live: "активно", pending: "ожидается", active: "активно", planned: "план" },
  },
} as const;
