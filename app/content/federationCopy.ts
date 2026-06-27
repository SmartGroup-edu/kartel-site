// Bilingual overlay for prose that lives English-only in registry.public.json
// (the regeneration-safe public projection of kartel-core/registry.yaml).
//
// The JSON stays the canonical source of truth for STRUCTURE and English text —
// it is regenerated on any governance change and must not carry translations
// (they would be overwritten). These maps localise the human-readable prose
// only, keyed by the stable keys in registry.public.json (project `key`,
// federationGate item `key`). Render with a fallback to the JSON value:
//
//   projectSummaries[lang][p.key] ?? p.summary
//   gateDescriptions[lang][item.key] ?? item.description
//
// so a new key added to the JSON degrades gracefully to English until it is
// translated here.

import type { Lang } from "../components/useLang";

/** Project summaries (registry.public.json.projects[].summary), by project key. */
export const projectSummaries: Record<Lang, Record<string, string>> = {
  EN: {
    moypolk:
      "Immortal Regiment UK memorial platform. Produces + serves the canonical geography taxonomy.",
    rusjaz:
      "Russian-language education marketplace + LMS. Identity reference implementation; consumes canonical geography, organisation + campus anchors.",
    "community-group":
      "Cultural funding & trust platform (CEA). Consumes identity + geography; first geography consumer.",
    rusjazz:
      "Future module. Builds against the Federation Integration Gate from day one.",
  },
  RU: {
    moypolk:
      "Мемориальная платформа «Бессмертный полк» (Великобритания). Производит и обслуживает каноническую таксономию географии.",
    rusjaz:
      "Маркетплейс и LMS русскоязычного образования. Эталонная реализация слоя идентичности; потребляет канонические слои географии, организаций и кампусов.",
    "community-group":
      "Платформа культурного финансирования и доверия (CEA). Потребляет идентичность и географию; первый потребитель слоя географии.",
    rusjazz:
      "Будущий модуль. С первого дня строится в соответствии с Federation Integration Gate.",
  },
};

/** Federation Gate item descriptions (registry.public.json.federationGate.items[].description), by item key. */
export const gateDescriptions: Record<Lang, Record<string, string>> = {
  EN: {
    cpif_authentication:
      "Federated identity via the shared Keycloak realm; local mirror of the subject.",
    canonical_geography:
      "Store CanonicalRegionCode (ITL1); consume the taxonomy API; never self-author regions.",
    organisation_anchor:
      "Reference canonical organisations; do not author canonical orgs locally.",
    membership_contract: "Conform membership edges to the shared shape.",
    permission_pattern:
      "Local roles; delegation-grant pattern; no global role catalogue.",
    event_geo_anchor: "Anchor events to a CanonicalRegionCode.",
    notification_envelope: "Conform notifications to the shared envelope.",
    audit_envelope: "Append-only audit conforming to the shared envelope.",
  },
  RU: {
    cpif_authentication:
      "Федеративная идентичность через общий realm Keycloak; локальная копия субъекта.",
    canonical_geography:
      "Хранить CanonicalRegionCode (ITL1); потреблять taxonomy API; не создавать регионы самостоятельно.",
    organisation_anchor:
      "Ссылаться на канонические организации; не создавать канонические организации локально.",
    membership_contract: "Приводить рёбра членства (membership edges) к общей форме.",
    permission_pattern:
      "Локальные роли; шаблон делегирования прав (delegation-grant); без глобального каталога ролей.",
    event_geo_anchor: "Привязывать события к CanonicalRegionCode.",
    notification_envelope: "Приводить уведомления к общему конверту (envelope).",
    audit_envelope:
      "Только дополняемый аудит, соответствующий общему конверту (envelope).",
  },
};
