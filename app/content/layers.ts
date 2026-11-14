// Bilingual copy for the Registry of Registries (/[lang]/registry/layers).
// Data (the four layer registries) comes from registry.public.json.layerRegistry.
// Each layer is shown in the same structure — human-readable AND machine-shaped.

export const layersContent = {
  EN: {
    motto: "Virtus et Potestas",
    copy: "KARTEL Core · public registry of the federation",
    metaTitle: "KARTEL Core — Registry of Registries (canonical layers)",
    metaDescription:
      "The constitutional description of the four canonical layers of the KARTEL ecosystem: Identity (CPIF), Geography (ITL1), Organisation, and Federation — each with its authority, steward, consumers, contract, and status.",
    eyebrow: "Registry of Registries",
    title: "Canonical layers",
    intro:
      "The four canonical layers of the federation. KARTEL Core is the authority for each; platforms consume. Each layer is described in one structure — readable by people and shaped for machines.",
    fields: {
      purpose: "Purpose",
      canonicalKey: "Canonical key",
      authority: "Authority",
      steward: "Steward",
      consumers: "Consumers",
      contract: "Contract",
      status: "Status",
    },
    statusLabels: { active: "active", pending: "pending", planned: "planned", draft: "draft" },
    publicNote:
      "Public registry — status and architecture only. Operational detail and any personal data live in the access-controlled internal surface, never here.",
  },
  RU: {
    motto: "Virtus et Potestas",
    copy: "Ядро KARTEL · публичный реестр федерации",
    metaTitle: "Ядро KARTEL — реестр реестров (канонические слои)",
    metaDescription:
      "Конституционное описание четырёх канонических слоёв экосистемы KARTEL: идентичность (CPIF), география (ITL1), организация и федерация — с авторитетом, стюардом, потребителями, контрактом и статусом каждого.",
    eyebrow: "Реестр реестров",
    title: "Канонические слои",
    intro:
      "Четыре канонических слоя федерации. Ядро KARTEL — авторитет для каждого; платформы потребляют. Каждый слой описан одной структурой — читаемой людьми и понятной машинам.",
    fields: {
      purpose: "Назначение",
      canonicalKey: "Канонический ключ",
      authority: "Авторитет",
      steward: "Стюард",
      consumers: "Потребители",
      contract: "Контракт",
      status: "Статус",
    },
    statusLabels: { active: "активно", pending: "ожидается", planned: "план", draft: "черновик" },
    publicNote:
      "Публичный реестр — только статус и архитектура. Операционные детали и любые персональные данные — во внутреннем контуре с контролем доступа, не здесь.",
  },
} as const;
