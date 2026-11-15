// Bilingual UI copy for the KARTEL Core Registry dashboard (/[lang]/registry).
// Data (layers, projects, gate, contracts) comes from registry.public.json —
// the sanitized public projection of the Core registry. No PII, no secrets.

export const registryContent = {
  EN: {
    motto: "Virtus et Potestas",
    copy: "KARTEL Core · public registry of the federation",
    metaTitle: "KARTEL Registry — layers, projects, status",
    metaDescription:
      "The official registry of the KARTEL federation: canonical layers, each project's federation status and the Federation Integration Gate.",
    eyebrow: "KARTEL Core",
    title: "KARTEL Core Registry",
    intro:
      "The public record of the KARTEL federation. KARTEL Core owns the canonical layers; platforms consume or steward them. This registry observes — it is not a workflow, a database, or a runtime dependency.",
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
      campus: "Campus", events: "Events", audit: "Audit",
    },
    publicNote:
      "Public registry — status and architecture only. Operational detail, reconciliation, and any personal data live in the access-controlled internal surface, never here.",
  },
  RU: {
    motto: "Virtus et Potestas",
    copy: "Ядро KARTEL · публичный реестр федерации",
    metaTitle: "Реестр KARTEL — слои, проекты, статус",
    metaDescription:
      "Официальный реестр федерации KARTEL: канонические слои, статус каждого проекта в федерации и Шлюз интеграции.",
    eyebrow: "Ядро KARTEL",
    title: "Реестр Ядра KARTEL",
    intro:
      "Публичная запись федерации KARTEL. Ядро KARTEL владеет каноническими слоями; платформы их потребляют или обслуживают. Реестр только фиксирует состояние — это не рабочий процесс, не база данных и не зависимость, от которой работают платформы.",
    sections: {
      layers: "Канонические слои",
      layersNote: "Принадлежат Ядру KARTEL. Одна идентичность. Одна география. Остальное задают контракты.",
      projects: "Проекты",
      projectsNote: "Каждый проект потребляет или обслуживает канонические слои. Никто не владеет Ядром.",
      gate: "Шлюз интеграции в федерацию",
      gateNote: "Ни один новый проект не запускается в работу, не пройдя все восемь пунктов.",
      contracts: "Контракты",
      contractsNote: "@kartel/contracts — только типы. Соответствие = федерация.",
    },
    cols: { layer: "Слой", kind: "Тип", owner: "Владелец", steward: "Стюард", status: "Статус" },
    layerNames: {
      identity: "Идентичность", geography: "География", organisation: "Организация",
      campus: "Кампус", events: "События", audit: "Аудит",
    },
    publicNote:
      "Публичный реестр — только статус и архитектура. Операционные детали, сверка и любые персональные данные находятся во внутреннем контуре с контролем доступа, не здесь.",
  },
} as const;
