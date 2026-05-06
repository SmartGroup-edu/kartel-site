export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <span className="font-serif text-[24px] tracking-[0.12em] text-[var(--accent)] sm:text-[28px]">
          KARTEL
        </span>
        <div className="h-px w-12 animate-pulse bg-[var(--muted-light)]" />
      </div>
    </div>
  );
}
