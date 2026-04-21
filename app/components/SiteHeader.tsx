"use client";

import { useState, useEffect } from "react";
import { useFocusTrap } from "./useFocusTrap";
import type { Lang } from "./useLang";
import ThemeToggle from "./ThemeToggle";

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

interface SiteHeaderProps {
  lang: Lang;
  toggleLang: () => void;
  navItems: NavItem[];
  maxWidth?: string;
}

export default function SiteHeader({ lang, toggleLang, navItems, maxWidth = "max-w-7xl" }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileMenuRef = useFocusTrap<HTMLDivElement>(menuOpen);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur transition-colors duration-300" role="banner">
      <div className={`mx-auto flex ${maxWidth} items-center justify-between px-4 py-4 sm:px-6 lg:px-10 lg:py-5`}>
        <a
          href={`/?lang=${lang}`}
          className="font-serif text-[24px] tracking-[0.12em] text-[var(--accent)] transition-all duration-300 hover:tracking-[0.18em] hover:opacity-90 sm:text-[28px] lg:text-[30px]"
        >
          KARTEL
        </a>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden items-center gap-5 text-xs text-[var(--text-nav)] md:flex lg:gap-8 lg:text-sm">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`nav-link rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                item.active
                  ? "font-medium text-[var(--accent)]"
                  : "hover:text-[var(--accent)]"
              }`}
              {...(item.active ? { "aria-current": "true" as const } : {})}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={toggleLang}
            aria-label={`Switch language to ${lang === "EN" ? "Russian" : "English"}`}
            className="relative h-6 w-8 overflow-hidden rounded-sm text-xs tracking-[0.2em] text-[var(--accent)] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:text-sm"
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
            className="flex flex-col gap-[5px] rounded-sm md:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span className={`block h-[2px] w-5 bg-[var(--accent)] transition-all duration-300 ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`block h-[2px] w-5 bg-[var(--accent)] transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block h-[2px] w-5 bg-[var(--accent)] transition-all duration-300 ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        ref={mobileMenuRef}
        className={`overflow-hidden border-t border-[var(--border)] transition-all duration-300 md:hidden ${menuOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0 border-t-0"}`}
        role="menu"
      >
        <nav aria-label="Mobile navigation" className={`mx-auto flex ${maxWidth} flex-col gap-4 px-4 py-5 text-sm text-[var(--text-nav)]`}>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              role="menuitem"
              className={`transition-colors hover:text-[var(--accent)] ${
                item.active ? "font-medium text-[var(--accent)]" : ""
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      {/* Screen reader announcement for language changes */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {lang === "EN" ? "Language set to English" : "Язык переключён на русский"}
      </div>
    </header>
  );
}
