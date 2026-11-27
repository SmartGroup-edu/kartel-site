import type { Lang } from "./useLang";

/** First focus stop on every page (WCAG 2.4.1). Targets the page's <main id="main">. */
export default function SkipToContent({ lang }: { lang: Lang }) {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--fos-primary)] focus:px-4 focus:py-2 focus:text-sm focus:text-[var(--fos-on-primary)]"
    >
      {lang === "RU" ? "Перейти к содержимому" : "Skip to content"}
    </a>
  );
}
