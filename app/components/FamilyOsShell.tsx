"use client";

/**
 * The Family OS app shell (bus 171, mockup v5 approved by R0 26.11): a light 248 px sidebar on desktop (brand, «Поиск и
 * команды ⌘K», the sections in four groups, the viewer with theme, language and sign-out), and below 900 px a top bar
 * plus a bottom tab bar (Сегодня · Задачи · Календарь · Решения); the other sections open from the top bar's menu.
 * Rendered once by app/[lang]/family/os/layout.tsx around every Family OS page. Which sections exist is decided on the
 * server (osShellNav); this file only draws them. ⌘K is navigation and search over the sections, plus the theme
 * commands «Тема: светлая / тёмная / как в системе» (bus 176 P2). `theme` is the cookie the server read: the shell
 * carries it as data-theme, so the first HTML is already in the chosen theme (app/globals.css).
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookMarked, Briefcase, CalendarDays, Check, ClipboardCheck, FileText, Landmark, Lock, LogOut, Menu, Monitor, Moon, PenLine, Scale, Search, SquareCheckBig, Sun, Users, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import ThemeToggle from "./ThemeToggle";
import { useTheme, type Theme } from "./useTheme";
import SkipToContent from "./SkipToContent";
import { useLangToggle } from "./useLang";
import { osShellNav, activeOsSection, searchSections } from "../lib/family-os-shell.mjs";
import { tx } from "../lib/typograph.mjs";

type Lang = "EN" | "RU";
type SectionId = "today" | "board" | "calendar" | "council" | "review" | "companies" | "registry" | "people" | "kodeks" | "heritage" | "access" | "admin";
type Item = { id: SectionId; href: string; label: string; badge?: number };
/** A ⌘K command (not a section): sets the theme. */
type Cmd = { id: `theme-${Theme}`; label: string; theme: Theme };
export type OsShellNav = { admin: boolean; editor: boolean; os: boolean; member: boolean; child?: boolean };
/** `id`: the viewer's own person page (their keys and letters) — the name in the user block opens it. */
export type OsShellMe = { name: string | null; id?: string | null; role: "owner" | "editor" | "member" | "child" };

const ICON: Record<SectionId, LucideIcon> = {
  today: Sun, board: SquareCheckBig, calendar: CalendarDays, council: Scale, review: ClipboardCheck, companies: Briefcase, registry: BookMarked, people: Users, kodeks: FileText,
  heritage: Landmark, access: Lock, admin: PenLine,
};

const T = {
  RU: {
    brand: "Семейный офис", search: "Поиск и команды", searchShort: "Поиск по разделам", menu: "Меню разделов",
    paletteTitle: "Перейти к разделу", paletteHint: "Начни вводить раздел или команду", noMatch: "Такого раздела или команды нет.",
    commands: "Команды", current: "выбрана",
    theme: { light: "Тема: светлая", dark: "Тема: тёмная", system: "Тема: как в системе" },
    close: "Закрыть", signOut: "Выйти", lang: "EN — переключить язык на английский", langShort: "EN",
    role: { owner: "Владелец", editor: "Редактор", member: "Член семьи", child: "Ребёнок" }, badge: (n: number) => `открытых задач: ${n}`,
    myPage: (n: string) => `${n} — моя страница`,
  },
  EN: {
    brand: "Family office", search: "Search and commands", searchShort: "Search sections", menu: "Sections menu",
    paletteTitle: "Go to a section", paletteHint: "Start typing a section or a command", noMatch: "No such section or command.",
    commands: "Commands", current: "current",
    theme: { light: "Theme: light", dark: "Theme: dark", system: "Theme: match system" },
    close: "Close", signOut: "Sign out", lang: "RU — switch language to Russian", langShort: "RU",
    role: { owner: "Owner", editor: "Editor", member: "Family member", child: "Child" }, badge: (n: number) => `open tasks: ${n}`,
    myPage: (n: string) => `${n} — my page`,
  },
} as const;

