/**
 * The one family sub-navigation (bus 63): every family page shows the same row under the site
 * header — Heritage · Today · People (+ Editor for admins). Family OS items appear only when the
 * service is connected and the viewer is a member (or the admin). With a single item there is
 * nothing to navigate, so the row is hidden.
 */
const L = {
  EN: { heritage: "Heritage", today: "Today", people: "People", admin: "Editor", nav: "Family sections" },
  RU: { heritage: "Наследие", today: "Сегодня", people: "Люди", admin: "Редактор", nav: "Разделы семьи" },
};

/**
 * @param {{ lang: "EN" | "RU", admin: boolean, os: boolean }} o
 * @returns {{ id: "heritage" | "today" | "people" | "admin", href: string, label: string }[]}
 */
export function familySubNav({ lang, admin, os }) {
  const base = `/${lang === "EN" ? "en" : "ru"}/family`, t = L[lang];
  const items = [{ id: "heritage", href: base, label: t.heritage }];
  if (os) items.push({ id: "today", href: `${base}/os`, label: t.today }, { id: "people", href: `${base}/os/people`, label: t.people });
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
