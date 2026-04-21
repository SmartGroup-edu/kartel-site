"use client";

import { useRef, useState, useEffect } from "react";
import { useScrollY } from "./useScrollY";

interface MottoBannerProps {
  lang: "EN" | "RU";
}

export default function MottoBanner({ lang }: MottoBannerProps) {
  const translation =
    lang === "EN" ? "Strength and Power" : "Сила и Власть";
  const ref = useRef<HTMLDivElement>(null);
  const scrollY = useScrollY();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  let offset = 0;
  if (!reduced && ref.current) {
    const rect = ref.current.getBoundingClientRect();
    const windowH = window.innerHeight;
    if (!(rect.bottom < -100 || rect.top > windowH + 100)) {
      const center = rect.top + rect.height / 2;
      const delta = (center - windowH / 2) / windowH;
      offset = delta * -30;
    }
  }

  return (
    <div ref={ref} className="relative overflow-hidden bg-[var(--foreground)] py-10 sm:py-14 lg:py-16">
      {/* Subtle background pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            var(--accent) 0px,
            var(--accent) 1px,
            transparent 1px,
            transparent 12px
          )`,
        }}
      />

      {/* Decorative corner elements */}
      <div className="absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-[var(--accent)]/30 sm:left-8 sm:top-6 sm:h-10 sm:w-10" aria-hidden="true" />
      <div className="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-[var(--accent)]/30 sm:bottom-6 sm:right-8 sm:h-10 sm:w-10" aria-hidden="true" />

      {/* Parallax content */}
      <div
        className="relative mx-auto max-w-4xl px-6 text-center transition-transform duration-100 ease-out"
        style={{ transform: `translateY(${offset}px)` }}
      >
        {/* Decorative line */}
        <div className="mx-auto mb-5 h-px w-16 bg-[var(--accent)]/40 sm:w-20" aria-hidden="true" />

        {/* Latin motto */}
        <p
          className="font-serif text-[28px] italic leading-tight tracking-[0.08em] text-[var(--accent)] sm:text-[36px] lg:text-[44px]"
          lang="la"
        >
          Virtus et Potestas
        </p>

        {/* Translation */}
        <p className="mt-3 text-[13px] uppercase tracking-[0.2em] text-[var(--background)]/60 sm:text-[14px]">
          {translation}
        </p>

        {/* Decorative line */}
        <div className="mx-auto mt-5 h-px w-16 bg-[var(--accent)]/40 sm:w-20" aria-hidden="true" />
      </div>
    </div>
  );
}
