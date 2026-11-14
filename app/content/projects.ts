// Bilingual copy for the Ecosystem Directory (/[lang]/registry/projects).
// Data (projects + roles + per-layer status) from registry.public.json.projects.

export const projectsContent = {
  EN: {
    motto: "Virtus et Potestas",
    copy: "KARTEL Core · public registry of the federation",
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
    motto: "Virtus et Potestas",
    copy: "Ядро KARTEL · публичный реестр федерации",
    metaTitle: "Ядро KARTEL — каталог проектов экосистемы",
    metaDescription:
      "Проекты экосистемы KARTEL — MoyPolk, RusJAz, Community Group, RusJAzz — с их ролью в федерации (Authority, Producer, Steward, Consumer, Planned) и статусом по слоям.",
    eyebrow: "Каталог экосистемы",
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
      { role: "Planned", desc: "Подключится через Шлюз интеграции в федерацию." },
    ],
    publicNote:
      "Публичный реестр — только статус и архитектура. Без персональных данных; операционные детали — во внутреннем контуре с контролем доступа.",
  },
} as const;
