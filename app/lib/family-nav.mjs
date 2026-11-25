/**
 * The one family sub-navigation (bus 63): every family page shows the same row under the site
 * header — Heritage · Today · Board · People · Council · Calendar (+ Access and Editor for admins). Family OS items appear only when the
 * service is connected and the viewer is a member (or the admin). With a single item there is
 * nothing to navigate, so the row is hidden.
 */
const L = {
  EN: { heritage: "Heritage", today: "Today", board: "Board", people: "People", admin: "Editor", access: "Access", council: "Council", calendar: "Calendar", nav: "Family sections" },
  RU: { heritage: "Наследие", today: "Сегодня", board: "Доска", people: "Люди", admin: "Редактор", access: "Доступы", council: "Совет", calendar: "Календарь", nav: "Разделы семьи" },
};

/**
 * @param {{ lang: "EN" | "RU", admin: boolean, os: boolean, editor?: boolean, member?: boolean }} o
 * `editor` (bus 87): a family editor also sees «Редактор» — never «Доступы».
 * `member` (QA-156 L7): false for the owner who is not a family member — no Доска, Совет or Календарь (they are empty
 * for them and the edge answers 404).
 * @returns {{ id: "heritage" | "today" | "board" | "people" | "council" | "calendar" | "access" | "admin", href: string, label: string }[]}
 */
export function familySubNav({ lang, admin, os, editor = false, member = true }) {
  const base = `/${lang === "EN" ? "en" : "ru"}/family`, t = L[lang];
  const items = [{ id: "heritage", href: base, label: t.heritage }];
  if (os) {
    items.push({ id: "today", href: `${base}/os`, label: t.today });
    if (member) items.push({ id: "board", href: `${base}/os/board`, label: t.board });
    items.push({ id: "people", href: `${base}/os/people`, label: t.people });
    if (member) items.push({ id: "council", href: `${base}/os/council`, label: t.council }, { id: "calendar", href: `${base}/os/calendar`, label: t.calendar });
  }
  if (admin && os) items.push({ id: "access", href: `${base}/os/access`, label: t.access });
  if (admin || editor) items.push({ id: "admin", href: `${base}/admin`, label: t.admin });
  return items.length > 1 ? items : [];
}
export const familySubNavLabel = (lang) => L[lang].nav;

/** "Привет, Анна" — Family OS speaks «ты» to everyone in RU (bus 74 #3). Without a name, no dangling comma. */
export function greeting(lang, name) {
  const n = typeof name === "string" ? name.trim() : "";
  const safe = n && !n.includes("@") ? n : "";
  if (lang === "EN") return safe ? `Good to see you, ${safe}` : "Good to see you";
  return safe ? `Привет, ${safe}` : "Привет";
}

/** One page container for every family page, so the sub-nav and the heading column sit at the same
 *  place everywhere (bus 64: the row jumped 16 px between pages with different containers). */
export const FAMILY_MAIN = "mx-auto w-full max-w-6xl flex-1 px-4 pb-4 pt-10 sm:px-6 sm:pt-12 lg:px-10 lg:pb-6 lg:pt-20";
export const FAMILY_HEADER_MAX = "max-w-6xl";
