/**
 * «На этой странице»: one tap to each part of a long family page (bus 78 #5; person page bus 157b D6).
 * Plain bordered links, radius 6 — not pills. `aside` (≥ 1280 px): the list stands as a sticky column to the
 * right of the reading column, which keeps its width; below that it is one wrapped row under the heading.
 */
export default function FamilyJumpNav({ label, items, aside = false, kind }: { label: string; items: [href: string, text: string][]; aside?: boolean; kind: "access" | "person" }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label={label} data-jump-nav={kind} {...{ [`data-${kind}-jump`]: "" }} className={aside ? "mt-4 xl:sticky xl:top-28 xl:mt-0 xl:self-start" : "mt-4"}>
      <p className={aside ? "sr-only xl:not-sr-only xl:mb-2 xl:text-[14px] xl:text-[var(--muted)]" : "sr-only"}>{label}</p>
      <ul className={`flex flex-wrap gap-2 ${aside ? "xl:flex-col xl:gap-1" : ""}`}>
        {items.map(([href, text]) => (
          <li key={href}>
            <a href={href} className={`inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-4 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)] ${aside ? "xl:w-full xl:border-transparent xl:px-3 xl:hover:border-[var(--border)]" : ""}`}>{text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
