// Bilingual copy for the Organisation Registry (/[lang]/registry/organisations).
// Data (the canonical institutions + the future campus layer) comes from
// registry.public.json.organisationRegistry. Institutions only — no campuses,
// no operational data, no internal IDs, no PII.

export const organisationsContent = {
  EN: {
    nav: [
      { label: "Registry", href: "/en/registry" },
      { label: "Layers", href: "/en/registry/layers" },
      { label: "Organisations", href: "/en/registry/organisations", active: true },
      { label: "Campuses", href: "/en/registry/campuses" },
      { label: "Projects", href: "/en/registry/projects" },
      { label: "Family Heritage", href: "/en/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Core authority surface",
    metaTitle: "KARTEL Core — Organisation Registry (canonical institutions)",
    metaDescription:
      "The canonical organisation registry of the KARTEL ecosystem: the institutions CEA, RusJAz Foundation, Znaniye and Baltica, each with a readable canonicalOrgCode. Institutions only — operating campuses are anchored separately in the Campus Registry.",
    eyebrow: "Canonical layer · Organisation",
    title: "Organisation Registry",
    intro:
      "The canonical institutions of the federation. KARTEL Core owns this registry; platforms consume the codes, they never author them. Each institution has a readable canonicalOrgCode (not a UUID) and a place in one hierarchy.",
    fields: {
      code: "Canonical code",
      name: "Institution",
      tier: "Tier",
      parent: "Parent",
    },
    tierLabels: {
      AUTHORITY: "Authority",
      FOUNDATION: "Foundation",
      SCHOOL: "School",
    },
    rootLabel: "— (root)",
    campusesTitle: "Campuses — a separate canonical layer",
    campusesNote:
      "Operating accredited centres are anchored separately, by campusCode. An institution (canonicalOrgCode) is brand identity; a campus (campusCode) is operating-centre identity. The two are orthogonal — not parent and child.",
    campusesHref: "/en/registry/campuses",
    campusesLinkLabel: "Open the Campus Registry",
    publicNote:
      "Public registry — canonical codes, names and hierarchy only. No operational data, no internal identifiers, no personal data. Those live in the access-controlled internal surface, never here.",
  },
  RU: {
    nav: [
      { label: "Реестр", href: "/ru/registry" },
      { label: "Слои", href: "/ru/registry/layers" },
      { label: "Организации", href: "/ru/registry/organisations", active: true },
      { label: "Кампусы", href: "/ru/registry/campuses" },
      { label: "Проекты", href: "/ru/registry/projects" },
      { label: "Семейное наследие", href: "/ru/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Слой канонической авторитетности",
    metaTitle: "KARTEL Core — реестр организаций (канонические учреждения)",
    metaDescription:
      "Канонический реестр организаций экосистемы KARTEL: учреждения CEA, RusJAz Foundation, «Знание» и «Балтика», каждое со своим читаемым canonicalOrgCode. Только учреждения — действующие кампусы закрепляются отдельно, в реестре кампусов.",
    eyebrow: "Канонический слой · Организация",
    title: "Реестр организаций",
    intro:
      "Канонические учреждения федерации. KARTEL Core владеет этим реестром; платформы потребляют коды, но не создают их. У каждого учреждения — читаемый canonicalOrgCode (не UUID) и место в единой иерархии.",
    fields: {
      code: "Канонический код",
      name: "Учреждение",
      tier: "Уровень",
      parent: "Родитель",
    },
    tierLabels: {
      AUTHORITY: "Авторитет",
      FOUNDATION: "Фонд",
      SCHOOL: "Школа",
    },
    rootLabel: "— (корень)",
    campusesTitle: "Кампусы — отдельный канонический слой",
    campusesNote:
      "Действующие аккредитованные центры закрепляются отдельно — ключом campusCode. Учреждение (canonicalOrgCode) — это идентичность бренда; кампус (campusCode) — идентичность действующего центра. Это ортогональные измерения, а не «родитель — потомок».",
    campusesHref: "/ru/registry/campuses",
    campusesLinkLabel: "Открыть реестр кампусов",
    publicNote:
      "Публичный реестр — только канонические коды, названия и иерархия. Без операционных данных, без внутренних идентификаторов, без персональных данных. Они находятся во внутреннем контуре с контролем доступа, не здесь.",
  },
} as const;
