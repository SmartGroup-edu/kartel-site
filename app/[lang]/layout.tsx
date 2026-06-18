import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../globals.css";

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
      default: "KARTEL Core — federation authority, registry, governance",
      template: "%s | KARTEL",
    },
    description:
      "KARTEL Core — the authority surface of a federation of cultural and educational platforms. Canonical identity, geography, organisations, and governance. Virtus et Potestas.",
    ogTitle: "KARTEL Core — federation authority, registry, governance",
    twTitle: "KARTEL Core — federation authority, registry, governance",
    twDescription:
      "The authority surface of the KARTEL ecosystem — canonical layers, registry, governance.",
    locale: "en_GB",
    altLocale: "ru_RU",
  },
  ru: {
    title: {
      default: "KARTEL Core — авторитетность федерации, реестр, governance",
      template: "%s | КАРТЕЛЬ",
    },
    description:
      "KARTEL Core — слой авторитетности федерации культурных и образовательных платформ. Каноническая идентичность, география, организации и governance. Virtus et Potestas.",
    ogTitle: "KARTEL Core — авторитетность федерации, реестр, governance",
    twTitle: "KARTEL Core — авторитетность федерации, реестр, governance",
    twDescription:
      "Слой авторитетности экосистемы KARTEL — канонические слои, реестр, governance.",
    locale: "ru_RU",
    altLocale: "en_GB",
  },
};

const noscriptContent: Record<Locale, { intro: string; membersHeading: string; members: string }> = {
  en: {
    intro:
      "KARTEL Core is the authority surface of a federation of cultural and educational platforms. It owns the canonical layers — identity (CPIF), geography (ITL1), organisations, and federation — which member platforms consume. Motto: Virtus et Potestas.",
    membersHeading: "Ecosystem",
    members:
      "MoyPolk · RusJAz · Community Group · RusJAzz (planned). Family Heritage is kept as a separate area at /family.",
  },
  ru: {
    intro:
      "KARTEL Core — слой авторитетности федерации культурных и образовательных платформ. Владеет каноническими слоями — идентичность (CPIF), география (ITL1), организации и федерация — которые потребляют платформы-участники. Девиз: Virtus et Potestas.",
    membersHeading: "Экосистема",
    members:
      "MoyPolk · RusJAz · Community Group · RusJAzz (план). Семейное наследие — отдельный раздел на /family.",
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
    { media: "(prefers-color-scheme: light)", color: "#876035" },
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
    <html lang={lang} className="h-full antialiased scroll-smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kartel-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#1a1816':'#876035')}catch(e){}})()`,
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
            <h1 style={{ color: "#876035", fontSize: "32px", marginBottom: "16px" }}>
              KARTEL
            </h1>
            <p style={{ fontSize: "18px", lineHeight: "1.8", marginBottom: "16px" }}>
              {ns.intro}
            </p>
            <h2 style={{ color: "#876035", fontSize: "24px", marginBottom: "12px" }}>
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
