"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

export type Contrast = "normal" | "high";

const THEME_EVENT = "kartel-theme-change";
const CONTRAST_KEY = "kartel-contrast";

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "dark" ? "#1a1816" : "#ffffff");
  }
}

function subscribeTheme(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getThemeSnapshot(): Theme {
  try {
    const stored = localStorage.getItem("kartel-theme");
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {}
  return "system";
}

const getThemeServerSnapshot = (): Theme => "system";

/** «Высокий контраст» (bus 84/97): per device. Without a stored choice, follow the OS `prefers-contrast: more`. */
function getContrastSnapshot(): Contrast {
  try {
    const stored = localStorage.getItem(CONTRAST_KEY);
    if (stored === "high" || stored === "normal") return stored;
  } catch {}
  return window.matchMedia("(prefers-contrast: more)").matches ? "high" : "normal";
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

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );
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
    try { localStorage.setItem("kartel-theme", t); } catch {}
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const setContrast = useCallback((c: Contrast) => {
    try { localStorage.setItem(CONTRAST_KEY, c); } catch {}
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolved === "light" ? "dark" : "light");
  }, [resolved, setTheme]);

  return { theme, resolved, setTheme, toggleTheme, contrast, setContrast };
}
