"use client";

import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FamilySubNav from "./FamilySubNav";
import { familyNav } from "../content/siteNav";
import { FAMILY_MAIN, FAMILY_HEADER_MAX } from "../lib/family-nav.mjs";
import { useLangToggle } from "./useLang";

type Lang = "EN" | "RU";
/** `member` (QA-158 N3): false for the owner who is not a member — no Доска/Совет/Календарь, as on every other page. */
export type FamilyChromeNav = { admin: boolean; editor: boolean; os: boolean; member?: boolean; child?: boolean };

/**
 * The family layout around a page that has no data of its own — «не отвечает» and the family 404 (bus 157b D11):
 * the site header with «Выйти», the family sub-nav (no tab marked current) and the same content column.
 */
export default function FamilyChrome({ lang, nav, langHref, children }: { lang: Lang; nav: FamilyChromeNav; langHref?: string; children: React.ReactNode }) {
  const toggleLang = useLangToggle(lang);
  const router = useRouter();
  // A 404 address does not exist in the other language either: `langHref` sends the switch somewhere real.
  return (
    <>
      <SiteHeader lang={lang} toggleLang={langHref ? () => router.push(langHref) : toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} />
      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin={nav.admin} editor={nav.editor} os={nav.os} member={nav.member ?? true} child={nav.child ?? false} />
        <div className="max-w-4xl pb-8">{children}</div>
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}
