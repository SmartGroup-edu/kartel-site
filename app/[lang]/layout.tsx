import type { Metadata, Viewport } from "next";
import { latinMotto } from "../lib/latin";
import { ogAlt, ogImagePath } from "../lib/ogCard";
import { notFound } from "next/navigation";
import LateVitals from "../components/LateVitals";
import { Inter, Source_Serif_4 } from "next/font/google";
import { crestFontFaces } from "../lib/crestFonts";
import "../crest-base.css";

// Self-hosted at build time (no request to Google from the browser; CSP font-src 'self' holds).
// Both cover Cyrillic, so EN and RU render in the same faces on every OS.
// bus 176 P1: not preloaded — the public crest pages use Playfair Display + Manrope (preloaded per page), so these
// cabinet faces must not compete with the crest for the first paint (LCP). They still load, with swap, where used.
const sans = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-inter", preload: false });
const serif = Source_Serif_4({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-source-serif", preload: false });

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

// bus 176 P1 (R0 2026-11-27): the public site is the coat of arms; KARTEL Core and the registry are family-only. The
// site defaults (a page without its own title, the noscript text) name the coat of arms, nothing else.
const meta: Record<Locale, {
  title: { default: string; template: string };
  description: string;
  locale: string;
  altLocale: string;
}> = {
  en: {
    title: { default: "The Kartel Coat of Arms — Virtus et Potestas", template: "%s | KARTEL" },
    description: "The Kartel family coat of arms: a griffin, crossed keys, coronet, swords, fleur-de-lis and wings, with the Latin motto Virtus et Potestas (Strength and Power).",
    locale: "en_GB",
    altLocale: "ru_RU",
  },
  ru: {
    title: { default: "Фамильный герб Картель — Virtus et Potestas", template: "%s | KARTEL" },
    description: "Фамильный герб Картель: грифон, скрещённые ключи, корона, мечи, лилии и крылья, латинский девиз Virtus et Potestas (Сила и Власть).",
    locale: "ru_RU",
    altLocale: "en_GB",
  },
};

const noscriptContent: Record<Locale, { intro: string; signin: string }> = {
  en: {
    intro: "The Kartel family coat of arms: a griffin, crossed keys, coronet, swords, fleur-de-lis and wings, with the Latin motto Virtus et Potestas — Strength and Power.",
    signin: "Family sign-in",
  },
  ru: {
    intro: "Фамильный герб Картель: грифон, скрещённые ключи, корона, мечи, лилии и крылья, латинский девиз Virtus et Potestas — «Сила и Власть».",
    signin: "Вход для семьи",
  },
};

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// Next 16 split viewport (incl. themeColor) out of metadata. Static across
// locales; media-aware so the SSR theme-color matches prefers-color-scheme
// (the inline head script additionally honours the manual localStorage toggle).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1816" },
  ],
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  const m = meta[lang as Locale];

  return {
    title: m.title,
    description: m.description,
    metadataBase: new URL("https://kartel.org.uk"),
    alternates: {
      canonical: `/${lang}`,
      languages: {
        en: "https://kartel.org.uk/en",
        ru: "https://kartel.org.uk/ru",
        "x-default": "https://kartel.org.uk/en",
      },
    },
    openGraph: {
      type: "website",
      locale: m.locale,
      alternateLocale: m.altLocale,
      siteName: "KARTEL",
      title: m.title.default,
      description: m.description,
      url: `https://kartel.org.uk/${lang}`,
      // EN keeps the long-standing /opengraph-image; RU gets its own card (cycle 7 #1).
      images: [{ url: ogImagePath(lang), width: 1200, height: 630, alt: ogAlt(lang === "ru" ? "ru" : "en"), type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title.default,
      description: m.description,
      images: [{ url: ogImagePath(lang), alt: ogAlt(lang === "ru" ? "ru" : "en") }],
    },
    icons: {
      icon: [
        // Vector variant for browsers that support it. Has the K mark inline.
        { url: "/icon.svg", type: "image/svg+xml" },
        // Generated at app/icon.tsx — clean K mark for tab/address-bar use.
        { url: "/icon", type: "image/png", sizes: "32x32" },
        // Full coat of arms for PWA install (referenced by manifest too).
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [
        // Generated at app/apple-icon.tsx — K mark on dark, no rounded corners
        // (iOS rounds them itself).
        { url: "/apple-icon", sizes: "180x180", type: "image/png" },
      ],
    },
    robots: {
      index: true,
      follow: true,
    },
    manifest: "/manifest.json",
    verification: {
      // Set GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION env vars in
      // Vercel project settings; values come from Search Console / Bing Webmaster.
      ...(process.env.GOOGLE_SITE_VERIFICATION
        ? { google: process.env.GOOGLE_SITE_VERIFICATION }
        : {}),
      ...(process.env.BING_SITE_VERIFICATION
        ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
        : {}),
    },
    other: {
      // theme-color now lives in the viewport export (Next 16).
      author: "Kartel Family",
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  const ns = noscriptContent[lang as Locale];

  return (
    <html lang={lang} className={`${sans.variable} ${serif.variable} h-full antialiased scroll-smooth`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem('kartel-contrast');if(c==='high'||(c!=='normal'&&matchMedia('(prefers-contrast: more)').matches))document.documentElement.classList.add('hc');var t=localStorage.getItem('kartel-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#1a1816':'#ffffff')}catch(e){}})()`,
          }}
        />
        {/* The crest faces, declared for this language (bus 176 P1b) — see app/lib/crestFonts.ts. */}
        <style dangerouslySetInnerHTML={{ __html: crestFontFaces(lang as Locale) }} />
        <link rel="author" href="/humans.txt" />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <LateVitals />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))`,
          }}
        />
        <noscript>
          <div style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "Georgia, serif", color: "#2b2824" }}>
            <p style={{ color: "#7b1e2d", fontSize: "32px", marginBottom: "16px" }}>
              KARTEL
            </p>
            <p style={{ fontSize: "18px", lineHeight: "1.8", marginBottom: "16px" }}>
              {latinMotto(ns.intro)}
            </p>
            <p style={{ fontSize: "16px", lineHeight: "1.9" }}>
              <a href={`/${lang}/family/signin`} style={{ color: "#7b1e2d" }}>{ns.signin}</a>
            </p>
            <p style={{ fontSize: "14px", color: "#6f685c", marginTop: "24px" }}>
              &copy; kartel.org.uk — <span lang="la">Virtus et Potestas</span>
            </p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
