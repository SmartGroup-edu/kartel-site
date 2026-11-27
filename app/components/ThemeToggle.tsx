"use client";

// Theme menu (bus 84/97 item 2; bus 176 P2): Светлая / Тёмная / Как в системе + «Высокий контраст» (AAA tokens).
// Both choices are stored per browser in cookies (app/lib/theme.mjs), applied before paint by the boot script in the
// layout and, in the Family OS, already in the server HTML.
import { useEffect, useId, useRef, useState } from "react";
import { useTheme, type Theme } from "./useTheme";
import { useUiLang } from "./useLang";

const L = {
  ru: { on: "включён высокий контраст", open: "Тема оформления", light: "Светлая", dark: "Тёмная", system: "Как в системе", hc: "Высокий контраст" },
  en: { on: "high contrast on", open: "Appearance", light: "Light", dark: "Dark", system: "Match system", hc: "High contrast" },
} as const;

const item =
  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] text-[var(--foreground)] hover:bg-[var(--surface)] focus-visible:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]";

function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--accent)]">
      {on && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      )}
    </span>
  );
}

/** `placement`: "up" opens the menu above the button (the Family OS sidebar keeps it at the bottom of the screen). */
export default function ThemeToggle({ placement = "down", initial }: { placement?: "down" | "up"; initial?: Theme } = {}) {
  const { theme, resolved, setTheme, contrast, setContrast } = useTheme(initial);
  const t = L[useUiLang() === "ru" ? "ru" : "en"];
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role^=menuitem][aria-checked=true]")?.focus();
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = () => { setOpen(false); btn.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };

  const radios: [Theme, string][] = [["light", t.light], ["dark", t.dark], ["system", t.system]];
  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        data-theme-menu=""
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={contrast === "high" ? `${t.open} · ${t.on}` : t.open}
        data-hc={contrast === "high" ? "" : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--accent)] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {resolved === "light" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        )}
        {/* bus 101: high contrast is visible with the menu closed — a small half-filled disc on the button */}
        {contrast === "high" && (
          <svg data-hc-mark="" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="absolute bottom-1.5 right-1.5">
            <circle cx="5" cy="5" r="4" fill="var(--background)" stroke="currentColor" strokeWidth="1.5" /><path d="M5 1a4 4 0 0 1 0 8z" fill="currentColor" />
          </svg>
        )}
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={t.open}
          onKeyDown={onKey}
          className={`absolute z-50 w-56 rounded-lg border ${placement === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"} border-[var(--border)] bg-[var(--background)] p-1 shadow-lg`}
        >
          {radios.map(([v, label]) => (
            <button key={v} type="button" role="menuitemradio" aria-checked={theme === v} tabIndex={-1} className={item} onClick={() => { setTheme(v); close(); }}>
              <Check on={theme === v} />{label}
            </button>
          ))}
          <div role="separator" className="my-1 border-t border-[var(--border)]" />
          <button type="button" role="menuitemcheckbox" aria-checked={contrast === "high"} tabIndex={-1} className={item} onClick={() => { setContrast(contrast === "high" ? "normal" : "high"); close(); }}>
            <Check on={contrast === "high"} />{t.hc}
          </button>
        </div>
      )}
    </div>
  );
}
