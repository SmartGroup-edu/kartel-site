/**
 * Family-gate decision (kartel-site). Server-side only (uses next/headers via getSession).
 *
 * Used by the /family page guard (P3) and the admin surface (P2). NOT used in proxy.ts
 * (the edge proxy only checks the FAMILY_GATE flag; the page self-guards).
 */

import { getSession, type FamilySession } from "@/app/lib/family-auth";
import { isViewerApproved } from "@/app/lib/family-access";
import { familyEnv } from "@/app/lib/family-env";

export type GateDecision = "login" | "pending" | "allow";

/** Decide what a request to a gated Family route should do. Fail-closed. */
export async function familyGateDecision(): Promise<{
  decision: GateDecision;
  session: FamilySession | null;
}> {
  const session = await getSession();
  if (!session) return { decision: "login", session: null };
  const approved = await isViewerApproved(session.cpifSubjectId, session.email);
  return { decision: approved ? "allow" : "pending", session };
}

/** True iff this subject is a Family admin (local bootstrap allowlist, not a federation role). */
export function isFamilyAdmin(cpifSubjectId: string): boolean {
  return familyEnv.adminSubs().includes(cpifSubjectId);
}
