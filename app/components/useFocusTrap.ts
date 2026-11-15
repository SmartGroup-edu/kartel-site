"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Traps keyboard focus within a container element when active.
 * Returns a ref to attach to the container.
 *
 * `initialFocus: "container"` focuses the container itself (it needs tabIndex={-1}) instead of
 * its first item — for a menu opened by touch, where a focused first item reads as "selected"
 * (cycle 6 #3). Tab still moves straight into the items.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  { initialFocus = "first" }: { initialFocus?: "first" | "container" } = {},
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const container = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the container, or the first focusable element
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (initialFocus === "container") {
      container.focus({ preventScroll: true });
    } else if (focusables.length > 0) {
      focusables[0].focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const els = container.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (els.length === 0) return;

      const first = els[0];
      const last = els[els.length - 1];

      if (document.activeElement === container) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", onKeyDown);

    return () => {
      container.removeEventListener("keydown", onKeyDown);
      // Restore focus when trap deactivates
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active, initialFocus]);

  return ref;
}
