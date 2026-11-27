export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        {/* bus 176 P1: a system serif — the web serif here made every page (the crest home included) fetch a 51 KB
            font at the highest priority, ahead of its LCP image. */}
        <span className="text-[24px] tracking-[0.12em] text-[var(--accent)] sm:text-[28px]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          KARTEL
        </span>
        <div className="h-px w-12 animate-pulse bg-[var(--muted-light)]" />
      </div>
    </div>
  );
}
