"use client";

import Link from "next/link";
import { useLang } from "./components/useLang";

const text = {
  EN: { message: "This page does not exist.", cta: "RETURN HOME" },
  RU: { message: "Эта страница не существует.", cta: "НА ГЛАВНУЮ" },
};

export default function NotFound() {
  const { lang } = useLang();
  const t = text[lang];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
      <a
        href={`/?lang=${lang}`}
        className="mb-8 font-serif text-[20px] tracking-[0.12em] text-[var(--accent)] transition-opacity hover:opacity-80 sm:text-[24px]"
      >
        KARTEL
      </a>
      <h1 className="font-serif text-[72px] leading-none text-[var(--accent)] sm:text-[96px]">
        404
      </h1>
      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="block h-px w-12 bg-[var(--muted-light)]" />
        <span className="block text-[14px] text-[var(--muted-light)]">&#9830;</span>
        <span className="block h-px w-12 bg-[var(--muted-light)]" />
      </div>
      <p className="text-[18px] text-[var(--text-secondary)] sm:text-[20px]">
        {t.message}
      </p>
      <Link
        href={`/?lang=${lang}`}
        className="mt-8 border border-[var(--accent)] px-6 py-3 text-sm tracking-[0.1em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {t.cta}
      </Link>
    </div>
  );
}
