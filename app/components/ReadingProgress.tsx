"use client";

import { useScrollY } from "./useScrollY";

export default function ReadingProgress() {
  const scrollY = useScrollY();
  const docHeight =
    typeof document !== "undefined"
      ? document.documentElement.scrollHeight - window.innerHeight
      : 1;
  const progress = docHeight > 0 ? Math.min((scrollY / docHeight) * 100, 100) : 0;

  return (
    <div
      className="fixed left-0 top-0 z-50 h-[2px] bg-[var(--accent)]/70 transition-[width] duration-150 ease-out"
      style={{ width: `${progress}%` }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    />
  );
}
