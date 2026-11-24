// Bilingual copy for the Organisations page (/[lang]/registry/organisations).
// Data (the canonical institutions + the future campus layer) comes from
// registry.public.json.organisationRegistry. Institutions only — no campuses,
// no operational data, no internal IDs, no PII.

export const organisationsContent = {
  EN: {
    motto: "Virtus et Potestas",
    copy: "KARTEL Core · public registry of the federation",
    metaTitle: "Organisations",
    metaDescription:
      "Canonical institutions of the KARTEL ecosystem — CEA CIC, Znaniye, Baltica and Russian Online with EUREKA — each with a readable organisation code.",
    eyebrow: "Registry",
    title: "Organisations",
    intro:
      "The canonical institutions of the federation. KARTEL Core owns this registry; platforms consume the codes, they never author them. Each institution has a readable canonicalOrgCode (not a UUID) and a place in one hierarchy.",
    fields: {
      code: "Canonical code",
      name: "Institution",
      tier: "Tier",
      parent: "Parent",
    },
    rootLabel: "— (root)",
    lifecycleLabel: "Lifecycle",
    campusesTitle: "Campuses — a separate canonical layer",
    campusesNote:
      "Operating accredited centres are anchored separately, by campusCode. An institution (canonicalOrgCode) is brand identity; a campus (campusCode) is operating-centre identity. The two are orthogonal — not parent and child.",
    campusesHref: "/en/registry/campuses",
    campusesLinkLabel: "Open Campuses",
    publicNote:
      "Public registry — canonical codes, names and hierarchy only. No operational data, no internal identifiers, no personal data. Those live in the access-controlled internal surface, never here.",
  },
  RU: {
    motto: "Virtus et Potestas",
    copy: "Ядро KARTEL · публичный реестр федерации",
    metaTitle: "Организации",
    metaDescription:
      "Канонические учреждения экосистемы KARTEL — CEA CIC, «Знание», «Балтика» и «Русский Онлайн с ЭВРИКОЙ» — у каждого свой читаемый код организации.",
    eyebrow: "Реестр",
    title: "Организации",
    intro:
      "Канонические учреждения федерации. Ядро KARTEL владеет этим реестром; платформы потребляют коды, но не создают их. У каждого учреждения — читаемый canonicalOrgCode (не UUID) и место в единой иерархии.",
    fields: {
      code: "Канонический код",
      name: "Учреждение",
      tier: "Уровень",
      parent: "Родитель",
    },
    rootLabel: "— (корень)",
    lifecycleLabel: "Жизненный цикл",
    campusesTitle: "Кампусы — отдельный канонический слой",
    campusesNote:
      "Действующие аккредитованные центры закрепляются отдельно — ключом campusCode. Учреждение (canonicalOrgCode) — это идентичность бренда; кампус (campusCode) — идентичность действующего центра. Это ортогональные измерения, а не «родитель — потомок».",
    campusesHref: "/ru/registry/campuses",
    campusesLinkLabel: "Открыть «Кампусы»",
    publicNote:
      "Публичный реестр — только канонические коды, названия и иерархия. Без операционных данных, без внутренних идентификаторов, без персональных данных. Они находятся во внутреннем контуре с контролем доступа, не здесь.",
  },
} as const;
