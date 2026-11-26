"use client";

import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { useLangToggle } from "./useLang";

/**
 * Frame for the sign-in, pending and gate pages: the same header, footer and type as the rest
 * of the site, so these pages are no longer dead ends (design audit #5).
 *
 * `aside` (bus 172 P5, mockup v5 sign-in): two panels in the v5 palette ([data-fos]) — the aside on the left from
 * 900 px, the form on a panel on the right; below 900 px only the form, as in the mockup.
 */
export default function AuthShell({ lang, aside, children }: { lang: "en" | "ru"; aside?: React.ReactNode; children: React.ReactNode }) {
  const L = lang === "ru" ? "RU" : "EN";
  const toggleLang = useLangToggle(L);
  const footer = <SiteFooter motto="Virtus et Potestas" copy="KARTEL" contactEmail={null} />;
  if (aside) {
    return (
      <div data-fos="" className="flex min-h-screen flex-col bg-[var(--fos-bg)] text-[var(--foreground)]">
        <SiteHeader lang={L} toggleLang={toggleLang} />
        <main id="main" className="mx-auto grid w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 min-[900px]:grid-cols-[1.1fr_1fr] min-[900px]:gap-6 min-[900px]:py-10 lg:px-10">
          {aside}
          <div className="grid place-items-center rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] px-5 py-10 shadow-[var(--fos-shadow)] sm:px-10 sm:py-14">
            <div className="w-full max-w-[380px]">{children}</div>
          </div>
        </main>
        {footer}
      </div>
    );
  }
  return (
    <>
      <SiteHeader lang={L} toggleLang={toggleLang} />
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:py-24">
        {children}
      </main>
      {footer}
    </>
  );
}
