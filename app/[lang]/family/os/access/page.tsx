import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { canRegister } from "@/app/lib/family-passkey-rules.mjs";
import { getOsState, getRules, getAdoption } from "@/app/lib/family-os";
import FamilyOsAccess, { type RoleRow, type SigninSummary } from "@/app/components/FamilyOsAccess";
import { roleRows, signinSummary } from "@/app/lib/family-people.mjs";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";
import { childHome } from "@/app/lib/family-child";

// Admin only: people and guardian grants. Members get a 404 (the service also refuses their writes).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Доступ и безопасность · Семья" : "Access and security · Family", robots: { index: false, follow: false } };
}

export default async function FamilyOsAccessPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const state = await getOsState(session);
  // The edge already lets only the owner reach this page; with the service silent they get the calm state too.
  const L = lang === "ru" ? "RU" : "EN";
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.access[L]} />;
  if (!state.admin) notFound();
  childHome(lang, state.me);
  const [rules, adoption] = await Promise.all([getRules(session), getAdoption(session)]);
  // bus 172 P3: «Роли» and «Вход и защита» — read off the allow-lists, the grants and «Кто уже с нами»; no new read.
  const roles = roleRows({ people: state.people, grants: state.grants, owners: familyEnv.adminEmails(), editors: familyEnv.editorEmails(), lang: L }) as RoleRow[];
  const signin = signinSummary({ adoption, passkeysOn: familyEnv.passkeysOn(), lang: L }) as SigninSummary;
  return <FamilyOsAccess lang={L} people={state.people} grants={state.grants} rules={rules} adoption={adoption} ownKeys={familyEnv.passkeysOn() && !state.me ? { canAdd: canRegister(session) } : null} roles={roles} signin={signin} />;
}
