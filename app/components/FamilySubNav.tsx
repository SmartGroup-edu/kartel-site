"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { familySubNav, familySubNavLabel } from "../lib/family-nav.mjs";

/**
 * The family sub-navigation, same place on every family page (directly under the site header).
 * Always one line (bus 75): on a narrow phone the tabs scroll sideways (no visible scrollbar), the
 * active tab is scrolled into view, and a fade at the right edge shows that more tabs follow. The
 * baseline is an inset shadow on the list, so the scroll container never clips the active underline.
 */
const FADE = 32; // px of fade at an edge that has more tabs behind it

/** `badge`: parents' «Нужно решение» count on the «Доска» tab (bus 84) — shown where the page already has it. */
export default function FamilySubNav({ lang, admin, os, active, badge = 0 }: { lang: "EN" | "RU"; admin: boolean; os: boolean; active: "heritage" | "today" | "board" | "people" | "council" | "calendar" | "access" | "admin"; badge?: number }) {
  const items = familySubNav({ lang, admin, os });
  const list = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  useEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const cur = ul.querySelector<HTMLElement>('[aria-current="page"]');
    // Scroll only when the active tab is clipped or under the edge fade (rects, relative to the list).
    if (cur && ul.scrollWidth > ul.clientWidth) {
      const u = ul.getBoundingClientRect(), r = cur.getBoundingClientRect();
      if (r.right > u.right - FADE) ul.scrollLeft += r.right - (u.right - FADE) + 4;
      else if (r.left < u.left + FADE && ul.scrollLeft > 0) ul.scrollLeft -= u.left + FADE - r.left + 4;
    }
    const check = () => setEdge({ left: ul.scrollLeft > 1, right: ul.scrollLeft + ul.clientWidth < ul.scrollWidth - 1 });
    check();
    ul.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => { ul.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, []);
  if (items.length === 0) return null;
  return (
    <nav aria-label={familySubNavLabel(lang)} data-family-subnav="" className="-mt-4 mb-8 sm:-mt-6 lg:-mt-12">
      <ul ref={list} data-more={edge.right ? "1" : undefined} data-more-left={edge.left ? "1" : undefined}
        style={edge.left || edge.right ? { maskImage: `linear-gradient(to right, ${edge.left ? `transparent, #000 ${FADE}px` : "#000"}, ${edge.right ? `#000 calc(100% - ${FADE}px), transparent` : "#000"})` } : undefined}
        className="flex flex-nowrap gap-x-6 overflow-x-auto whitespace-nowrap text-[16px] shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((x) => (
          <li key={x.id} className="shrink-0">
            <Link href={x.href} aria-current={x.id === active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 focus-visible:outline-offset-[-3px] ${x.id === active ? "border-[var(--accent)] font-medium text-[var(--foreground)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]"}`}>
              {x.label}
              {x.id === "board" && badge > 0 && <span data-badge="" className="ml-1.5 inline-grid min-w-6 place-items-center rounded-full bg-[var(--warn-soft)] px-1.5 text-[14px] font-semibold text-[var(--foreground)] ring-1 ring-[var(--warn-border)]"><span className="sr-only">{lang === "EN" ? "needs a decision: " : "нужно решение: "}</span>{badge}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
