export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eeebe5]">
      <div className="flex flex-col items-center gap-4">
        <span className="font-serif text-[24px] tracking-[0.12em] text-[#9b723a] sm:text-[28px]">
          KARTEL
        </span>
        <div className="h-px w-12 animate-pulse bg-[#c4b89a]" />
      </div>
    </div>
  );
}
