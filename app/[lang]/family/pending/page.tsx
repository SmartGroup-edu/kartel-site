import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CrestAuthHeader, CrestImg, crestStyles as s } from "../../../components/crest/CrestChrome";
import CrestAside from "../../../components/crest/CrestAside";
import { preloadCrestFonts } from "@/app/lib/crestFonts";
import { typographDict } from "@/app/lib/typograph.mjs";

// Gated area sibling — render per-request, never statically prerender. Public, no PII: signed in, not yet approved.
// bus 176 P1: the crest style of the sign-in page (the same header and aside), no business wording.
export const dynamic = "force-dynamic";

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

export const viewport: Viewport = { themeColor: "#0a0908", colorScheme: "dark" };

const copy = {
  en: {
    title: "Family area — pending approval",
    eyebrow: "Family area",
    heading: "Waiting for approval",
    body: "You are signed in, but your access to the family area has not been approved yet. The head of the family reviews each request; you can come in once it is approved.",
    back: "Home",
    aside: "The Kartel coat of arms", mottoTr: "Strength and Power",
    feat: ["Passwordless sign-in", "For the family only", "Approved by the head of the family"],
  },
  ru: typographDict({
    title: "Семейный кабинет — ожидает одобрения",
    eyebrow: "Семейный кабинет",
    heading: "Ожидает одобрения",
    body: "Вы вошли, но доступ в семейный кабинет ещё не одобрен. Глава семьи рассматривает каждый запрос; вы сможете войти после одобрения.",
    back: "На главную",
    aside: "Фамильный герб Картель", mottoTr: "Сила и Власть",
    feat: ["Вход без пароля", "Только для семьи", "Одобряет глава семьи"],
  }),
};

export function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return params.then(({ lang }) => {
    const locale = (LOCALES.includes(lang as Locale) ? lang : "en") as Locale;
    return { title: copy[locale].title, robots: { index: false, follow: false } };
  });
}

export default async function FamilyPendingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  const c = copy[lang as Locale];
  preloadCrestFonts(lang as Locale);
  return (
    <div className={s.site}>
      <a className={s.skip} href="#main">{lang === "ru" ? "Перейти к содержимому" : "Skip to content"}</a>
      <CrestAuthHeader lang={lang as Locale} langHrefs={{ ru: "/ru/family/pending", en: "/en/family/pending" }} back={c.back} />
      <div className={s.page}>
        <CrestAside label={c.aside} mottoTr={c.mottoTr} features={c.feat} />
        <main className={s.main} id="main" tabIndex={-1}>
          <div className={s.card}>
            <div className={`${s.mcrest} ${s.masked}`}><CrestImg sizes="110px" /></div>
            <span className={s.eyebrow}>{c.eyebrow}</span>
            <h1>{c.heading}</h1>
            <p className={s.lede} role="status">{c.body}</p>
            <div className={s.links}>
              <Link className={s.acc} href={`/${lang}`} prefetch={false}>← {c.back}</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
