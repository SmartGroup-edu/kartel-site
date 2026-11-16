/**
 * A family portrait from the editor, or — when there is none — a monogram (no stock images).
 * Files come from /api/family-media (session-checked, private, no-store); AVIF with WebP fallback.
 */
export function monogram(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function FamilyPortrait({ id, name, alt, size }: { id: string | null | undefined; name: string; alt: string; size: number }) {
  const box = { width: size, height: size };
  if (!id) {
    return (
      <span aria-hidden="true" data-portrait="monogram" style={box}
        className="mx-auto flex shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] font-serif text-[var(--muted)]">
        <span style={{ fontSize: Math.round(size * 0.36) }}>{monogram(name)}</span>
      </span>
    );
  }
  const src = (w: number, f: string) => `/api/family-media/${id}/${w}.${f}`;
  return (
    <picture data-portrait="photo" className="mx-auto block shrink-0" style={box}>
      <source type="image/avif" srcSet={`${src(256, "avif")} 256w, ${src(640, "avif")} 640w`} sizes={`${size}px`} />
      <img src={src(256, "webp")} srcSet={`${src(256, "webp")} 256w, ${src(640, "webp")} 640w`} sizes={`${size}px`}
        alt={alt} width={size} height={size} loading="lazy" decoding="async" className="h-full w-full rounded-full object-cover" />
    </picture>
  );
}
