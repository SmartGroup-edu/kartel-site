import type { Metadata } from "next";
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
      default: "KARTEL — Coat of Arms, Legacy, London",
      template: "%s | KARTEL",
    },
    description:
      "Kartel family coat of arms, family legacy, and identity based in London. Virtus et Potestas.",
    ogTitle: "KARTEL — Coat of Arms, Legacy, London",
    twTitle: "KARTEL — Coat of Arms, Legacy, London",
    twDescription:
      "Kartel family coat of arms, family legacy, and identity based in London.",
    locale: "en_GB",
    altLocale: "ru_RU",
  },
  ru: {
    title: {
      default: "КАРТЕЛЬ — Фамильный герб, наследие, Лондон",
      template: "%s | КАРТЕЛЬ",
    },
    description:
      "Фамильный герб семьи Картель, наследие и идентичность. Базируется в Лондоне. Virtus et Potestas.",
    ogTitle: "КАРТЕЛЬ — Фамильный герб, наследие, Лондон",
    twTitle: "КАРТЕЛЬ — Фамильный герб, наследие, Лондон",
    twDescription:
      "Фамильный герб семьи Картель, наследие и идентичность. Базируется в Лондоне.",
    locale: "ru_RU",
    altLocale: "en_GB",
  },
};

const noscriptContent: Record<Locale, { intro: string; membersHeading: string; members: string }> = {
  en: {
    intro:
      "The Kartel family coat of arms is a heraldic composition featuring a griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the Latin motto “Virtus et Potestas” (Strength and Power). Based in London, United Kingdom.",
    membersHeading: "Family Members",
    members:
      "Piotr Kartel & Valentina Kartel — Elder generation; Igor Gor Kartel — Family representative in London; Diana Kartel — Present generation; Dominika, Arina, Igor Kaid, Feliks Kartel — Next generation.",
  },
  ru: {
    intro:
      "Фамильный герб Картель — геральдическая композиция с грифоном, скрещёнными ключами, короной, мечами, лилиями, крыльями и латинским девизом «Virtus et Potestas» (Сила и Власть). Базируется в Лондоне, Великобритания.",
    membersHeading: "Члены семьи",
    members:
      "Пётр Картель и Валентина Картель — старшее поколение; Игорь Гор Картель — представитель семьи в Лондоне; Диана Картель — настоящее поколение; Доминика, Арина, Игорь Каид, Феликс Картель — следующее поколение.",
  },
};

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

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
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
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
      "theme-color": "#876035",
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
