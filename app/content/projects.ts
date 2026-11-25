// Bilingual copy for the Ecosystem Directory (/[lang]/registry/projects).
// Data (projects + roles + per-layer status) from registry.public.json.projects.

export const projectsContent = {
  EN: {
    motto: "Virtus et Potestas",
    copy: "KARTEL Core · public registry of the federation",
    metaTitle: "Projects",
    metaDescription:
      "KARTEL ecosystem projects — MoyPolk, RusJAz, Community Group and RusJAzz — with each one's federation role and per-layer status.",
    eyebrow: "Registry",
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
      { role: "Planned", desc: "Will join via the Federation integration gate." },
      { role: "Retired", desc: "Brand retired; its work continues in another project." },
    ],
    publicNote:
      "Public registry — status and architecture only. No personal data; operational detail lives in the access-controlled internal surface.",
  },
  RU: {
    motto: "Virtus et Potestas",
    copy: "Ядро KARTEL · публичный реестр федерации",
    metaTitle: "Проекты",
    metaDescription:
      "Проекты экосистемы KARTEL — MoyPolk, RusJAz, Community Group и RusJAzz — с ролью каждого в федерации и статусом по слоям.",
    eyebrow: "Реестр",
    title: "Проекты",
    intro:
      "Каждая платформа федерации и её роль. Ядро KARTEL — авторитет для канонических слоёв; платформы производят, обслуживают или потребляют их.",
    cols: { project: "Проект", role: "Роль", identity: "Идентичность", geography: "География", organisation: "Организация" },
    roleLegendTitle: "Роли",
    roleLegend: [
      { role: "Authority", desc: "Владеет каноническими слоями (Ядро KARTEL)." },
      { role: "Producer", desc: "Производит канонические данные слоя." },
      { role: "Steward", desc: "Обслуживает / поддерживает слой для экосистемы." },
      { role: "Consumer", desc: "Потребляет канонические слои; не создаёт сам." },
      { role: "Planned", desc: "Подключится через шлюз интеграции в федерацию." },
      { role: "Retired", desc: "Бренд упразднён; работа продолжается в другом проекте." },
    ],
    publicNote:
      "Публичный реестр — только статус и архитектура. Без персональных данных; операционные детали — во внутреннем контуре с контролем доступа.",
  },
} as const;
