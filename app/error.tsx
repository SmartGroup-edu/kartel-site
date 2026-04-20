"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Runtime error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eeebe5] px-4 text-center">
      <h1 className="font-serif text-[48px] leading-none text-[#9b723a] sm:text-[64px]">
        Error
      </h1>
      <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#3a3630] sm:text-[18px]">
        Something went wrong. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-8 border border-[#9b723a] px-6 py-3 text-sm tracking-[0.1em] text-[#9b723a] transition-colors hover:bg-[#9b723a] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b723a]"
      >
        TRY AGAIN
      </button>
    </div>
  );
}
