"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFocusTrap } from "./useFocusTrap";
import type { Lang } from "./useLang";
import ThemeToggle from "./ThemeToggle";
import SkipToContent from "./SkipToContent";
import { primaryNav, activeHref, type NavItem as SiteNavItem } from "../content/siteNav";

interface NavItem extends SiteNavItem {
  /** Only for in-page (#anchor) navigation, where the URL cannot tell which item is current. */
  active?: boolean;
}

interface SiteHeaderProps {
  lang: Lang;
  toggleLang: () => void;
  /** Defaults to the one site-wide menu. Family pages pass their own in-page anchors. */
  navItems?: NavItem[];
  /** Optional second row for a section (e.g. the registry's sub-pages). */
  subNav?: SiteNavItem[];
  /** Accessible name for the second row; defaults to the registry's. */
  subNavLabel?: string;
  maxWidth?: string;
}

export default function SiteHeader({ lang, toggleLang, navItems, subNav, subNavLabel, maxWidth = "max-w-7xl" }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileMenuRef = useFocusTrap<HTMLDivElement>(menuOpen);
  const pathname = usePathname() ?? "";

  const items: NavItem[] = navItems ?? primaryNav(lang);
  const urlActive = activeHref(items, pathname);
  const isActive = (i: NavItem) => i.active ?? i.href === urlActive;
  const subActiveByUrl = subNav ? activeHref(subNav, pathname) : null;

  // In-page section rows (#anchors, e.g. the crest home) get their current item from scrolling:
  // the section crossing the reading line is current (design pass #10). URL rows keep activeHref.
  const anchorIds = subNav?.every((s) => s.href.startsWith("#")) ? subNav.map((s) => s.href.slice(1)) : null;
  const [inView, setInView] = useState<string | null>(anchorIds?.[0] ?? null);
  const anchorKey = anchorIds?.join(",") ?? "";
  useEffect(() => {
    if (!anchorKey) return;
    const ids = anchorKey.split(",");
    // Current = the last section whose top has passed 40% of the viewport. Computed on scroll (not
    // only on intersection), so a jump via an anchor link still lands on the right item.
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.4;
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) cur = id;
      }
      setInView(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [anchorKey]);
  const subActive = anchorIds ? (inView ? `#${inView}` : null) : subActiveByUrl;
  const subCurrent = anchorIds ? ("true" as const) : ("page" as const);

  // Mobile (<768px): the section row hides while scrolling down and returns on scroll up, so the
  // sticky chrome stays small (UI/UX audit 2026-11-14 #3). The row is absolutely positioned under
  // the header on mobile and a spacer keeps its height in the flow, so hiding never shifts content.
  const [subHidden, setSubHidden] = useState(false);
  useEffect(() => {
    if (!subNav) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > last + 6 && y > 120) setSubHidden(true);
      else if (y < last - 6 || y <= 120) setSubHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [subNav]);
  const hideSub = subHidden || menuOpen;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <SkipToContent lang={lang} />
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur transition-colors duration-300">
        <div className={`mx-auto flex ${maxWidth} items-center justify-between px-4 py-4 sm:px-6 lg:px-10 lg:py-5`}>
          <a
            href={`/${lang.toLowerCase()}`}
            className="rounded-sm font-serif text-[24px] tracking-[0.12em] text-[var(--accent)] transition-opacity duration-200 hover:opacity-80 sm:text-[28px] lg:text-[30px]"
          >
            KARTEL
          </a>

          {/* Desktop nav */}
          <nav aria-label={lang === "RU" ? "Основная навигация" : "Main navigation"} className="hidden items-center gap-5 text-[15px] text-[var(--text-nav)] md:flex lg:gap-8">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`nav-link rounded-sm py-1 transition-colors ${
                  isActive(item) ? "font-medium text-[var(--accent)]" : "hover:text-[var(--accent)]"
                }`}
                {...(isActive(item) ? { "aria-current": "page" as const } : {})}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={toggleLang}
              aria-label={lang === "EN" ? "Switch language to Russian" : "Переключить язык на английский"}
              className="relative h-8 w-9 overflow-hidden rounded-sm text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
            >
              <span
                key={lang}
                className="absolute inset-0 flex items-center justify-center animate-[langFade_0.3s_ease-in-out]"
              >
                {lang === "EN" ? "RU" : "EN"}
              </span>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 flex-col items-center justify-center gap-[5px] rounded-sm md:hidden"
              aria-label={menuOpen ? (lang === "RU" ? "Закрыть меню" : "Close menu") : lang === "RU" ? "Открыть меню" : "Open menu"}
              aria-expanded={menuOpen}
            >
              <span className={`block h-[2px] w-5 bg-[var(--accent)] transition-transform duration-300 ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
              <span className={`block h-[2px] w-5 bg-[var(--accent)] transition-opacity duration-300 ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-[2px] w-5 bg-[var(--accent)] transition-transform duration-300 ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          ref={mobileMenuRef}
          className={`overflow-hidden border-t border-[var(--border)] transition-all duration-300 md:hidden ${menuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0 border-t-0"}`}
          role="menu"
        >
          <nav aria-label={lang === "RU" ? "Мобильная навигация" : "Mobile navigation"} className={`mx-auto flex ${maxWidth} flex-col gap-1 px-4 py-3 text-base text-[var(--text-nav)]`}>
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                role="menuitem"
                className={`rounded-sm py-2 transition-colors hover:text-[var(--accent)] ${isActive(item) ? "font-medium text-[var(--accent)]" : ""}`}
                {...(isActive(item) ? { "aria-current": "page" as const } : {})}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Section sub-navigation (registry) — scrolls sideways on small screens instead of wrapping */}
        {subNav && (
          <nav
            data-section-nav=""
            aria-label={subNavLabel ?? (lang === "RU" ? "Разделы реестра" : "Registry sections")}
            className={`border-t border-[var(--border)] max-md:absolute max-md:inset-x-0 max-md:top-full max-md:h-11 max-md:border-b max-md:bg-[var(--header-bg)] max-md:backdrop-blur max-md:transition-[opacity,visibility] max-md:duration-200 motion-reduce:transition-none ${
              hideSub ? "max-md:invisible max-md:opacity-0" : ""
            }`}
          >
            <div className={`mx-auto flex ${maxWidth} gap-5 overflow-x-auto px-4 text-[15px] text-[var(--text-nav)] max-md:h-full max-md:items-center sm:px-6 lg:px-10`}>
              {subNav.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  className={`shrink-0 whitespace-nowrap border-b-2 py-2.5 transition-colors ${
                    s.href === subActive
                      ? "border-[var(--accent)] font-medium text-[var(--accent)]"
                      : "border-transparent hover:text-[var(--accent)]"
                  }`}
                  {...(s.href === subActive ? { "aria-current": subCurrent } : {})}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </nav>
        )}

        {/* Screen reader announcement for language changes */}
        <div className="sr-only" aria-live="polite" aria-atomic="true" role="status">
          {lang === "EN" ? "Language set to English" : "Язык переключён на русский"}
        </div>
      </header>
      {/* Mobile spacer for the absolutely positioned section row (same 44px height). */}
      {subNav && <div aria-hidden="true" className="h-11 md:hidden" />}
    </>
  );
}
