"use client";

import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { useLangToggle } from "./useLang";

/**
 * Frame for the sign-in, pending and gate pages: the same header, footer and type as the rest
 * of the site, so these pages are no longer dead ends (design audit #5).
 */
export default function AuthShell({ lang, children }: { lang: "en" | "ru"; children: React.ReactNode }) {
  const L = lang === "ru" ? "RU" : "EN";
  const toggleLang = useLangToggle(L);
  return (
    <>
      <SiteHeader lang={L} toggleLang={toggleLang} />
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:py-24">
        {children}
      </main>
      <SiteFooter
        motto="Virtus et Potestas"
        copy={lang === "ru" ? "Ядро KARTEL · публичный реестр федерации" : "KARTEL Core · public registry of the federation"}
        contactEmail={null}
      />
    </>
  );
}
