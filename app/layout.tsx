import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KARTEL — Coat of Arms, Legacy, London",
    template: "%s | KARTEL",
  },
  description:
    "Kartel family coat of arms, family legacy, and identity based in London. Virtus et Potestas.",
  metadataBase: new URL("https://kartel.org.uk"),
  alternates: {
    canonical: "/",
    languages: {
      "en": "https://kartel.org.uk/?lang=EN",
      "ru": "https://kartel.org.uk/?lang=RU",
      "x-default": "https://kartel.org.uk/",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    alternateLocale: "ru_RU",
    siteName: "KARTEL",
    title: "KARTEL — Coat of Arms, Legacy, London",
    description:
      "Kartel family coat of arms, family legacy, and identity based in London. Virtus et Potestas.",
    url: "https://kartel.org.uk",
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
    title: "KARTEL — Coat of Arms, Legacy, London",
    description:
      "Kartel family coat of arms, family legacy, and identity based in London.",
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
  other: {
    "theme-color": "#9b723a",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased scroll-smooth">
      <body className="min-h-full flex flex-col">
        {children}
        <noscript>
          <div style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "Georgia, serif", color: "#2b2824" }}>
            <h1 style={{ color: "#9b723a", fontSize: "32px", marginBottom: "16px" }}>KARTEL — Coat of Arms of the Kartel Family</h1>
            <p style={{ fontSize: "18px", lineHeight: "1.8", marginBottom: "16px" }}>
              The Kartel family coat of arms is a heraldic composition featuring a griffin, crossed keys,
              coronet, swords, fleur-de-lis, wings, and the Latin motto &ldquo;Virtus et Potestas&rdquo;
              (Strength and Power). Based in London, United Kingdom.
            </p>
            <h2 style={{ color: "#9b723a", fontSize: "24px", marginBottom: "12px" }}>Family Members</h2>
            <ul style={{ fontSize: "16px", lineHeight: "2" }}>
              <li><strong>Piotr Kartel</strong> &amp; <strong>Valentina Kartel</strong> — Elder generation</li>
              <li><strong>Igor Gor Kartel</strong> — Family representative in London</li>
              <li><strong>Diana Kartel</strong> — Present generation</li>
              <li><strong>Dominika Kartel</strong>, <strong>Arina Kartel</strong>, <strong>Igor Kaid Kartel</strong>, <strong>Feliks Kartel</strong> — Next generation</li>
            </ul>
            <p style={{ fontSize: "14px", color: "#6f685c", marginTop: "24px" }}>
              &copy; kartel.org.uk — Virtus et Potestas
            </p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
