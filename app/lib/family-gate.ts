/**
 * Family-gate decision (kartel-site). Server-side only (uses next/headers via getSession).
 *
 * Used by the /family page guard (P3) and the admin surface (P2). NOT used in proxy.ts
 * (the edge proxy only checks the FAMILY_GATE flag; the page self-guards).
 */

import { cache } from "react";
import { getSession, type FamilySession } from "@/app/lib/family-auth";
import { isViewerApproved } from "@/app/lib/family-access";
import { familyEnv } from "@/app/lib/family-env";
import { familyRoleOf, mediaActorFor } from "@/app/lib/family-roles.mjs";
import { osSessionState } from "@/app/lib/family-os-session.mjs";
import { guestLookup } from "@/app/lib/family-guest.mjs";

/** "guest" (bus 176 P4): a read-only guest. Every caller that checks `decision !== "allow"` keeps refusing them; only
 *  the guest's section pages and the Family OS shell accept "guest" by name. */
export type GateDecision = "login" | "pending" | "allow" | "guest";

/** Decide what a request to a gated Family route should do. Fail-closed. Asked once per render (bus 171): the
 *  Family OS layout and its page share the answer through React `cache`, which lives for one request only. */
export const familyGateDecision = cache(async (): Promise<{
  decision: GateDecision;
  session: FamilySession | null;
}> => {
  const session = await getSession();
  if (!session) return { decision: "login", session: null };
  const approved = await isViewerApproved(session.cpifSubjectId, session.email);
  if (approved) return { decision: "allow", session };
  const g = await guestLookup({ email: session.email, sat: Math.floor(session.issuedAt.getTime() / 1000) });
  return g.state === "active" ? { decision: "guest", session: { ...session, guest: g.guest as FamilySession["guest"] } } : { decision: "pending", session };
});

/** A guest's page: their section only. The edge already sent them home from anything else; this is the second wall. */
export const guestMay = (session: FamilySession | null, section: "calendar" | "kodeks" | "companies" | "review") =>
  Boolean(session?.guest?.sections.includes(section));

/**
 * QA-156 H1: has the owner ended this session («Завершить сеансы»)? For /api routes outside Family OS
 * (family-media, the family editor), which proxy.ts does not see. Only an explicit answer from Family OS
 * counts; while it is off or down this is false (Family OS's own routes still refuse without it).
 */
export async function sessionEndedByOwner(session: FamilySession, opts: { cacheMs?: number } = {}): Promise<boolean> {
  const iat = Math.floor(session.issuedAt.getTime() / 1000);
  return (await osSessionState({ email: session.email, admin: isFamilyAdmin(session.cpifSubjectId), iat, cacheMs: opts.cacheMs })).state === "ended";
}

/** True iff this viewer is a Family admin (local allowlist — never a federation role). Owner only. */
export function isFamilyAdmin(subject: string): boolean {
  return familyEnv.adminEmails().includes(subject.trim().toLowerCase());
}

/** owner | editor | member (bus 87). The editor role only ever widens the family editor, never access. */
export function familyRole(subject: string): "owner" | "editor" | "member" {
  return familyRoleOf(subject, familyEnv.adminEmails(), familyEnv.editorEmails()) as "owner" | "editor" | "member";
}
/** The actor family-media is told for this viewer ("editor:<email>" for an editor). */
export const mediaActor = (subject: string) => mediaActorFor(familyRole(subject), subject);
