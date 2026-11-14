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
  maxWidth?: string;
}

export default function SiteHeader({ lang, toggleLang, navItems, subNav, maxWidth = "max-w-7xl" }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileMenuRef = useFocusTrap<HTMLDivElement>(menuOpen);
  const pathname = usePathname() ?? "";

  const items: NavItem[] = navItems ?? primaryNav(lang);
  const urlActive = activeHref(items, pathname);
  const isActive = (i: NavItem) => i.active ?? i.href === urlActive;
  const subActive = subNav ? activeHref(subNav, pathname) : null;

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
          <nav aria-label={lang === "RU" ? "Основная навигация" : "Main navigation"} className="hidden items-center gap-5 text-sm text-[var(--text-nav)] md:flex lg:gap-8">
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
            aria-label={lang === "RU" ? "Разделы реестра" : "Registry sections"}
            className="border-t border-[var(--border)]"
          >
            <div className={`mx-auto flex ${maxWidth} gap-5 overflow-x-auto px-4 text-sm text-[var(--text-nav)] sm:px-6 lg:px-10`}>
              {subNav.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  className={`shrink-0 whitespace-nowrap border-b-2 py-2.5 transition-colors ${
                    s.href === subActive
                      ? "border-[var(--accent)] font-medium text-[var(--accent)]"
                      : "border-transparent hover:text-[var(--accent)]"
                  }`}
                  {...(s.href === subActive ? { "aria-current": "page" as const } : {})}
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
    </>
  );
}
