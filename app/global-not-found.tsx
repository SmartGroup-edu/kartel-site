// Global 404 for any URL that matches no route (design audit #2). Rendered outside the [lang]
// layout, so it brings its own <html>, styles and fonts. It receives no route params: proxy.ts
// passes the locale of the requested path in the `x-kartel-locale` request header, and the page
// renders entirely in that language (cycle 5 #1). Status stays 404. SiteHeader (inside
// NotFoundView) brings the skip link, nav, theme toggle and language switch.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Source_Serif_4 } from "next/font/google";
import NotFoundView from "./components/NotFoundView";
import { notFoundText, type NotFoundLang } from "./content/notFound";
import "./globals.css";

const sans = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-inter" });
const serif = Source_Serif_4({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-source-serif" });

async function locale(): Promise<NotFoundLang> {
  return (await headers()).get("x-kartel-locale") === "ru" ? "ru" : "en";
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${notFoundText[await locale()].title} | KARTEL`, robots: { index: false, follow: false } };
}

export default async function GlobalNotFound() {
  const lang = await locale();
  return (
    <html lang={lang} className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem('kartel-contrast');if(c==='high'||(c!=='normal'&&matchMedia('(prefers-contrast: more)').matches))document.documentElement.classList.add('hc');var t=localStorage.getItem('kartel-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
        <NotFoundView lang={lang} />
      </body>
    </html>
  );
}