function Logo() {
  return <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-[#1a1a1a] font-serif text-[17px] font-bold text-[#b08d57] ring-1 ring-[#b08d57]/40">K</span>;
}

function Badge({ n, lang }: { n: number; lang: Lang }) {
  return (
    <span data-badge="" className="ml-auto inline-grid min-w-6 place-items-center rounded-full bg-[var(--fos-accent-2)] px-[7px] text-[12px] font-semibold leading-5 text-[var(--fos-on-accent-2)]">
      <span className="sr-only">{tx(T, lang).badge(n)}</span><span aria-hidden="true">{n}</span>
    </span>
  );
}

function NavList({ groups, active, lang, onPick }: { groups: { id: string; label: string | null; items: Item[] }[]; active: SectionId | null; lang: Lang; onPick?: () => void }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.id} data-nav-group={g.id}>
          {g.label && <p className="px-3 pb-1.5 pt-3.5 text-[12px] font-medium uppercase tracking-[0.09em] text-[var(--muted)]">{g.label}</p>}
          <ul className="grid gap-0.5">
            {g.items.map((x) => {
              const Icon = ICON[x.id], on = x.id === active;
              return (
                <li key={x.id}>
                  <Link prefetch={false} href={x.href} onClick={onPick} aria-current={on ? "page" : undefined} data-nav-item={x.id}
                    className={`flex min-h-10 w-full items-center gap-[11px] rounded-[9px] px-3 py-2 text-[14px] transition-colors ${on ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)] shadow-[inset_3px_0_0_var(--fos-accent-2)]" : "text-[var(--text-secondary)] hover:bg-[var(--fos-panel-2)]"}`}>
                    <Icon aria-hidden="true" className="h-[17px] w-[17px] flex-none" strokeWidth={1.8} />
                    <span className="min-w-0 truncate">{x.label}</span>
                    {x.badge ? <Badge n={x.badge} lang={lang} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

function MeBlock({ me, lang, theme }: { me: OsShellMe; lang: Lang; theme: Theme }) {
  const t = tx(T, lang), toggleLang = useLangToggle(lang);
  const initial = (me.name?.trim().charAt(0) || "·").toLocaleUpperCase("ru");
  return (
    // The name and role keep at least 140 px: when the controls do not fit beside them (the 248 px sidebar), the
    // controls wrap to a row of their own, right-aligned. `relative`: the theme menu opens above the whole block.
    <div data-me="" className="relative flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--border)] pt-3">
      <span aria-hidden="true" className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-[var(--fos-accent-2)] text-[12px] font-semibold text-[var(--fos-on-accent-2)]">{initial}</span>
      <div className="min-w-0 flex-1 basis-[140px]">
        {me.name && (me.id
          ? <Link prefetch={false} href={`/${lang === "EN" ? "en" : "ru"}/family/os/people/${me.id}`} data-me-link="" aria-label={t.myPage(me.name)} className="block min-h-6 truncate rounded-sm text-[13px] leading-6 font-semibold text-[var(--foreground)] underline decoration-transparent underline-offset-4 hover:decoration-[var(--accent)]">{me.name}</Link>
          : <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{me.name}</p>)}
        <p className="truncate text-[12px] text-[var(--muted)]">{t.role[me.role]}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle placement="up" initial={theme} />
        <button type="button" onClick={toggleLang} aria-label={t.lang} className="inline-flex h-11 w-9 items-center justify-center rounded-md text-[13px] font-semibold text-[var(--accent)] hover:opacity-80">{t.langShort}</button>
        <form method="post" action="/api/family-auth/logout" className="contents">
          <button type="submit" aria-label={t.signOut} title={t.signOut} className="inline-flex h-11 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--foreground)]">
            <LogOut aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </form>
      </div>
    </div>
  );
}

const CMD_ICON: Record<Theme, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

/** ⌘K: a combobox over the sections, then the theme commands. Arrow keys move, Enter opens or runs, Escape closes
 *  (Radix returns the focus). */
function Palette({ open, setOpen, items, lang, theme, setTheme }: { open: boolean; setOpen: (o: boolean) => void; items: Item[]; lang: Lang; theme: Theme; setTheme: (t: Theme) => void }) {
  const t = tx(T, lang), router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const commands: Cmd[] = (["light", "dark", "system"] as const).map((v) => ({ id: `theme-${v}`, label: t.theme[v], theme: v }));
  const found = [...(searchSections(items, q) as Item[]), ...(searchSections(commands, q) as Cmd[])];
  const go = (x: Item | Cmd | undefined) => {
    if (!x) return;
    // Closing from here bypasses onOpenChange: clear the query too, so the next ⌘K starts empty.
    setOpen(false); setQ(""); setI(0);
    if ("theme" in x) setTheme(x.theme); else router.push(x.href);
  };
  // The list scrolls (sections plus the theme commands do not fit a laptop screen): keep the active row in view.
  const activeId = found[i]?.id;
  useEffect(() => { if (activeId) document.getElementById(`fos-pal-${activeId}`)?.scrollIntoView({ block: "nearest" }); }, [activeId]);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQ(""); setI(0); } }}>
      <DialogContent closeLabel={t.close} className="top-[18%] max-w-md translate-y-0 gap-3 rounded-[var(--fos-radius)] border-[var(--border)] bg-[var(--fos-panel)] p-4 shadow-[var(--fos-shadow-lg)]">
        <DialogTitle className="text-[17px] font-semibold">{t.paletteTitle}</DialogTitle>
        <DialogDescription className="sr-only">{t.paletteHint}</DialogDescription>
        <input autoFocus role="combobox" aria-expanded="true" aria-controls="fos-palette-list" aria-autocomplete="list"
          aria-activedescendant={found[i] ? `fos-pal-${found[i].id}` : undefined} aria-label={t.paletteHint} placeholder={t.paletteHint}
          value={q} onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => Math.min(n + 1, found.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); go(found[i]); }
          }}
          className="min-h-11 w-full rounded-[10px] border border-[var(--fos-control)] bg-[var(--fos-panel-2)] px-3 text-[15px] text-[var(--foreground)] placeholder:text-[var(--muted)]" />
        <ul id="fos-palette-list" role="listbox" aria-label={t.paletteTitle} className="-mx-1 grid max-h-[min(28rem,calc(78dvh-7rem))] gap-0.5 overflow-y-auto overscroll-contain px-1">
          {found.length === 0 && <li role="presentation" className="px-3 py-3 text-[14px] text-[var(--muted)]">{t.noMatch}</li>}
          {found.map((x, n) => {
            const cmd = "theme" in x, Icon = cmd ? CMD_ICON[x.theme] : ICON[x.id], on = cmd && x.theme === theme;
            const first = cmd && (n === 0 || !("theme" in found[n - 1]));
            return (
              <li key={x.id} id={`fos-pal-${x.id}`} role="option" aria-selected={n === i} onMouseEnter={() => setI(n)} onClick={() => go(x)} data-cmd={cmd ? x.id : undefined}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[9px] px-3 text-[15px] ${first && n > 0 ? "mt-1.5 border-t border-[var(--border)]" : ""} ${n === i ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--foreground)]"}`}>
                <Icon aria-hidden="true" className="h-[17px] w-[17px] flex-none" strokeWidth={1.8} />{x.label}
                {on && <><span className="sr-only">, {t.current}</span><Check aria-hidden="true" className="ml-auto h-4 w-4 flex-none text-[var(--fos-gold-line)]" strokeWidth={2.4} /></>}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export default function FamilyOsShell({ lang, nav, badges, me, theme: serverTheme = "system", children }: { lang: Lang; nav: OsShellNav; badges: { board?: number }; me: OsShellMe; theme?: Theme; children: React.ReactNode }) {
  const t = tx(T, lang);
  const { theme, setTheme } = useTheme(serverTheme);
  const pathname = usePathname() ?? "";
  const active = activeOsSection(pathname) as SectionId | null;
  const { groups, tabs, label, tabsLabel } = useMemo(() => osShellNav({ lang, ...nav, badges }), [lang, nav, badges]);
  const all = useMemo(() => groups.flatMap((g) => g.items as Item[]), [groups]);
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const home = `/${lang === "EN" ? "en" : "ru"}/family/os`;

  // Dialogs render in a portal under <body>: the Family OS tokens must reach them too, so <body> carries the scope
  // while a Family OS page is open.
  useEffect(() => {
    document.body.setAttribute("data-fos", "");
    return () => { document.body.removeAttribute("data-fos"); document.body.removeAttribute("data-theme"); };
  }, []);
  useEffect(() => { document.body.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setMenu(false); setPalette((o) => !o); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchBtn = (
    <button type="button" onClick={() => setPalette(true)} aria-keyshortcuts="Meta+K Control+K" data-cmdk=""
      className="mx-1 mb-2.5 flex min-h-10 items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--fos-panel-2)] px-2.5 text-[13px] text-[var(--muted)] hover:border-[var(--fos-control)]">
      <Search aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />{t.search}
      <kbd className="ml-auto rounded-[5px] border border-[var(--border)] bg-[var(--fos-panel)] px-1.5 font-sans text-[11px]">⌘K</kbd>
    </button>
  );

  return (
    <div data-fos="" data-theme={theme} className="min-h-dvh bg-[var(--fos-bg)] text-[var(--foreground)]">
      <SkipToContent lang={lang} />
      <div className="min-[900px]:grid min-[900px]:grid-cols-[248px_minmax(0,1fr)]">
        <div className="hidden border-r border-[var(--border)] bg-[var(--fos-panel)] min-[900px]:block print:hidden">
        <div data-fos-sidebar="" className="sticky top-0 flex h-dvh flex-col gap-0.5 overflow-y-auto px-3 py-[18px]">
          <Link prefetch={false} href={home} className="mb-2 flex items-center gap-2.5 rounded-[10px] px-2.5 pb-3 pt-1">
            <Logo /><span><b className="block text-[13px] tracking-[0.14em] text-[var(--foreground)]">KARTEL</b><small className="block text-[12px] text-[var(--muted)]">{t.brand}</small></span>
          </Link>
          {searchBtn}
          <nav aria-label={label} className="grid gap-0.5"><NavList groups={groups} active={active} lang={lang} /></nav>
          <div className="mt-auto pt-3"><MeBlock me={me} lang={lang} theme={theme} /></div>
        </div>
        </div>

        <div className="min-w-0">
          <header data-fos-topbar="" className="sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--fos-panel)] px-4 py-2 min-[900px]:hidden print:hidden">
            <Link prefetch={false} href={home} className="flex items-center gap-2 rounded-[10px] py-1"><Logo /><b className="text-[13px] tracking-[0.14em]">KARTEL</b></Link>
            <button type="button" onClick={() => setPalette(true)} aria-label={t.searchShort} className="ml-auto grid h-11 w-11 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--fos-panel)] text-[var(--text-secondary)]">
              <Search aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
            <button type="button" onClick={() => setMenu(true)} aria-label={t.menu} aria-haspopup="dialog" className="grid h-11 w-11 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--fos-panel)] text-[var(--text-secondary)]">
              <Menu aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </header>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-5 outline-none min-[640px]:px-5 min-[900px]:px-10 min-[900px]:pb-16 min-[900px]:pt-7 print:p-0">
            {children}
          </main>
        </div>
      </div>

      {tabs.length > 1 && (
        <nav aria-label={tabsLabel} data-fos-tabbar="" className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--fos-panel)] pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 min-[900px]:hidden print:hidden">
          <ul className="flex justify-around">
            {tabs.map((x: Item) => {
              const Icon = ICON[x.id], on = x.id === active;
              return (
                <li key={x.id}>
                  <Link prefetch={false} href={x.href} aria-current={on ? "page" : undefined} data-tab={x.id}
                    className={`relative flex min-h-12 min-w-16 flex-col items-center justify-center gap-[3px] rounded-[10px] px-2 text-[12px] ${on ? "font-semibold text-[var(--accent)] shadow-[inset_0_3px_0_var(--fos-accent-2)]" : "text-[var(--muted)]"}`}>
                    <Icon aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={1.8} />
                    {x.label}
                    {x.badge ? <span className="absolute right-2 top-0.5 inline-grid min-w-5 place-items-center rounded-full bg-[var(--fos-accent-2)] px-1 text-[11px] font-semibold leading-[18px] text-[var(--fos-on-accent-2)]"><span className="sr-only">{t.badge(x.badge)}</span><span aria-hidden="true">{x.badge}</span></span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <Dialog open={menu} onOpenChange={setMenu}>
        <DialogContent closeLabel={t.close} className="left-auto right-0 top-0 h-dvh max-w-[320px] translate-x-0 translate-y-0 content-start gap-1 overflow-y-auto rounded-none border-0 border-l border-[var(--border)] bg-[var(--fos-panel)] px-3 py-5">
          <DialogTitle className="px-2.5 pb-2 text-[17px] font-semibold">{label}</DialogTitle>
          <DialogDescription className="sr-only">{t.brand}</DialogDescription>
          <nav aria-label={label} className="grid gap-0.5"><NavList groups={groups} active={active} lang={lang} onPick={() => setMenu(false)} /></nav>
          <div className="mt-4"><MeBlock me={me} lang={lang} theme={theme} /></div>
        </DialogContent>
      </Dialog>
      <Palette open={palette} setOpen={setPalette} items={all} lang={lang} theme={theme} setTheme={setTheme} />
    </div>
  );
}
