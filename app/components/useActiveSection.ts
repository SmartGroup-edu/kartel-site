"use client";

import { useState, useEffect } from "react";

/**
 * Returns the id of the section currently most visible in the viewport.
 * Uses IntersectionObserver with a rootMargin that accounts for the sticky header.
 */
export function useActiveSection(sectionIds: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const entries = new Map<string, IntersectionObserverEntry>();

    const observer = new IntersectionObserver(
      (observed) => {
        for (const entry of observed) {
          entries.set(entry.target.id, entry);
        }

        // Find the topmost visible section
        let topId: string | null = null;
        let topY = Infinity;
        for (const [id, entry] of entries) {
          if (entry.isIntersecting && entry.boundingClientRect.top < topY) {
            topY = entry.boundingClientRect.top;
            topId = id;
          }
        }
        if (topId) setActive(topId);
      },
      {
        rootMargin: "-80px 0px -40% 0px",
        threshold: [0, 0.25],
      }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  return active;
}
