"use client";

import { useEffect, useCallback } from "react";

/**
 * Enables keyboard navigation between page sections.
 * Arrow Down / Page Down → next section
 * Arrow Up / Page Up → previous section
 * Home → first section
 * End → last section
 *
 * Only activates when no input/textarea/select is focused.
 */
export function useSectionKeyboard(sectionIds: string[]) {
  const scrollToSection = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Move focus to the section for screen readers
        el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
      }
    },
    []
  );

  useEffect(() => {
    if (sectionIds.length === 0) return;

    // Check reduced motion
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const getCurrentIndex = (): number => {
      const scrollY = window.scrollY + 120; // offset for sticky header
      let current = 0;
      for (let i = 0; i < sectionIds.length; i++) {
        const el = document.getElementById(sectionIds[i]);
        if (el && el.offsetTop <= scrollY) {
          current = i;
        }
      }
      return current;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Don't intercept if modifier keys are held (browser shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      let targetIdx: number | null = null;

      switch (e.key) {
        case "ArrowDown":
        case "PageDown": {
          const cur = getCurrentIndex();
          if (cur < sectionIds.length - 1) targetIdx = cur + 1;
          break;
        }
        case "ArrowUp":
        case "PageUp": {
          const cur = getCurrentIndex();
          if (cur > 0) targetIdx = cur - 1;
          break;
        }
        case "Home":
          targetIdx = 0;
          break;
        case "End":
          targetIdx = sectionIds.length - 1;
          break;
        default:
          return;
      }

      if (targetIdx !== null) {
        e.preventDefault();
        scrollToSection(sectionIds[targetIdx]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sectionIds, scrollToSection]);
}
