/**
 * One heading and text system for every public page (cycle 4, 2026-11-15).
 * Home, family, Core and the registry all read their classes from here, so the site
 * keeps one scale. Literal strings: Tailwind scans this file like any other source.
 */
export const H1 = "font-serif text-[36px] leading-[1.1] tracking-[-0.01em] text-[var(--accent)] md:text-[44px] lg:text-[54px]";
export const H2 = "font-serif text-[28px] leading-[1.15] text-[var(--accent)] lg:text-[35px]";
export const H3 = "font-serif text-[22px] leading-[1.2] text-[var(--foreground)] lg:text-[24px]";
/** Reading text: essays, ledes, intros. Pair with a 68ch measure. */
export const PROSE = "text-[17px] leading-[1.65] text-[var(--text-body)] lg:text-[19px] lg:leading-[1.7]";
/** Small caps-style label above an H1. */
export const EYEBROW = "text-[14px] uppercase tracking-[0.2em] text-[var(--accent)]";
/** Captions, notes, meta — the 14px floor. */
export const META = "text-[14px] leading-relaxed text-[var(--muted)]";
/** Table header cell. */
export const TH = "px-4 py-3 text-[14px] font-medium text-[var(--muted)]";

/** "Snapshot v6 · data as of 19 June 2026" / «Снимок v6 · данные на 19 июня 2026».
 *  `version` is omitted for snapshots that carry none (the federation projection). */
export function snapshotLine(lang: "EN" | "RU", version: number | string | null, isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const date = new Intl.DateTimeFormat(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(d)
    .replace(/\s*г\.$/, "");
  const v = version == null ? "" : ` v${version}`;
  return lang === "EN" ? `Snapshot${v} · data as of ${date}` : `Снимок${v} · данные на ${date}`;
}
