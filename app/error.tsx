"use client";

import { useEffect } from "react";
import { useLang } from "./components/useLang";

const text = {
  EN: { heading: "Error", message: "Something went wrong. Please try again.", cta: "TRY AGAIN" },
  RU: { heading: "Ошибка", message: "Что-то пошло не так. Пожалуйста, попробуйте ещё раз.", cta: "ПОВТОРИТЬ" },
};

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useLang();
  const t = text[lang];

  useEffect(() => {
    console.error("Runtime error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
      <h1 className="font-serif text-[48px] leading-none text-[var(--accent)] sm:text-[64px]">
        {t.heading}
      </h1>
      <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[var(--text-secondary)] sm:text-[18px]">
        {t.message}
      </p>
      <button
        onClick={reset}
        className="mt-8 border border-[var(--accent)] px-6 py-3 text-sm tracking-[0.1em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {t.cta}
      </button>
    </div>
  );
}
