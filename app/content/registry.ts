// Bilingual UI copy for the KARTEL Core Registry dashboard (/[lang]/registry).
// Data (layers, projects, gate, contracts) comes from registry.public.json —
// the sanitized public projection of the Core registry. No PII, no secrets.

export const registryContent = {
  EN: {
    nav: [
      { label: "Core", href: "/en" },
      { label: "Registry", href: "/en/registry" },
      { label: "Family Heritage", href: "/en/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Core authority surface",
    metaTitle: "KARTEL Core Registry — federation layers, projects, status",
    metaDescription:
      "The official registry of the KARTEL ecosystem: canonical layers (identity, geography), project federation status, ownership, and the Federation Integration Gate.",
    title: "KARTEL Core Registry",
    intro:
      "The canonical authority surface of the KARTEL ecosystem. KARTEL Core owns the canonical layers; platforms consume or steward them. This registry observes — it is not a workflow, a database, or a runtime dependency.",
    updatedLabel: "Updated",
    sections: {
      layers: "Canonical layers",
      layersNote: "Owned by KARTEL Core. One identity. One geography. Contracts define the rest.",
      projects: "Projects",
      projectsNote: "Each project consumes or stewards the canonical layers. None owns Core.",
      gate: "Federation Integration Gate",
      gateNote: "No new project may enter production unless it passes all eight.",
      contracts: "Contracts",
      contractsNote: "@kartel/contracts — types only. Conformance is federation.",
    },
    cols: { layer: "Layer", kind: "Kind", owner: "Owner", steward: "Steward", status: "Status" },
    layerNames: {
      identity: "Identity", geography: "Geography", organisation: "Organisation",
      events: "Events", audit: "Audit",
    },
    publicNote:
      "Public registry — status and architecture only. Operational detail, reconciliation, and any personal data live in the access-controlled internal surface, never here.",
  },
  RU: {
    nav: [
      { label: "Core", href: "/ru" },
      { label: "Реестр", href: "/ru/registry" },
      { label: "Семейное наследие", href: "/ru/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Слой канонической авторитетности",
    metaTitle: "Реестр KARTEL Core — слои федерации, проекты, статус",
    metaDescription:
      "Официальный реестр экосистемы KARTEL: канонические слои (идентичность, география), статус федерации проектов, владение и Federation Integration Gate.",
    title: "Реестр KARTEL Core",
    intro:
      "Официальный слой авторитетности экосистемы KARTEL. KARTEL Core владеет каноническими слоями; платформы их потребляют или обслуживают. Реестр наблюдает — это не workflow, не база данных и не runtime-зависимость.",
    updatedLabel: "Обновлено",
    sections: {
      layers: "Канонические слои",
      layersNote: "Принадлежат KARTEL Core. Одна идентичность. Одна география. Остальное задают контракты.",
      projects: "Проекты",
      projectsNote: "Каждый проект потребляет или обслуживает канонические слои. Никто не владеет Core.",
      gate: "Federation Integration Gate",
      gateNote: "Ни один новый проект не выходит в production, не пройдя все восемь пунктов.",
      contracts: "Контракты",
      contractsNote: "@kartel/contracts — только типы. Соответствие = федерация.",
    },
    cols: { layer: "Слой", kind: "Тип", owner: "Владелец", steward: "Стюард", status: "Статус" },
    layerNames: {
      identity: "Идентичность", geography: "География", organisation: "Организация",
      events: "События", audit: "Аудит",
    },
    publicNote:
      "Публичный реестр — только статус и архитектура. Операционные детали, сверка и любые персональные данные находятся во внутреннем контуре с контролем доступа, не здесь.",
  },
} as const;
