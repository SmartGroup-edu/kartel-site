import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Gated area sibling — render per-request, never statically prerender.
export const dynamic = "force-dynamic";

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

const copy: Record<Locale, { title: string; heading: string; body: string; back: string }> = {
  en: {
    title: "Family Heritage — pending approval",
    heading: "Registration received",
    body: "Your account is signed in but not yet approved to view the Family Heritage area. An administrator reviews access requests; you will be able to enter once approved.",
    back: "Return to KARTEL",
  },
  ru: {
    title: "Семейное наследие — ожидает одобрения",
    heading: "Заявка получена",
    body: "Вы вошли в аккаунт, но доступ к разделу «Семейное наследие» ещё не одобрен. Администратор рассматривает запросы; вы сможете войти после одобрения.",
    back: "Вернуться на KARTEL",
  },
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
  return (
    <main style={{ maxWidth: "34rem", margin: "0 auto", padding: "6rem 1.5rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>{c.heading}</h1>
      <p style={{ lineHeight: 1.6, opacity: 0.8 }}>{c.body}</p>
      <p style={{ marginTop: "2rem" }}>
        <a href={`/${lang}`}>{c.back}</a>
      </p>
    </main>
  );
}
