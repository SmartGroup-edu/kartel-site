// Bilingual copy for the Campuses page (/[lang]/registry/campuses).
// Data (the canonical campuses) comes from registry.public.json.campusRegistry.
// Campuses only — accredited operating centres. No PII, no operational data, no internal IDs.

export const campusesContent = {
  EN: {
    motto: "Virtus et Potestas",
    copy: "KARTEL Core · public registry of the federation",
    metaTitle: "Campuses",
    metaDescription:
      "Accredited operating centres of the KARTEL ecosystem — Znaniye Stratford, Chelsea, Ealing and Baltica Leeds — each with a readable campus code.",
    eyebrow: "Registry",
    title: "Campuses",
    intro:
      "The canonical accredited operating centres of the federation. A campus is an accredited centre — it may own accreditation, classes and governance — identified by a readable campusCode. KARTEL Core owns this registry; platforms consume the codes, they never author them.",
    fields: {
      code: "Campus code",
      location: "Location",
      institution: "Institution",
    },
    orthogonalNote:
      "campusCode and canonicalOrgCode are orthogonal dimensions, not parent-and-child: the institution code (e.g. ZNANIYE) is brand identity; the campus code (e.g. ZNANIYE-CHELSEA) is operating-centre identity. A single institution may run several accredited campuses.",
    venueNote:
      "Campus ≠ Venue. A campus is the accredited centre itself (school-tier). A venue is a physical room, hall or building below it. Only accredited centres are registered here.",
    publicNote:
      "Public registry — canonical codes, locations and institution only. No operational data, no internal identifiers, no personal data. Those live in the access-controlled internal surface, never here.",
  },
  RU: {
    motto: "Virtus et Potestas",
    copy: "Ядро KARTEL · публичный реестр федерации",
    metaTitle: "Кампусы",
    metaDescription:
      "Аккредитованные центры экосистемы KARTEL — «Знание» Стратфорд, Челси, Илинг и «Балтика» Лидс — у каждого свой читаемый код кампуса.",
    eyebrow: "Реестр",
    title: "Кампусы",
    intro:
      "Канонические аккредитованные образовательные центры федерации. Кампус — это аккредитованный центр, который может иметь собственную аккредитацию, занятия и управление; он обозначается читаемым campusCode. Ядро KARTEL владеет реестром; платформы потребляют коды, но не создают их.",
    fields: {
      code: "Код кампуса",
      location: "Локация",
      institution: "Учреждение",
    },
    orthogonalNote:
      "campusCode и canonicalOrgCode — ортогональные измерения, а не отношение «родитель — потомок»: код учреждения (например, ZNANIYE) — это идентичность бренда; код кампуса (например, ZNANIYE-CHELSEA) — идентичность действующего центра. Одно учреждение может вести несколько аккредитованных кампусов.",
    venueNote:
      "Кампус ≠ Площадка (Venue). Кампус — это сам аккредитованный центр (уровень школы). Площадка — физическое помещение, зал или здание ниже него. Здесь регистрируются только аккредитованные центры.",
    publicNote:
      "Публичный реестр — только канонические коды, локации и учреждение. Без операционных данных, без внутренних идентификаторов, без персональных данных. Они находятся во внутреннем контуре с контролем доступа, не здесь.",
  },
} as const;
