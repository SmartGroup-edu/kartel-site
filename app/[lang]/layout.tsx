import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "../globals.css";

// Self-hosted at build time (no request to Google from the browser; CSP font-src 'self' holds).
// Both cover Cyrillic, so EN and RU render in the same faces on every OS.
const sans = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-inter" });
const serif = Source_Serif_4({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-source-serif" });

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

const meta: Record<Locale, {
  title: { default: string; template: string };
  description: string;
  ogTitle: string;
  twTitle: string;
  twDescription: string;
  locale: string;
  altLocale: string;
}> = {
  en: {
    title: {
      default: "KARTEL Core — public registry of the KARTEL federation",
      template: "%s | KARTEL",
    },
    description:
      "The public registry of the KARTEL federation: one identity, one map of UK regions and one organisation model, shared by MoyPolk, RusJAz and Community Group.",
    ogTitle: "KARTEL Core — public registry of the KARTEL federation",
    twTitle: "KARTEL Core — public registry of the KARTEL federation",
    twDescription:
      "The public registry of the KARTEL federation — layers, projects and the rules every platform follows.",
    locale: "en_GB",
    altLocale: "ru_RU",
  },
  ru: {
    title: {
      default: "Ядро KARTEL — публичный реестр федерации KARTEL",
      template: "%s | KARTEL",
    },
    description:
      "Публичный реестр федерации KARTEL: единая идентичность, единая карта регионов UK и единая модель организаций для MoyPolk, RusJAz и Community Group.",
    ogTitle: "Ядро KARTEL — публичный реестр федерации KARTEL",
    twTitle: "Ядро KARTEL — публичный реестр федерации KARTEL",
    twDescription:
      "Публичный реестр федерации KARTEL — слои, проекты и правила, общие для всех платформ.",
    locale: "ru_RU",
    altLocale: "en_GB",
  },
};

const noscriptContent: Record<Locale, { intro: string; membersHeading: string; members: string }> = {
  en: {
    // The home is the coat of arms (R0 2026-11-14). No family names here.
    intro:
      "The coat of arms of the Kartel family: a griffin, crossed keys, a coronet, swords, fleur-de-lis and wings beneath the Latin motto Virtus et Potestas — Strength and Power.",
    membersHeading: "KARTEL Core",
    members:
      "The public registry of the KARTEL federation lives at kartel.org.uk/en/core and kartel.org.uk/en/registry.",
  },
  ru: {
    intro:
      "Фамильный герб Картель: грифон, скрещённые ключи, корона, мечи, лилии и крылья под латинским девизом Virtus et Potestas — «Сила и Власть».",
    membersHeading: "Ядро KARTEL",
    members:
      "Публичный реестр федерации KARTEL — на kartel.org.uk/ru/core и kartel.org.uk/ru/registry.",
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
      title: m.ogTitle,
      description: m.description,
      url: `https://kartel.org.uk/${lang}`,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "KARTEL — Coat of Arms of the Kartel Family. Virtus et Potestas.",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: m.twTitle,
      description: m.twDescription,
      images: [
        {
          url: "/opengraph-image",
          alt: "KARTEL — Coat of Arms of the Kartel Family. Virtus et Potestas.",
        },
      ],
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
            __html: `(function(){try{var t=localStorage.getItem('kartel-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#1a1816':'#ffffff')}catch(e){}})()`,
          }}
        />
        <link rel="author" href="/humans.txt" />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
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
              {ns.intro}
            </p>
            <h2 style={{ color: "#7b1e2d", fontSize: "24px", marginBottom: "12px" }}>
              {ns.membersHeading}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.9" }}>{ns.members}</p>
            <p style={{ fontSize: "14px", color: "#6f685c", marginTop: "24px" }}>
              &copy; kartel.org.uk — Virtus et Potestas
            </p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
