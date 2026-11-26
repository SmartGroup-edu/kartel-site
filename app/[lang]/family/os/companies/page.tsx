import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState } from "@/app/lib/family-os";
import { companyCards } from "@/app/lib/family-companies.mjs";
import registry from "@/app/content/registry.public.json";
import FamilyCompanies, { type CompanyCard } from "@/app/components/FamilyCompanies";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";
import { childHome } from "@/app/lib/family-child";

// Gated like every Family OS page; never indexed.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Компании и проекты · Семья" : "Companies and projects · Family", robots: { index: false, follow: false } };
}

/**
 * «Компании и проекты» (bus 172 P6). The cards come from the vendored registry (registry.public.json) on the server,
 * so the page reads no Family OS data of its own: /me and /people (who may see it), /my-tasks (the shell's badge).
 * Members and the owner; a child is sent back to «Мой день».
 */
export default async function FamilyCompaniesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const L = lang === "ru" ? "RU" : "EN";
  const state = await getOsState(session);
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.companies[L]} />;
  if (!state.me && !state.admin) notFound();
  childHome(lang, state.me);
  return <FamilyCompanies lang={L} cards={companyCards(registry) as CompanyCard[]} registry={{ version: registry.version, updated: registry.updated }} />;
}
