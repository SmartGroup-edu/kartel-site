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
      { label: "Projects", href: "/en/registry/projects" },
      { label: "Family Heritage", href: "/en/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Core authority surface",
    metaTitle: "KARTEL Core — Organisation Registry (canonical institutions)",
    metaDescription:
      "The canonical organisation registry of the KARTEL ecosystem: the institutions CEA, RusJAz Foundation, Znaniye and Baltica, each with a readable canonicalOrgCode. Institutions only — campuses and venues are a separate future layer.",
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
    campusesTitle: "Campuses & venues — a future layer",
    campusesNote:
      "Physical locations are not institutions. A school that teaches in several places is one institution with several campuses — listing each campus as its own organisation would duplicate its members, accreditation, finance and governance. Campuses will therefore be modelled in a separate future Campus Registry, keyed by campusCode and anchored to their institution. Shown below for orientation only — not yet canonical.",
    campusFields: {
      campusCode: "Campus code (future)",
      org: "Institution",
      location: "Location",
    },
    publicNote:
      "Public registry — canonical codes, names and hierarchy only. No operational data, no internal identifiers, no personal data. Those live in the access-controlled internal surface, never here.",
  },
  RU: {
    nav: [
      { label: "Реестр", href: "/ru/registry" },
      { label: "Слои", href: "/ru/registry/layers" },
      { label: "Организации", href: "/ru/registry/organisations", active: true },
      { label: "Проекты", href: "/ru/registry/projects" },
      { label: "Семейное наследие", href: "/ru/family" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Слой канонической авторитетности",
    metaTitle: "KARTEL Core — реестр организаций (канонические учреждения)",
    metaDescription:
      "Канонический реестр организаций экосистемы KARTEL: учреждения CEA, RusJAz Foundation, «Знание» и «Балтика», каждое со своим читаемым canonicalOrgCode. Только учреждения — кампусы и площадки выделены в отдельный будущий слой.",
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
    campusesTitle: "Кампусы и площадки — будущий слой",
    campusesNote:
      "Физические локации — это не учреждения. Школа, которая преподаёт в нескольких местах, — это одно учреждение с несколькими кампусами; если записать каждый кампус отдельной организацией, мы продублируем её участников, аккредитацию, финансы и управление. Поэтому кампусы будут вынесены в отдельный будущий реестр кампусов с ключом campusCode, привязанным к своему учреждению. Ниже — только для ориентира, ещё не канонично.",
    campusFields: {
      campusCode: "Код кампуса (в будущем)",
      org: "Учреждение",
      location: "Локация",
    },
    publicNote:
      "Публичный реестр — только канонические коды, названия и иерархия. Без операционных данных, без внутренних идентификаторов, без персональных данных. Они находятся во внутреннем контуре с контролем доступа, не здесь.",
  },
} as const;
