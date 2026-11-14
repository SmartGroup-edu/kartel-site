import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AuthShell from "../../../components/AuthShell";

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
    <AuthShell lang={lang as Locale}>
      <h1 className="font-serif text-3xl text-[var(--foreground)]">{c.heading}</h1>
      <p className="mt-3 text-base leading-relaxed text-[var(--text-body)]">{c.body}</p>
      <p className="mt-8">
        <a href={`/${lang}`} className="rounded-sm py-1 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]">
          ← {c.back}
        </a>
      </p>
    </AuthShell>
  );
}
