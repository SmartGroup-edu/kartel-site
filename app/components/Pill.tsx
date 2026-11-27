/**
 * The one status/role pill (cycle 4): 14px sentence case, ≥24px tall. Callers keep their own
 * colour logic on the raw token and pass a tone; the label is display text only.
 */
export type PillTone = "accent" | "solid" | "body" | "muted";

const TONES: Record<PillTone, string> = {
  accent: "border-[var(--accent)] text-[var(--accent)]",
  solid: "border-[var(--fos-primary)] bg-[var(--fos-primary)] text-[var(--fos-on-primary)]",
  body: "border-[var(--border)] text-[var(--text-body)]",
  muted: "border-[var(--border)] text-[var(--muted)]",
};

export const sentenceCase = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

export default function Pill({ tone, children }: { tone: PillTone; children: string }) {
  return (
    <span className={`inline-flex min-h-6 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[14px] leading-none ${TONES[tone]}`}>
      {sentenceCase(children)}
    </span>
  );
}
