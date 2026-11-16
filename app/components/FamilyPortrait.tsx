/**
 * A family portrait from the editor, or — when there is none — a monogram (no stock images).
 * Files come from /api/family-media (session-checked, private, no-store); AVIF with WebP fallback.
 * Frame: 4:5, rounded rectangle. The editor already cropped the photo to 4:5, so the image is shown
 * whole (object-contain) — the page never crops it a second time.
 */
export function monogram(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function FamilyPortrait({ id, name, alt, size, mobileSize }: { id: string | null | undefined; name: string; alt: string; size: number; mobileSize?: number }) {
  // size = frame width (4:5 frame); mobileSize, when given, applies below the md breakpoint.
  const sm = mobileSize ?? size;
  const box = {
    "--pw": `${size}px`, "--ph": `${Math.round(size * 1.25)}px`, "--pw-sm": `${sm}px`, "--ph-sm": `${Math.round(sm * 1.25)}px`,
  } as React.CSSProperties;
  const frame = "w-[var(--pw-sm)] h-[var(--ph-sm)] md:w-[var(--pw)] md:h-[var(--ph)]";
  if (!id) {
    return (
      <span aria-hidden="true" data-portrait="monogram" style={box}
        className={`${frame} mx-auto flex shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] font-serif text-[var(--muted)]`}>
        <span className="text-[length:calc(var(--pw-sm)*0.36)] md:text-[length:calc(var(--pw)*0.36)]">{monogram(name)}</span>
      </span>
    );
  }
  const src = (w: number, f: string) => `/api/family-media/${id}/${w}.${f}`;
  return (
    <picture data-portrait="photo" className={`${frame} mx-auto block shrink-0 overflow-hidden rounded-md bg-[var(--surface)]`} style={box}>
      {/* Variants are bounded by a square of 256/640 px, so a 4:5 portrait is 205/512 px wide. */}
      <source type="image/avif" srcSet={`${src(256, "avif")} 205w, ${src(640, "avif")} 512w`} sizes={`${size}px`} />
      <img src={src(256, "webp")} srcSet={`${src(256, "webp")} 205w, ${src(640, "webp")} 512w`} sizes={`${size}px`}
        alt={alt} width={size} height={Math.round(size * 1.25)} loading="lazy" decoding="async" className="h-full w-full rounded-md object-contain" />
    </picture>
  );
}
