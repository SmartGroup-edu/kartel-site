// One navigation for every institutional page (design audit 2026-11-14, finding #4).
// Before this, each page carried its own `nav` list and the header changed from page to page.
// Active state is derived from the URL in SiteHeader, not hard-coded per page.

import type { Lang } from "../components/useLang";

export interface NavItem {
  label: string;
  href: string;
  /** Rendered as a POST form button, not a link (sign-out, QA-156 L1). */
  post?: true;
}

const PRIMARY = {
  EN: [
    { label: "Coat of Arms", path: "" },
    { label: "Core", path: "core" },
    { label: "Registry", path: "registry" },
    { label: "Family Heritage", path: "family" },
  ],
  RU: [
    { label: "Герб", path: "" },
    { label: "Ядро", path: "core" },
    { label: "Реестр", path: "registry" },
    { label: "Семейное наследие", path: "family" },
  ],
} as const;

const REGISTRY_SECTIONS = {
  EN: [
    { label: "Overview", path: "registry" },
    { label: "Layers", path: "registry/layers" },
    { label: "Organisations", path: "registry/organisations" },
    { label: "Campuses", path: "registry/campuses" },
    { label: "Federation map", path: "registry/federation" },
    { label: "Projects", path: "registry/projects" },
  ],
  RU: [
    { label: "Обзор", path: "registry" },
    { label: "Слои", path: "registry/layers" },
    { label: "Организации", path: "registry/organisations" },
    { label: "Кампусы", path: "registry/campuses" },
    { label: "Карта федерации", path: "registry/federation" },
    { label: "Проекты", path: "registry/projects" },
  ],
} as const;

const build = (lang: Lang, items: readonly { label: string; path: string }[]): NavItem[] =>
  items.map((i) => ({ label: i.label, href: `/${lang.toLowerCase()}${i.path ? `/${i.path}` : ""}` }));

export const primaryNav = (lang: Lang): NavItem[] => build(lang, PRIMARY[lang]);

/** Family area header (/family): the one site menu plus Sign out. The coat of arms is the
 *  public home page since R0's decision of 2026-11-14 (/family/crest → 308 to /{lang}). */
export const familyNav = (lang: Lang): NavItem[] => [
  ...primaryNav(lang),
  { label: lang === "RU" ? "Выйти" : "Sign out", href: "/api/family-auth/logout", post: true },
];
export const registryNav = (lang: Lang): NavItem[] => build(lang, REGISTRY_SECTIONS[lang]);

/** The single item whose href is the longest prefix of `pathname` — so /en/registry/projects
 *  marks "Projects", not "Registry" as well. */
export function activeHref(items: NavItem[], pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    if ((pathname === href || pathname.startsWith(href + "/")) && (!best || href.length > best.length)) best = href;
  }
  return best;
}
