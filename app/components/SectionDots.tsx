"use client";

interface SectionDotsProps {
  sections: { id: string; label: string }[];
  activeSection: string | null;
}

export default function SectionDots({ sections, activeSection }: SectionDotsProps) {
  return (
    <nav
      className="fixed right-1 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 lg:flex"
      aria-label="Section navigation"
    >
      {sections.map((s) => {
        const isActive = activeSection === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-label={s.label}
            aria-current={isActive ? "true" : undefined}
            className="group relative flex items-center justify-center rounded-full p-2"
          >
            {/* Tooltip */}
            <span className="pointer-events-none absolute right-8 whitespace-nowrap rounded bg-[var(--foreground)] px-2 py-1 text-xs text-[var(--background)] opacity-0 transition-opacity group-hover:opacity-100">
              {s.label}
            </span>

            {/* Dot */}
            <span
              className={`block rounded-full transition-all duration-300 ${
                isActive
                  ? "h-3 w-3 bg-[var(--accent)] ring-2 ring-[var(--background)]"
                  : "h-2.5 w-2.5 bg-[var(--muted)] ring-2 ring-[var(--background)] group-hover:bg-[var(--accent)]"
              }`}
            />
          </a>
        );
      })}
    </nav>
  );
}
