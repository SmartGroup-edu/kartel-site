"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import { useLangToggle, type Lang } from "../components/useLang";

const text = {
  en: { message: "This page does not exist.", hint: "The address may be mistyped, or the page has moved.", cta: "Return home", registry: "Open the registry" },
  ru: { message: "Такой страницы нет.", hint: "Возможно, в адресе опечатка или страница переехала.", cta: "На главную", registry: "Открыть реестр" },
};

export default function NotFound() {
  const params = useParams<{ lang: string }>();
  const lang = (params?.lang === "ru" ? "ru" : "en") as keyof typeof text;
  const L = lang.toUpperCase() as Lang;
  const toggleLang = useLangToggle(L);
  const t = text[lang];

  return (
    <>
      <SiteHeader lang={L} toggleLang={toggleLang} />
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="font-serif text-7xl leading-none text-[var(--accent)] sm:text-8xl">404</p>
        <h1 className="mt-6 font-serif text-3xl text-[var(--foreground)]">{t.message}</h1>
        <p className="mt-3 max-w-md text-base text-[var(--text-body)]">{t.hint}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${lang}`}
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--on-accent)] transition-opacity hover:opacity-90"
          >
            {t.cta}
          </Link>
          <Link
            href={`/${lang}/registry`}
            className="rounded-lg border border-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--surface)]"
          >
            {t.registry}
          </Link>
        </div>
      </main>
    </>
  );
}
