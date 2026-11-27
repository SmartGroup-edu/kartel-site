// Shared pieces of the public crest surface (bus 176 P1): the crest image, the RU/EN switch, the sign-in icon,
// the hatching ornament with its cursor light, and the compact header of the sign-in, pending and 404 pages.
// Server-safe (no hooks).
import Image from "next/image";
import Link from "next/link";
import s from "./crest.module.css";
import type { CrestLang } from "../../content/crestHome";

export { s as crestStyles };

/** The crest (public/crest.jpeg, 900×1000), served by next/image as AVIF / WebP at the size the slot needs.
 *  `lcp`: the first-screen crest — eager, high fetch priority (Next 16: `priority` is deprecated). `eager`: load now,
 *  normal priority (the sign-in aside, hidden below 900 px). Otherwise lazy with low fetch priority. */
export function CrestImg({ alt = "", sizes, lcp = false, eager = false, className, width = 900, height = 1000 }: { alt?: string; sizes: string; lcp?: boolean; eager?: boolean; className?: string; width?: number; height?: number }) {
  return <Image src="/crest.jpeg" alt={alt} width={width} height={height} sizes={sizes} loading={lcp || eager ? "eager" : "lazy"} fetchPriority={lcp ? "high" : eager ? undefined : "low"} className={className} />;
}

/** The hero crest's `sizes` (bus 176 P1b): any other first-screen copy of the crest uses the same value, so the browser
 *  picks the same srcset entry — one download, not two. */
export const HERO_SIZES = "(max-width: 900px) min(340px, 86vw), 520px";

/** RU / EN. Links, not buttons: each language is its own address. `hrefs` per language. */
export function LangSwitch({ lang, hrefs, label, className = "" }: { lang: CrestLang; hrefs: Record<CrestLang, string>; label: string; className?: string }) {
  return (
    <div className={`${s.lang} ${className}`} role="group" aria-label={label}>
      {(["ru", "en"] as const).map((l) => (
        <Link key={l} href={hrefs[l]} prefetch={false} hrefLang={l} lang={l} aria-current={l === lang ? "true" : undefined}>
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

export function SignInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

/** The wordmark. Its crest is a dedicated 3 KB file (public/crest-mark.webp, 102×114 — 3× the 34 px slot), not a
 *  next/image variant of the full crest, so the header adds nothing to the first screen's weight (bus 176 P1b). */
export function Brand({ href, label, small = false }: { href: string; label: string; small?: boolean }) {
  return (
    <Link className={s.brand} href={href} prefetch={false} aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 3 KB asset; next/image would only re-encode it */}
      <img src="/crest-mark.webp" alt="" width={small ? 26 : 34} height={small ? 30 : 38} decoding="async" />
      <b>KARTEL</b>
    </Link>
  );
}

/** The heraldic hatching (sable: cross-hatch; gules: vertical lines), each with a base layer and a lit layer. */
export function Hatching() {
  return (
    <>
      <div className={`${s.half} ${s.l}`} aria-hidden="true"><div className={`${s.pl} ${s.base} ${s.hatchA}`} /><div className={`${s.pl} ${s.lit} ${s.hatchA}`} /></div>
      <div className={`${s.half} ${s.r}`} aria-hidden="true"><div className={`${s.pl} ${s.base} ${s.hatchB}`} /><div className={`${s.pl} ${s.lit} ${s.hatchB}`} /></div>
    </>
  );
}

/** Header of the sign-in, pending and 404 pages: the wordmark home, then «← На главную» or «Войти», and RU / EN. */
export function CrestAuthHeader({ lang, langHrefs, back, signin }: { lang: CrestLang; langHrefs: Record<CrestLang, string>; back?: string; signin?: string }) {
  const ru = lang === "ru";
  return (
    <header className={s.authHeader}>
      <Brand href={`/${lang}`} label={ru ? "KARTEL — на главную" : "KARTEL — home"} />
      <div className={s.right}>
        {back && (
          <Link className={s.back} href={`/${lang}`} prefetch={false} aria-label={back}>
            <span aria-hidden="true">←</span> <span className={s.backLabel}>{back}</span>
          </Link>
        )}
        <LangSwitch lang={lang} hrefs={langHrefs} label={ru ? "Язык / Language" : "Language / Язык"} />
        {signin && (
          <Link className={`${s.btn} ${s.gold} ${s.sm}`} href={`/${lang}/family/signin`} prefetch={false} aria-label={signin}>
            <SignInIcon /><span className={s.signinLabel}>{signin}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
