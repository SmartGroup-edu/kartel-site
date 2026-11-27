import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { FamilyGateNotice } from "../../../components/FamilyGateNotice";
import { safeReturnTo } from "@/app/lib/family-safe-return.mjs";
import { familyEnv } from "@/app/lib/family-env";
import { codesOn } from "@/app/lib/family-signin";
import { preloadCrestFonts } from "@/app/lib/crestFonts";

// Public no-PII landing — reachable without a session (excluded from the gate in proxy.ts).
export const dynamic = "force-dynamic";

const LOCALES = ["en", "ru"] as const;
const STATES = ["invalid", "ended", "expired", "elsewhere", "superseded", "used"] as const;
type Locale = (typeof LOCALES)[number];

export const viewport: Viewport = { themeColor: "#0a0908", colorScheme: "dark" };

export function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return params.then(({ lang }) => {
    const locale = (LOCALES.includes(lang as Locale) ? lang : "en") as Locale;
    return {
      title: { absolute: locale === "ru" ? "Вход для семьи — KARTEL" : "Family sign-in — KARTEL" },
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
  const query = await searchParams;
  const { returnTo, family_auth, sent } = query;
  // bus 176 P1: after sign-in, the page the person came for — or «Сегодня» (the sitemap mockup), not the heritage page.
  const dest = safeReturnTo(returnTo, `/${lang}/family/os`);
  // From /api/family-auth/verify (bus 165): expired · elsewhere (another browser) · superseded · used for a link we
  // signed; `invalid` for anything else (forged, revoked). `ended` from the edge gate. Unknown values → no notice.
  const state = sent === "1" ? "sent" : STATES.find((s) => s === family_auth);
  // RU / EN keep the query, so switching language keeps the state and the destination.
  const qs = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  const langHrefs = { ru: `/ru/family/signin${qs ? `?${qs}` : ""}`, en: `/en/family/signin${qs ? `?${qs}` : ""}` };
  preloadCrestFonts(lang as Locale);
  // The same lifetime the link is signed with (FAMILY_LINK_TTL, default 600 s), shown as text.
  return <FamilyGateNotice lang={lang as Locale} returnTo={dest} state={state} ttlMinutes={familyEnv.linkTtlMinutes()} passkeys={familyEnv.passkeysOn()} codes={codesOn()} langHrefs={langHrefs} />;
}
