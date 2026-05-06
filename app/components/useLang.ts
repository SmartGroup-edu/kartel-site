"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export type Lang = "EN" | "RU";

const LOCALE_SEGMENTS = new Set(["en", "ru"]);

function buildPathForLang(pathname: string, nextLower: "en" | "ru"): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return `/${nextLower}`;
  }
  if (LOCALE_SEGMENTS.has(segments[0])) {
    segments[0] = nextLower;
  } else {
    segments.unshift(nextLower);
  }
  return "/" + segments.join("/");
}

/**
 * Returns a `toggleLang` callback that navigates between /en and /ru while
 * preserving the rest of the path (e.g. /en/family ↔ /ru/family).
 */
export function useLangToggle(currentLang: Lang) {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(() => {
    const nextLower: "en" | "ru" = currentLang === "EN" ? "ru" : "en";
    router.push(buildPathForLang(pathname || "/", nextLower));
  }, [currentLang, pathname, router]);
}
