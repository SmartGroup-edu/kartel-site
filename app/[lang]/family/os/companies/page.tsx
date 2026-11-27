import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, guestMay } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState } from "@/app/lib/family-os";
import { companyCards, mergeCards, privateCompanyCards } from "@/app/lib/family-companies.mjs";
import { PRIVATE_COMPANIES } from "@/app/content/companies-private";
import registry from "@/app/content/registry.public.json";
import FamilyCompanies, { type CompanyCard } from "@/app/components/FamilyCompanies";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";
import { childHome } from "@/app/lib/family-child";

// Gated like every Family OS page; never indexed.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Компании и проекты · Семейный кабинет" : "Companies and projects · Family area", robots: { index: false, follow: false } };
}

/**
 * «Компании и проекты» (bus 172 P6). The cards come from the vendored registry (registry.public.json) and, since
 * bus 176 P3, the server-only companies-private.ts (Craft Resin, Eco Lock HD, KARTEL), both on the server,
 * so the page reads no Family OS data of its own: /me and /people (who may see it), /my-tasks (the shell's badge).
 * Members and the owner; a child is sent back to «Мой день».
 */
export default async function FamilyCompaniesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  // bus 176 P4: a guest whose sections include «Компании и проекты» reads the cards (site data; the edge logged the view).
  if (!session || !(decision === "allow" || (decision === "guest" && guestMay(session, "companies")))) notFound();
  const L = lang === "ru" ? "RU" : "EN";
  const state = await getOsState(session);
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.companies[L]} />;
  if (!state.me && !state.admin && !session.guest) notFound();
  childHome(lang, state.me);
  return <FamilyCompanies lang={L} cards={mergeCards(companyCards(registry), privateCompanyCards(PRIVATE_COMPANIES)) as CompanyCard[]} registry={{ version: registry.version, updated: registry.updated }} />;
}
