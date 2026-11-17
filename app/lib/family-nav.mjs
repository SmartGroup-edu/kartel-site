/**
 * The one family sub-navigation (bus 63): every family page shows the same row under the site
 * header — Heritage · Today · People (+ Access and Editor for admins). Family OS items appear only when the
 * service is connected and the viewer is a member (or the admin). With a single item there is
 * nothing to navigate, so the row is hidden.
 */
const L = {
  EN: { heritage: "Heritage", today: "Today", people: "People", admin: "Editor", access: "Access", nav: "Family sections" },
  RU: { heritage: "Наследие", today: "Сегодня", people: "Люди", admin: "Редактор", access: "Доступы", nav: "Разделы семьи" },
};

/**
 * @param {{ lang: "EN" | "RU", admin: boolean, os: boolean }} o
 * @returns {{ id: "heritage" | "today" | "people" | "access" | "admin", href: string, label: string }[]}
 */
export function familySubNav({ lang, admin, os }) {
  const base = `/${lang === "EN" ? "en" : "ru"}/family`, t = L[lang];
  const items = [{ id: "heritage", href: base, label: t.heritage }];
  if (os) items.push({ id: "today", href: `${base}/os`, label: t.today }, { id: "people", href: `${base}/os/people`, label: t.people });
  if (admin && os) items.push({ id: "access", href: `${base}/os/access`, label: t.access });
  if (admin) items.push({ id: "admin", href: `${base}/admin`, label: t.admin });
  return items.length > 1 ? items : [];
}
export const familySubNavLabel = (lang) => L[lang].nav;

/** "Рады вас видеть, Анна" — the name from the Family OS profile; without one, no dangling comma. */
export function greeting(lang, name) {
  const n = typeof name === "string" ? name.trim() : "";
  const safe = n && !n.includes("@") ? n : "";
  if (lang === "EN") return safe ? `Good to see you, ${safe}` : "Good to see you";
  return safe ? `Рады вас видеть, ${safe}` : "Рады вас видеть";
}

/** One page container for every family page, so the sub-nav and the heading column sit at the same
 *  place everywhere (bus 64: the row jumped 16 px between pages with different containers). */
export const FAMILY_MAIN = "mx-auto w-full max-w-6xl flex-1 px-4 pb-4 pt-10 sm:px-6 sm:pt-12 lg:px-10 lg:pb-6 lg:pt-20";
export const FAMILY_HEADER_MAX = "max-w-6xl";
