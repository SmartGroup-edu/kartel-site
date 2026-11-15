"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import { notFoundText, type NotFoundLang } from "../content/notFound";

/** The 404 body + the site header (nav, theme toggle, language switch). The address itself does
 *  not exist in either language, so the language switch goes to the other language's home. */
export default function NotFoundView({ lang }: { lang: NotFoundLang }) {
  const router = useRouter();
  const t = notFoundText[lang];
  const other = lang === "en" ? "ru" : "en";
  const btn = "inline-flex min-h-11 items-center rounded-md px-5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  return (
    <>
      <SiteHeader lang={lang === "en" ? "EN" : "RU"} toggleLang={() => router.push(`/${other}`)} />
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="font-serif text-7xl leading-none text-[var(--accent)] sm:text-8xl" aria-hidden="true">404</p>
        <h1 className="mt-6 font-serif text-[28px] leading-[1.15] text-[var(--foreground)] lg:text-[35px]">{t.message}</h1>
        <p className="mt-3 max-w-md text-[17px] leading-[1.6] text-[var(--text-body)]">{t.hint}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/${lang}`} className={`${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]`}>
            {t.home}
          </Link>
          <Link href={`/${lang}/registry`} className={`${btn} border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/5`}>
            {t.registry}
          </Link>
        </div>
      </main>
    </>
  );
}
