"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import { notFoundText, familyRefText, type NotFoundLang } from "../content/notFound";

/** The 404 body + the site header (nav, theme toggle, language switch). The address itself does
 *  not exist in either language, so the language switch goes to the other language's home. */
export default function NotFoundView({ lang, refCode }: { lang: NotFoundLang; refCode?: string }) {
  const router = useRouter();
  const t = notFoundText[lang];
  const f = familyRefText[lang];
  const other = lang === "en" ? "ru" : "en";
  const btn = "inline-flex min-h-11 items-center rounded-md px-5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  return (
    <>
      <SiteHeader lang={lang === "en" ? "EN" : "RU"} toggleLang={() => router.push(`/${other}`)} />
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="font-serif text-7xl leading-none text-[var(--accent)] sm:text-8xl" aria-hidden="true">404</p>
        <h1 className="mt-6 font-serif text-[28px] leading-[1.15] text-[var(--foreground)] lg:text-[35px]">{refCode ? f.message : t.message}</h1>
        <p className="mt-3 max-w-md text-[17px] leading-[1.6] text-[var(--text-body)]">{refCode ? f.hint : t.hint}</p>
        {refCode && <RefCode label={f.code} code={refCode} />}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={refCode ? `/${lang}/family/os` : `/${lang}`} className={`${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]`}>
            {refCode ? f.home : t.home}
          </Link>
          <Link href={refCode ? `/${lang}/family` : `/${lang}/registry`} className={`${btn} border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/5`}>
            {refCode ? f.heritage : t.registry}
          </Link>
        </div>
      </main>
    </>
  );
}

/** «Код обращения: X7K2QD» — selectable, monospaced, read aloud easily (no I, L, O, U). */
export function RefCode({ label, code }: { label: string; code: string }) {
  return (
    <p data-ref-code={code} className="mt-4 text-[16px] text-[var(--text-secondary)]">
      {label}: <span className="select-all rounded border border-[var(--border)] px-2 py-0.5 font-mono text-[17px] tracking-[0.12em] text-[var(--foreground)]">{code}</span>
    </p>
  );
}
