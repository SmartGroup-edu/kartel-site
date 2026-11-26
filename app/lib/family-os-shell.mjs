/**
 * The Family OS app shell (bus 171, mockup v5): which sections the sidebar, the phone tab bar and the ⌘K palette show,
 * under which name, and which one is current. Pure; tested in tests/family-os-shell.test.mjs.
 *
 * The addresses stay as they were; only the names changed (no Kodeks, Council, Board, Week or Access on screen).
 * A section appears only when its page exists for this viewer — the same rules as the old sub-nav (family-nav.mjs):
 * Задачи, Календарь and Решения are for family members; «Доступ и безопасность» for the owner; the heritage editor
 * for the owner and an editor. No dead links.
 */
const L = {
  RU: {
    today: "Сегодня", board: "Задачи", calendar: "Календарь", council: "Решения",
    people: "Люди", kodeks: "Документы и правила", heritage: "Наследие",
    access: "Доступ и безопасность", admin: "Редактор наследия",
    family: "Семья", settings: "Управление", nav: "Разделы семьи", tabs: "Главные разделы",
  },
  EN: {
    today: "Today", board: "Tasks", calendar: "Calendar", council: "Decisions",
    people: "People", kodeks: "Documents and rules", heritage: "Heritage",
    access: "Access and security", admin: "Heritage editor",
    family: "Family", settings: "Settings", nav: "Family sections", tabs: "Main sections",
  },
};

/** Section id → address under /[lang]/family. `week` has no menu item of its own: it is reached from Календарь. */
export const OS_PATHS = {
  today: "/os", board: "/os/board", calendar: "/os/calendar", council: "/os/council", people: "/os/people",
  kodeks: "/os/kodeks", access: "/os/access", heritage: "", admin: "/admin",
};

/**
 * @param {{ lang: "EN" | "RU", admin: boolean, os: boolean, editor?: boolean, member?: boolean, badges?: { board?: number } }} o
 *   `os`: the viewer is in Family OS (a member, or the owner); `member`: a family member (false for the owner who is not
 *   one — no Задачи, Календарь, Решения); `admin`: the owner; `editor`: a heritage editor.
 * @returns {{ groups: { id: "main" | "family" | "settings", label: string | null, items: ShellItem[] }[], tabs: ShellItem[], label: string, tabsLabel: string }}
 * @typedef {{ id: keyof typeof OS_PATHS, href: string, label: string, badge?: number }} ShellItem
 */
export function osShellNav({ lang, admin, os, editor = false, member = true, badges = {} }) {
  const t = L[lang], base = `/${lang === "EN" ? "en" : "ru"}/family`;
  /** @param {keyof typeof OS_PATHS} id */
  const item = (id) => {
    const x = { id, href: `${base}${OS_PATHS[id]}`, label: t[id] };
    const n = badges[id];
    return Number.isInteger(n) && n > 0 ? { ...x, badge: n } : x;
  };
  const main = [], family = [], settings = [];
  if (os) {
    main.push(item("today"));
    if (member) main.push(item("board"), item("calendar"), item("council"));
    family.push(item("people"));
    if (member) family.push(item("kodeks"));
  }
  family.push(item("heritage"));
  if (admin && os) settings.push(item("access"));
  if (admin || editor) settings.push(item("admin"));
  const groups = [
    { id: "main", label: null, items: main },
    { id: "family", label: t.family, items: family },
    { id: "settings", label: t.settings, items: settings },
  ].filter((g) => g.items.length > 0);
  return { groups, tabs: main, label: t.nav, tabsLabel: t.tabs };
}

/**
 * The current section for an address. /os/week belongs to Календарь, a person's page to Люди.
 * @param {string} pathname @returns {keyof typeof OS_PATHS | null}
 */
export function activeOsSection(pathname) {
  const m = /^\/(?:en|ru)\/family(\/.*)?$/.exec(String(pathname ?? "").replace(/\/+$/, ""));
  if (!m) return null;
  const rest = m[1] ?? "";
  if (rest === "") return "heritage";
  if (rest === "/admin" || rest.startsWith("/admin/")) return "admin";
  if (rest === "/os") return "today";
  const seg = /^\/os\/([a-z]+)/.exec(rest)?.[1];
  if (seg === "week") return "calendar";
  return seg && seg in OS_PATHS && seg !== "heritage" && seg !== "admin" && seg !== "today" ? /** @type {keyof typeof OS_PATHS} */ (seg) : null;
}

/** ⌘K: navigation and search over the sections only (phase 1). Case- and ё-insensitive, matches any word start or substring. */
export function searchSections(items, query) {
  const norm = (s) => String(s ?? "").toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
  const q = norm(query);
  return q ? items.filter((x) => norm(x.label).includes(q)) : items;
}

/** Open tasks for the «Задачи» badge: new (waiting for me to accept) + accepted + in progress. Done and declined do not count. */
export function openTaskCount(myBoard) {
  if (!myBoard) return 0;
  const open = (myBoard.mine ?? []).filter((x) => x.state === "accepted" || x.state === "in_progress").length;
  return (myBoard.new ?? []).length + open;
}
