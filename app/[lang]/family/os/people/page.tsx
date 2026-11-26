import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getBoard, getAdoption } from "@/app/lib/family-os";
import { accessListState, type AccessListState } from "@/app/lib/family-access";
import { pendingCards } from "@/app/lib/family-invite.mjs";
import { peopleCards } from "@/app/lib/family-people.mjs";
import FamilyOs, { type PersonCard, type InviteData } from "@/app/components/FamilyOs";
import FamilyOsDown from "@/app/components/FamilyOsDown";
import { OS_DOWN_TITLE } from "@/app/lib/family-os-down";
import { childHome } from "@/app/lib/family-child";

// Gated (proxy.ts covers /family/*); never prerendered, never indexed. Data comes from family-os.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Люди · Семья" : "People · Family", robots: { index: false, follow: false } };
}

export default async function FamilyOsPeoplePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const L = lang === "ru" ? "RU" : "EN";
  const state = await getOsState(session);
  if (state.status !== "ok") return <FamilyOsDown lang={L} status={state.status} title={OS_DOWN_TITLE.people[L]} />;
  childHome(lang, state.me);
  // bus 172 P3: the open load on each card is today's board (the same read «Задачи» and «Сегодня» make).
  // bus 172 P4: the owner also gets «+ Пригласить» and «Ждут ответа» — from /adoption (+1 call) and the site's access
  // list (Edge Config / env, no Family OS call), read only for people who have not signed in yet.
  const adoptionRead = state.admin ? getAdoption(session) : null;
  const board = state.me || state.admin ? await getBoard(session) : null;
  const adoption = await adoptionRead;
  const cards = peopleCards({ people: state.people, grants: state.grants, board, meId: state.me?.id ?? null, lang: L }) as PersonCard[];
  let invite: InviteData | null = null;
  if (state.admin) {
    const waiting = (adoption?.people ?? []).filter((r) => !r.signed_in);
    const listed: Record<string, AccessListState> = Object.fromEntries(await Promise.all(waiting.map(async (r) => {
      const email = state.people.find((p) => p.id === r.id)?.email;
      return [r.id, email ? await accessListState(email) : "unknown"] as const;
    })));
    invite = { pending: pendingCards({ adoption, listed }) as InviteData["pending"] };
  }
  return <FamilyOs lang={L} state={state} cards={cards} invite={invite} />;
}
