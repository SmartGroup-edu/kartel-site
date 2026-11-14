// Global 404 for any URL that matches no route (design audit #2). Rendered outside the [lang]
// layout, so it brings its own <html>, styles and fonts. Proxy.ts has already prefixed non-locale
// paths with /en, so every unmatched URL that reaches here is /en/… or /ru/…; the copy is
// bilingual because this file receives no route params.
import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-inter" });
const serif = Source_Serif_4({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-source-serif" });

export const metadata: Metadata = {
  title: "Page not found · Страница не найдена | KARTEL",
  robots: { index: false, follow: false },
};

const btn = "rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90";

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kartel-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-sm focus:text-[var(--on-accent)]"
        >
          Skip to content
        </a>
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-10 lg:py-5">
            <Link href="/en" className="rounded-sm font-serif text-[24px] tracking-[0.12em] text-[var(--accent)] sm:text-[28px] lg:text-[30px]">
              KARTEL
            </Link>
          </div>
        </header>
        <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
          <p className="font-serif text-7xl leading-none text-[var(--accent)] sm:text-8xl">404</p>
          <h1 className="mt-6 font-serif text-3xl text-[var(--foreground)]">This page does not exist.</h1>
          <p className="mt-2 font-serif text-xl text-[var(--text-body)]" lang="ru">Такой страницы нет.</p>
          <p className="mt-4 max-w-md text-base text-[var(--text-body)]">
            The address may be mistyped, or the page has moved.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/en" className={`${btn} bg-[var(--accent)] text-[var(--on-accent)]`}>Return home</Link>
            <Link href="/en/registry" className={`${btn} border border-[var(--accent)] text-[var(--accent)]`}>Open the registry</Link>
            <Link href="/ru" lang="ru" className={`${btn} border border-[var(--border)] text-[var(--foreground)]`}>На главную</Link>
          </div>
        </main>
      </body>
    </html>
  );
}
