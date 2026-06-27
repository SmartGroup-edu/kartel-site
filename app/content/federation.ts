// Bilingual copy for the Federation Operations Map (/[lang]/registry/federation).
// Data comes from federation.public.json — a sanitised, BANDED, point-in-time observability
// snapshot. Read-only. No PII, no identities, no exact counts < 5 at named entities.

export const federationContent = {
  EN: {
    nav: [
      { label: "Registry", href: "/en/registry" },
      { label: "Layers", href: "/en/registry/layers" },
      { label: "Organisations", href: "/en/registry/organisations" },
      { label: "Campuses", href: "/en/registry/campuses" },
      { label: "Federation Map", href: "/en/registry/federation", active: true },
      { label: "Projects", href: "/en/registry/projects" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Core authority surface",
    metaTitle: "KARTEL Core — Federation Operations Map (observability)",
    metaDescription:
      "A read-only observability map of the KARTEL federation, generated entirely from canonical keys: identity, geography, organisation and campus. Aggregate banded counts only — the map observes the federation, it is never a source of truth.",
    eyebrow: "Federation Operations Map",
    title: "Federation observability",
    intro:
      "A read-only map of the federation, generated entirely from canonical keys. It shows structure and integrity — the four canonical layers, the organisation/campus topology, per-platform participation, and orphan/drift checks. It carries no personal data, no identities, and no authority. The map observes the federation; it is never a source of truth.",
    snapshotLabel: "Snapshot",
    sections: {
      layers: "Canonical layers",
      contracts: "Federation contracts",
      platforms: "Platform participation",
      topology: "Organisation & campus topology",
      integrity: "Integrity checks",
    },
    cols: {
      platform: "Platform",
      role: "Role",
      cpif: "Federated (CPIF)",
      layers: "Layers",
      anchor: "Anchor",
      tier: "Tier",
      region: "Region",
      members: "Members",
    },
    integrityLabels: {
      orphanOrg: "Orphan organisations",
      orphanCampus: "Orphan campuses",
      orphanRegion: "Orphan regions",
      drift: "Drift",
      strayNodes: "Stray nodes",
      subjectsOnNonCanonicalNodes: "Federated subjects on non-canonical nodes",
    },
    bandNote:
      "People-counts are banded for privacy (0 · Active · 5–9 · 10–19 · 20+); an exact count is never published below 5 at a named entity. Integrity counts are structural and exact.",
    publicNote:
      "Read-only observability snapshot — banded aggregate counts and canonical codes only. No personal data, no identities, no permissions, no authority. Built from sanitised Core-owned artifacts with no runtime dependency on platform databases.",
  },
  RU: {
    nav: [
      { label: "Реестр", href: "/ru/registry" },
      { label: "Слои", href: "/ru/registry/layers" },
      { label: "Организации", href: "/ru/registry/organisations" },
      { label: "Кампусы", href: "/ru/registry/campuses" },
      { label: "Карта федерации", href: "/ru/registry/federation", active: true },
      { label: "Проекты", href: "/ru/registry/projects" },
    ],
    motto: "Virtus et Potestas",
    copy: "© 2026 KARTEL · Слой канонической авторитетности",
    metaTitle: "KARTEL Core — карта операций федерации (наблюдаемость)",
    metaDescription:
      "Карта федерации KARTEL только для чтения, построенная исключительно из канонических ключей: идентичность, география, организация и кампус. Только агрегированные диапазоны — карта наблюдает за федерацией, но никогда не является источником истины.",
    eyebrow: "Карта операций федерации",
    title: "Наблюдаемость федерации",
    intro:
      "Карта федерации только для чтения, построенная исключительно из канонических ключей. Она показывает структуру и целостность — четыре канонических слоя, топологию организаций и кампусов, участие платформ и проверки на потерянные/расходящиеся записи. В ней нет персональных данных, идентичностей или полномочий. Карта наблюдает за федерацией; она никогда не является источником истины.",
    snapshotLabel: "Снимок",
    sections: {
      layers: "Канонические слои",
      contracts: "Контракты федерации",
      platforms: "Участие платформ",
      topology: "Топология организаций и кампусов",
      integrity: "Проверки целостности",
    },
    cols: {
      platform: "Платформа",
      role: "Роль",
      cpif: "В федерации (CPIF)",
      layers: "Слои",
      anchor: "Якорь",
      tier: "Уровень",
      region: "Регион",
      members: "Участники",
    },
    integrityLabels: {
      orphanOrg: "Потерянные организации",
      orphanCampus: "Потерянные кампусы",
      orphanRegion: "Потерянные регионы",
      drift: "Расхождение",
      strayNodes: "Висячие узлы",
      subjectsOnNonCanonicalNodes: "Федеративные субъекты на неканонических узлах",
    },
    bandNote:
      "Счётчики людей округлены до диапазонов для приватности (0 · Активно · 5–9 · 10–19 · 20+); точное значение ниже 5 для именованной сущности не публикуется. Счётчики целостности — структурные и точные.",
    publicNote:
      "Снимок наблюдаемости только для чтения — только агрегированные диапазоны и канонические коды. Без персональных данных, идентичностей, разрешений и полномочий. Построен из санированных артефактов Core без runtime-зависимости от баз данных платформ.",
  },
} as const;
