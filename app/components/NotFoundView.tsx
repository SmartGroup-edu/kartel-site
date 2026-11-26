"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import FamilyChrome, { type FamilyChromeNav } from "./FamilyChrome";
import { notFoundText, familyRefText, type NotFoundLang } from "../content/notFound";
import { typographDict } from "../lib/typograph.mjs";

const FAMILY_REF_RU = typographDict(familyRefText.ru); // QA-158 N5

/** The 404 body + the site header (nav, theme toggle, language switch). The address itself does
 *  not exist in either language, so the language switch goes to the other language's home.
 *  `family` (bus 157b D11): a signed-in family viewer gets the family layout instead — sub-nav and «Выйти». */
export default function NotFoundView({ lang, refCode, family = null }: { lang: NotFoundLang; refCode?: string; family?: FamilyChromeNav | null }) {
  const router = useRouter();
  const other = lang === "en" ? "ru" : "en";
  if (family) return (
    <FamilyChrome lang={lang === "en" ? "EN" : "RU"} nav={family} langHref={`/${other}/family/os`}>
      <NotFoundBody lang={lang} refCode={refCode} child={family.child ?? false} left />
    </FamilyChrome>
  );
  return (
    <>
      <SiteHeader lang={lang === "en" ? "EN" : "RU"} toggleLang={() => router.push(`/${other}`)} />
      <main id="main" className="flex flex-1 flex-col">
        <NotFoundBody lang={lang} refCode={refCode} />
      </main>
    </>
  );
}

function NotFoundBody({ lang, refCode, child = false, left = false }: { lang: NotFoundLang; refCode?: string; child?: boolean; left?: boolean }) {
  // Inside the family column it reads left-aligned like every family page; the site 404 stays centred.
  const className = left ? "items-start py-12 text-left" : "items-center px-4 py-24 text-center";
  const t = notFoundText[lang];
  const f = lang === "ru" ? FAMILY_REF_RU : familyRefText.en;
  const btn = "inline-flex min-h-11 items-center rounded-md px-5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  return (
    <div className={`flex flex-1 flex-col justify-center ${className}`}>
      <p className="font-serif text-7xl leading-none text-[var(--accent)] sm:text-8xl" aria-hidden="true">404</p>
      <h1 className="mt-6 font-serif text-[28px] leading-[1.15] text-[var(--foreground)] lg:text-[35px]">{refCode ? f.message : t.message}</h1>
      <p className="mt-3 max-w-md text-[17px] leading-[1.6] text-[var(--text-body)]">{refCode ? f.hint : t.hint}</p>
      {refCode && <RefCode label={f.code} code={refCode} />}
      <div className={`mt-8 flex flex-wrap gap-3 ${left ? "" : "justify-center"}`}>
        <Link prefetch={false} href={refCode ? `/${lang}/family/os` : `/${lang}`} className={`${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]`}>
          {refCode ? (child ? f.myDay : f.home) : t.home}
        </Link>
        {/* bus 173: no «Наследие» for a child — that address sends them back to «Мой день». */}
        {!(refCode && child) && (
          <Link prefetch={false} href={refCode ? `/${lang}/family` : `/${lang}/registry`} className={`${btn} border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/5`}>
            {refCode ? f.heritage : t.registry}
          </Link>
        )}
      </div>
    </div>
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
