/**
 * The Family OS app shell (bus 171, mockup v5): which sections the sidebar, the phone tab bar and the ⌘K palette show,
 * under which name, and which one is current. Pure; tested in tests/family-os-shell.test.mjs.
 *
 * The addresses stay as they were; only the names changed (no Kodeks, Council, Board, Week or Access on screen).
 * A section appears only when its page exists for this viewer — the same rules as the old sub-nav (family-nav.mjs):
 * Задачи, Календарь and Решения are for family members; «Доступ и безопасность» for the owner; the heritage editor
 * for the owner and an editor. No dead links.
 *
 * bus 172 P6: «Обзор недели» (members; built from the week's task boards) joins the main group, after «Решения»; the
 * phone tab bar keeps the first four. «Компании и проекты» (the registry's projects, no Family OS data) sits in its own
 * «Бизнес» group, for everyone in Family OS (a member, or the owner).
 *
 * A child (bus 172 P3) gets two sections only: «Мой день» (the /os address) and «Календарь». The other Family OS pages
 * send a child back to «Мой день» on the server (childHome in app/lib/family-child.ts), so this menu is the whole map.
 */
const L = {
  RU: {
    today: "Сегодня", myDay: "Мой день", board: "Задачи", calendar: "Календарь", council: "Решения", review: "Обзор недели",
    companies: "Компании и проекты", business: "Бизнес",
    people: "Люди", kodeks: "Документы и правила", heritage: "Наследие",
    access: "Доступ и безопасность", admin: "Редактор наследия",
    family: "Семья", settings: "Управление", nav: "Разделы семьи", tabs: "Главные разделы",
  },
  EN: {
    today: "Today", myDay: "My day", board: "Tasks", calendar: "Calendar", council: "Decisions", review: "Weekly review",
    companies: "Companies and projects", business: "Business",
    people: "People", kodeks: "Documents and rules", heritage: "Heritage",
    access: "Access and security", admin: "Heritage editor",
    family: "Family", settings: "Settings", nav: "Family sections", tabs: "Main sections",
  },
};

/** Section id → address under /[lang]/family. `week` has no menu item of its own: it is reached from Календарь. */
export const OS_PATHS = {
  today: "/os", board: "/os/board", calendar: "/os/calendar", council: "/os/council", review: "/os/review", people: "/os/people",
  companies: "/os/companies",
  kodeks: "/os/kodeks", access: "/os/access", heritage: "", admin: "/admin",
};

/**
 * @param {{ lang: "EN" | "RU", admin: boolean, os: boolean, editor?: boolean, member?: boolean, child?: boolean, badges?: { board?: number } }} o
 *   `os`: the viewer is in Family OS (a member, or the owner); `member`: a family member (false for the owner who is not
 *   one — no Задачи, Календарь, Решения); `admin`: the owner; `editor`: a heritage editor; `child`: a child member —
 *   «Мой день» and «Календарь», nothing else.
 * @returns {{ groups: { id: "main" | "family" | "business" | "settings", label: string | null, items: ShellItem[] }[], tabs: ShellItem[], label: string, tabsLabel: string }}
 * @typedef {{ id: keyof typeof OS_PATHS, href: string, label: string, badge?: number }} ShellItem
 */
export function osShellNav({ lang, admin, os, editor = false, member = true, child = false, badges = {} }) {
  const t = L[lang], base = `/${lang === "EN" ? "en" : "ru"}/family`;
  if (child && os && member) {
    const tabs = [{ id: "today", href: `${base}${OS_PATHS.today}`, label: t.myDay }, { id: "calendar", href: `${base}${OS_PATHS.calendar}`, label: t.calendar }];
    return { groups: [{ id: "main", label: null, items: tabs }], tabs, label: t.nav, tabsLabel: t.tabs };
  }
  /** @param {keyof typeof OS_PATHS} id */
  const item = (id) => {
    const x = { id, href: `${base}${OS_PATHS[id]}`, label: t[id] };
    const n = badges[id];
    return Number.isInteger(n) && n > 0 ? { ...x, badge: n } : x;
  };
  const main = [], family = [], business = [], settings = [];
  if (os) {
    main.push(item("today"));
    if (member) main.push(item("board"), item("calendar"), item("council"), item("review"));
    family.push(item("people"));
    if (member) family.push(item("kodeks"));
    business.push(item("companies"));
  }
  family.push(item("heritage"));
  if (admin && os) settings.push(item("access"));
  if (admin || editor) settings.push(item("admin"));
  const groups = [
    { id: "main", label: null, items: main },
    { id: "family", label: t.family, items: family },
    { id: "business", label: t.business, items: business },
    { id: "settings", label: t.settings, items: settings },
  ].filter((g) => g.items.length > 0);
  return { groups, tabs: main.slice(0, 4), label: t.nav, tabsLabel: t.tabs };
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

/**
 * bus 172 P3: may a child open this family address? Their Family OS is «Мой день» (/os), «Календарь» (/os/calendar)
 * and their own person page; every other /os page is closed to them, and so is the heritage page (bus 173). Other
 * addresses outside Family OS (sign-in, pending, the 404) are not decided here. Used by the edge gate (proxy.ts) for a real redirect, before any page renders.
 * @param {string} pathname @param {string | null} ownId
 */
export function childMayOpenPath(pathname, ownId) {
  const p = String(pathname ?? "").replace(/\/+$/, "");
  // bus 173: the heritage page (/{lang}/family) is not in a child's menu, and its address is closed to them too.
  if (/^\/(?:en|ru)\/family$/.test(p)) return false;
  const m = /^\/(?:en|ru)\/family\/os(\/.*)?$/.exec(p);
  if (!m) return true;
  const rest = m[1] ?? "";
  if (rest === "" || rest === "/calendar") return true;
  return Boolean(ownId) && rest === `/people/${ownId}`;
}

/** Open tasks for the «Задачи» badge: new (waiting for me to accept) + accepted + in progress. Done and declined do not count. */
export function openTaskCount(myBoard) {
  if (!myBoard) return 0;
  const open = (myBoard.mine ?? []).filter((x) => x.state === "accepted" || x.state === "in_progress").length;
  return (myBoard.new ?? []).length + open;
}
