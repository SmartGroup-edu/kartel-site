"use client";

import { useState, useEffect, useCallback } from "react";

export type Lang = "EN" | "RU";

export function useLang(defaultLang: Lang = "EN") {
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    if (urlLang === "RU" || urlLang === "EN") {
      setLang(urlLang);
    } else {
      const stored = localStorage.getItem("kartel-lang");
      if (stored === "RU" || stored === "EN") setLang(stored);
    }
    setIsReady(true);
  }, []);

  // Keep <html lang="..."> in sync with the selected language
  useEffect(() => {
    if (isReady) {
      document.documentElement.lang = lang === "RU" ? "ru" : "en";
    }
  }, [lang, isReady]);

  const toggleLang = useCallback(() => {
    const next = lang === "EN" ? "RU" : "EN";
    setLang(next);
    localStorage.setItem("kartel-lang", next);
    // Keep URL in sync so shared links preserve the language
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState({}, "", url.toString());
  }, [lang]);

  return { lang, toggleLang, isReady } as const;
}
