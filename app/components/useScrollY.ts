"use client";

import { useSyncExternalStore } from "react";

let scrollY = 0;
let listeners: Set<() => void> = new Set();
let listening = false;

function onScroll() {
  scrollY = window.scrollY;
  listeners.forEach((cb) => cb());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("scroll", onScroll, { passive: true });
    listening = true;
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && listening) {
      window.removeEventListener("scroll", onScroll);
      listening = false;
    }
  };
}

function getSnapshot() {
  return scrollY;
}

function getServerSnapshot() {
  return 0;
}

/**
 * Shared scroll position hook — one event listener for all consumers.
 */
export function useScrollY(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
