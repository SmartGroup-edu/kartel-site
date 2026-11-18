"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { H1, PROSE } from "../lib/typeScale";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { homeContent } from "../content/home";

// Route error boundary, on the site's type system (cycle 11): H1 from the scale, reading text,
// a sentence-case retry button and a way back to the crest. The [lang] layout renders no chrome
// (each page draws its own), so the boundary brings the site header and footer itself (bus 92 L2).
const text = {
  en: { heading: "Something went wrong", message: "The page could not be shown. Please try again.", cta: "Try again", home: "Back to the coat of arms" },
  ru: { heading: "Что-то пошло не так", message: "Страницу не удалось показать. Пожалуйста, попробуйте ещё раз.", cta: "Повторить", home: "К гербу" },
};

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ lang: string }>();
  const lang = (params?.lang === "ru" ? "ru" : "en") as keyof typeof text;
  const t = text[lang];
  const router = useRouter();
  const other = lang === "en" ? "ru" : "en";

  useEffect(() => {
    console.error("Runtime error:", error);
  }, [error]);

  return (
    <>
    <SiteHeader lang={lang === "en" ? "EN" : "RU"} toggleLang={() => router.push(`/${other}`)} />
    <main id="main" className="flex flex-1 flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
      <h1 className={H1}>{t.heading}</h1>
      <p className={`mt-4 max-w-md ${PROSE}`}>{t.message}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-[15px] font-medium text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {t.cta}
        </button>
        <a
          href={`/${lang}`}
          className="inline-flex min-h-11 items-center rounded-md border border-[var(--accent)] px-5 text-[15px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {t.home}
        </a>
      </div>
    </main>
    <SiteFooter copy={homeContent[lang === "en" ? "EN" : "RU"].footerCopy} contactEmail={null} />
    </>
  );
}
