"use client";

/**
 * Family OS does not answer (QA-156 M7): every OS page renders this one calm state instead of a 404 — the
 * page's own title as the H1 (L6), one status line, inside the family layout (bus 157b D11).
 */
import FamilyChrome, { type FamilyChromeNav } from "./FamilyChrome";
import { H1 } from "../lib/typeScale";
import { tx } from "../lib/typograph.mjs";

type Lang = "EN" | "RU";
export const OS_DOWN_T = {
  EN: { error: "Family OS is not answering right now. Please try again in a minute.", off: "Family OS is not connected yet.", busy: "Too many requests right now. Please try again in a minute." },
  RU: { error: "Раздел «Семья» сейчас не отвечает. Попробуй через минуту.", off: "Раздел «Семья» ещё не подключён.", busy: "Слишком много запросов. Попробуй через минуту." },
} as const;

/** QA-158 N2: "busy" = the service answered 429. It is up, so the page does not say «не отвечает». */
type Status = "off" | "error" | "busy";

/** The heading and the status line — also used inside a page that already has the family layout. */
export function OsDownNotice({ lang, status, title }: { lang: Lang; status: Status; title: string }) {
  const t = tx(OS_DOWN_T, lang);
  return (
    <section aria-labelledby="os-down-h" data-os-down={status} className="mt-10">
      <h1 id="os-down-h" className={H1}>{title}</h1>
      <p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px] text-[var(--foreground)]">{t[status]}</p>
    </section>
  );
}

export default function FamilyOsDown({ lang, status, title, nav }: { lang: Lang; status: Status; title: string; nav: FamilyChromeNav }) {
  return <FamilyChrome lang={lang} nav={nav}><OsDownNotice lang={lang} status={status} title={title} /></FamilyChrome>;
}
