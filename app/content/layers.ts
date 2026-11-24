// Bilingual copy for the Layers page (/[lang]/registry/layers).
// Data (the four layer registries) comes from registry.public.json.layerRegistry.
// Each layer is shown in the same structure — human-readable AND machine-shaped.

export const layersContent = {
  EN: {
    motto: "Virtus et Potestas",
    copy: "KARTEL Core · public registry of the federation",
    metaTitle: "Layers",
    metaDescription:
      "The four canonical layers of the KARTEL ecosystem — identity, geography, organisation and federation — with owner, steward, consumers and status.",
    eyebrow: "Registry",
    title: "Layers",
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
      note: "Change note",
    },
    publicNote:
      "Public registry — status and architecture only. Operational detail and any personal data live in the access-controlled internal surface, never here.",
  },
  RU: {
    motto: "Virtus et Potestas",
    copy: "Ядро KARTEL · публичный реестр федерации",
    metaTitle: "Слои",
    metaDescription:
      "Четыре канонических слоя экосистемы KARTEL — идентичность, география, организация и федерация — с владельцем, стюардом, потребителями и статусом.",
    eyebrow: "Реестр",
    title: "Слои",
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
      note: "Изменение",
    },
    publicNote:
      "Публичный реестр — только статус и архитектура. Операционные детали и любые персональные данные — во внутреннем контуре с контролем доступа, не здесь.",
  },
} as const;
