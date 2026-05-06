"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_EVENT = "kartel-theme-change";

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "dark" ? "#1a1816" : "#876035");
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
  const stored = localStorage.getItem("kartel-theme") as Theme | null;
  return stored || "system";
}

const getThemeServerSnapshot = (): Theme => "system";

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
  const resolved: "light" | "dark" = theme === "system" ? system : theme;

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem("kartel-theme", t);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolved === "light" ? "dark" : "light");
  }, [resolved, setTheme]);

  return { theme, resolved, setTheme, toggleTheme };
}
