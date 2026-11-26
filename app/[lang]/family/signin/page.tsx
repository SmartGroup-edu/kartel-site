import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FamilyGateNotice } from "../../../components/FamilyGateNotice";
import { safeReturnTo } from "@/app/lib/family-safe-return.mjs";
import { familyEnv } from "@/app/lib/family-env";
import { codesOn } from "@/app/lib/family-signin";

// Public no-PII landing — reachable without a session (excluded from the gate in proxy.ts).
export const dynamic = "force-dynamic";

const LOCALES = ["en", "ru"] as const;
const STATES = ["invalid", "ended", "expired", "elsewhere", "superseded", "used"] as const;
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
  // From /api/family-auth/verify (bus 165): expired · elsewhere (another browser) · superseded · used for a link we
  // signed; `invalid` for anything else (forged, revoked). `ended` from the edge gate. Unknown values → no notice.
  const state = sent === "1" ? "sent" : STATES.find((s) => s === family_auth);
  // The same lifetime the link is signed with (FAMILY_LINK_TTL, default 600 s), shown as text.
  return <FamilyGateNotice lang={lang as Locale} returnTo={dest} state={state} ttlMinutes={familyEnv.linkTtlMinutes()} passkeys={familyEnv.passkeysOn()} codes={codesOn()} />;
}
