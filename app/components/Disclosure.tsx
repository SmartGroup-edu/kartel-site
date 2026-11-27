/**
 * One disclosure for every Family OS fold-out (bus 74 #1): a native <details> with an explicit chevron
 * that turns when open. The browser marker is hidden because the summary is a flex row (which drops it
 * in some engines anyway) — the chevron is the one visible affordance everywhere.
 * `box`: a bordered panel (add forms). `inline`: a quiet text toggle (details, change type).
 */
import type { ReactNode } from "react";

export default function Disclosure({ summary, children, variant = "box", className = "", summaryClassName = "", onToggle }: {
  summary: ReactNode; children: ReactNode; variant?: "box" | "inline"; className?: string; summaryClassName?: string;
  /** Called with the new state when it opens or closes (bus 176 P4: the guest log loads on first open). */
  onToggle?: (open: boolean) => void;
}) {
  const box = variant === "box";
  return (
    <details data-disclosure={variant} onToggle={onToggle ? (e) => onToggle(e.currentTarget.open) : undefined} className={`group ${box ? "rounded-lg border border-[var(--border)] px-4 py-1 open:pb-4" : ""} ${className}`}>
      <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden ${box ? "font-medium text-[var(--foreground)]" : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"} ${summaryClassName}`}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" className="shrink-0 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none">
          <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {summary}
      </summary>
      {children}
    </details>
  );
}
