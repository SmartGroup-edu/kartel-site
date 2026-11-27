// Global 404 for any URL that matches no route (design audit #2). Rendered outside the [lang]
// layout, so it brings its own <html>, styles and fonts. It receives no route params: proxy.ts
// passes the locale of the requested path in the `x-kartel-locale` request header, and the page
// renders entirely in that language (cycle 5 #1). Status stays 404. bus 176 P1: the crest 404
// (CrestNotFound) — dark heraldic page with the home and sign-in buttons.
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Source_Serif_4 } from "next/font/google";
import CrestNotFound from "./components/crest/CrestNotFound";
import { notFoundText, type NotFoundLang } from "./content/notFound";
import "./globals.css";

// bus 176 P1: not preloaded — the public crest pages use Playfair Display + Manrope (preloaded per page), so these
// cabinet faces must not compete with the crest for the first paint (LCP). They still load, with swap, where used.
const sans = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-inter", preload: false });
const serif = Source_Serif_4({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-source-serif", preload: false });

export const viewport: Viewport = { themeColor: "#0a0908", colorScheme: "dark" };

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
      <body className="flex min-h-full flex-col bg-[#0a0908] text-[var(--foreground)]">
        <CrestNotFound lang={lang} />
      </body>
    </html>
  );
}
