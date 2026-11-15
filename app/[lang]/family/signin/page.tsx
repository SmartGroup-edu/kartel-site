import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FamilyGateNotice } from "../../../components/FamilyGateNotice";
import { safeReturnTo } from "@/app/lib/family-safe-return";
import { familyEnv } from "@/app/lib/family-env";

// Public no-PII landing — reachable without a session (excluded from the gate in proxy.ts).
export const dynamic = "force-dynamic";

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

export function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return params.then(({ lang }) => {
    const locale = (LOCALES.includes(lang as Locale) ? lang : "en") as Locale;
    return {
      title: locale === "ru" ? "Семейное наследие — вход" : "Family Heritage — sign in",
      robots: { index: false, follow: false },
    };
  });
}

export default async function FamilySignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ returnTo?: string; family_auth?: string; sent?: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  const { returnTo, family_auth, sent } = await searchParams;
  const dest = safeReturnTo(returnTo, `/${lang}/family`);
  // `invalid` comes from /api/family-auth/verify on any failure — expired, wrong browser, or
  // revoked. It is deliberately one undifferentiated outcome.
  const state = sent === "1" ? "sent" : family_auth === "invalid" ? "invalid" : undefined;
  // The same lifetime the link is signed with (FAMILY_LINK_TTL, default 600 s), shown as text.
  return <FamilyGateNotice lang={lang as Locale} returnTo={dest} state={state} ttlMinutes={familyEnv.linkTtlMinutes()} />;
}
