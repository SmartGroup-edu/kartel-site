/**
 * One heading and button scale for every Family OS page (QA-156 / bus 157b D2–D4). Rules in docs/family-os-design.md.
 * Literal strings: Tailwind scans this file like any other source.
 *
 * Headings: a section is an H2 (the site scale's H2: serif, burgundy); a titled block inside a section is an H3.
 * Buttons, one size (≥ 44 px tall, 15 px text, 16 px side padding):
 *  - BTN_PRIMARY — a form's submit, or the «yes» of a non-destructive confirm. Filled. One per form.
 *  - BTN_SECONDARY — every other action. Outline.
 *  - BTN_DANGER — deletes or cuts something off. Destructive text + outline, never a fill; always behind a
 *    confirm step and set apart from the safe actions (DANGER_ROW).
 */
import { H2, H3 } from "./typeScale";

export const OS_H2 = H2;
export const OS_H3 = H3;

const BTN = "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const BTN_PRIMARY = `${BTN} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]`;
export const BTN_SECONDARY = `${BTN} border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)]`;
export const BTN_DANGER = `${BTN} border border-[var(--destructive)] bg-[var(--background)] text-[var(--destructive)] hover:underline hover:underline-offset-4`;
/**
 * Containers (D8). A left rule means one of two things only: values and principles (grey, Кодекс серебро) or
 * private and sensitive (червлень). Lists of items are plain lists or cards; nothing else gets a left rule.
 */
export const RULE_VALUES = "border-l-2 border-[var(--pillar-kodeks)] pl-4";
export const RULE_PRIVATE = "border-l-2 border-[var(--pillar-health)] pl-4";
/** A danger action sits in its own row under a hairline, away from the safe ones. */
export const DANGER_ROW = "mt-6 border-t border-[var(--border)] pt-4";
