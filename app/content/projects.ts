// Bilingual copy for the Ecosystem Directory (/[lang]/registry/projects).
// Data (projects + roles + per-layer status) from registry.public.json.projects.

export const projectsContent = {
  EN: {
    nav: [
      { label: "Registry", href: "/en/registry" },
      { label: "Layers", href: "/en/registry/layers" },
      { label: "Organisations", href: "/en/registry/organisations" },
      { label: "Projects", href: "/en/registry/projects", active: true },
      { label: "Family Heritage", href: "/en/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Core authority surface",
    metaTitle: "KARTEL Core — ecosystem projects directory",
    metaDescription:
      "The KARTEL ecosystem projects — MoyPolk, RusJAz, Community Group, RusJAzz — with their federation role (Authority, Producer, Steward, Consumer, Planned) and per-layer status.",
    eyebrow: "Ecosystem directory",
    title: "Projects",
    intro:
      "Every platform in the federation and its role. KARTEL Core is the Authority for the canonical layers; platforms produce, steward, or consume them.",
    cols: { project: "Project", role: "Role", identity: "Identity", geography: "Geography", organisation: "Organisation" },
    roleLegendTitle: "Roles",
    roleLegend: [
      { role: "Authority", desc: "Owns the canonical layers (KARTEL Core)." },
      { role: "Producer", desc: "Produces canonical data for a layer." },
      { role: "Steward", desc: "Serves / maintains a layer for the ecosystem." },
      { role: "Consumer", desc: "Consumes canonical layers; never self-authors." },
      { role: "Planned", desc: "Will join via the Federation Integration Gate." },
    ],
    publicNote:
      "Public registry — status and architecture only. No personal data; operational detail lives in the access-controlled internal surface.",
  },
  RU: {
    nav: [
      { label: "Реестр", href: "/ru/registry" },
      { label: "Слои", href: "/ru/registry/layers" },
      { label: "Организации", href: "/ru/registry/organisations" },
      { label: "Проекты", href: "/ru/registry/projects", active: true },
      { label: "Семейное наследие", href: "/ru/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Слой канонической авторитетности",
    metaTitle: "KARTEL Core — каталог проектов экосистемы",
    metaDescription:
      "Проекты экосистемы KARTEL — MoyPolk, RusJAz, Community Group, RusJAzz — с их ролью в федерации (Authority, Producer, Steward, Consumer, Planned) и статусом по слоям.",
    eyebrow: "Каталог экосистемы",
    title: "Проекты",
    intro:
      "Каждая платформа федерации и её роль. KARTEL Core — авторитет для канонических слоёв; платформы производят, обслуживают или потребляют их.",
    cols: { project: "Проект", role: "Роль", identity: "Идентичность", geography: "География", organisation: "Организация" },
    roleLegendTitle: "Роли",
    roleLegend: [
      { role: "Authority", desc: "Владеет каноническими слоями (KARTEL Core)." },
      { role: "Producer", desc: "Производит канонические данные слоя." },
      { role: "Steward", desc: "Обслуживает / поддерживает слой для экосистемы." },
      { role: "Consumer", desc: "Потребляет канонические слои; не создаёт сам." },
      { role: "Planned", desc: "Подключится через Federation Integration Gate." },
    ],
    publicNote:
      "Публичный реестр — только статус и архитектура. Без персональных данных; операционные детали — во внутреннем контуре с контролем доступа.",
  },
} as const;
