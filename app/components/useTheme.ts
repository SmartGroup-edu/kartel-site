"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { CONTRAST_COOKIE, THEME_COLOR, THEME_COOKIE, parseContrast, parseTheme, themeCookie } from "../lib/theme.mjs";

export type Theme = "light" | "dark" | "system";

export type Contrast = "normal" | "high";

const THEME_EVENT = "kartel-theme-change";

// bus 176 P2: both choices are cookies (app/lib/theme.mjs), so the server can render the cabinet in the chosen theme.
function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? m[1] : null;
}
function writeCookie(name: string, value: string) {
  document.cookie = themeCookie(name, value, location.protocol === "https:");
}

function applyTheme(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
}

function subscribeTheme(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function getThemeSnapshot(): Theme {
  return parseTheme(readCookie(THEME_COOKIE));
}

/** «Высокий контраст» (bus 84/97): without a stored choice, follow the OS `prefers-contrast: more`. */
function getContrastSnapshot(): Contrast {
  return parseContrast(readCookie(CONTRAST_COOKIE)) ?? (window.matchMedia("(prefers-contrast: more)").matches ? "high" : "normal");
}
const getContrastServerSnapshot = (): Contrast => "normal";

function applyContrast(c: Contrast) {
  document.documentElement.classList.toggle("hc", c === "high");
}

function subscribeSystem(callback: () => void) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSystemSnapshot(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const getSystemServerSnapshot = (): "light" | "dark" => "light";

/** `initial`: the theme the server rendered with (the cookie it read), so hydration agrees with the server HTML. */
export function useTheme(initial: Theme = "system") {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => initial);
  const system = useSyncExternalStore(
    subscribeSystem,
    getSystemSnapshot,
    getSystemServerSnapshot
  );
  const contrast = useSyncExternalStore(subscribeTheme, getContrastSnapshot, getContrastServerSnapshot);
  const resolved: "light" | "dark" = theme === "system" ? system : theme;

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);
  useEffect(() => {
    applyContrast(contrast);
  }, [contrast]);

  const setTheme = useCallback((t: Theme) => {
    writeCookie(THEME_COOKIE, t);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const setContrast = useCallback((c: Contrast) => {
    writeCookie(CONTRAST_COOKIE, c);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolved === "light" ? "dark" : "light");
  }, [resolved, setTheme]);

  return { theme, resolved, setTheme, toggleTheme, contrast, setContrast };
}
