import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { familyGateDecision, isFamilyAdmin } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { mediaEnabled } from "@/app/lib/family-media";
import { FAMILY_TREE_NODES, FAMILY_TIMELINE_EVENTS } from "@/app/content/family-private";
import FamilyAdmin from "@/app/components/FamilyAdmin";

// Gated (proxy.ts covers /family/*) and admin-only here; never prerendered, never indexed.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return { title: "Family editor", robots: { index: false, follow: false } };
}

export default async function FamilyAdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  // Not an admin → the page does not exist for you (no hint that an editor is here).
  if (decision !== "allow" || !session || !isFamilyAdmin(session.cpifSubjectId)) notFound();
  return (
    <FamilyAdmin
      lang={lang === "ru" ? "RU" : "EN"}
      enabled={mediaEnabled()}
      people={FAMILY_TREE_NODES.map((n) => ({ id: n.id, nameEN: n.nameEN, nameRU: n.nameRU }))}
      entries={FAMILY_TIMELINE_EVENTS.map((e) => ({ id: e.id, titleEN: e.titleEN, titleRU: e.titleRU, yearEN: e.yearEN, yearRU: e.yearRU }))}
    />
  );
}
