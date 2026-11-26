/**
 * Family access entitlement (kartel-site) — LOCAL authz, fail-closed.
 *
 * STANDALONE AUTH (R0 decision 2026-11-14): the email IS the identity, so `subject` and `email`
 * are the same lowercased address. The allowlist is therefore the user list and no datastore is
 * required — approval state lives in Edge Config, the founder seed lives in env.
 *
 * Fail-closed: an address that is not an admin, not approved in Edge Config, and not in the
 * founder seed is refused.
 */

import { get } from "@vercel/edge-config";
import { familyEnv } from "@/app/lib/family-env";

export type FamilyAccessStatus = "pending" | "approved" | "revoked";

/**
 * True iff this viewer may see the family area («Семейный кабинет»). FAIL-CLOSED.
 *
 * Approval sources (any one grants; an explicit Edge Config "revoked" on the email overrides
 * every allow except admin):
 *   1. Admin — `FAMILY_ADMIN_EMAILS` (R0). Always allowed.
 *   2. Edge Config item `familyAccessEmails` ({ "<email>": "approved"|"revoked" }) for runtime
 *      add/revoke, OR the static founder seed `FAMILY_APPROVED_EMAILS` (env).
 * The subject-keyed Edge Config item `familyAccess` is no longer read: it was never written to
 * (key absent in production, verified 2026-11-14), so nothing is orphaned by dropping it.
 * Both the edge gate (proxy.ts) and the page guard call this. QA-156 L3: when Edge Config cannot be
 * read, a revocation there cannot be seen either, so the env seed no longer lets anyone in — only admins
 * pass until Edge Config answers again (fail-closed for the seed addresses too).
 */
export async function isViewerApproved(subject: string, email?: string): Promise<boolean> {
  const subj = subject.trim().toLowerCase();
  if (familyEnv.adminEmails().includes(subj)) return true;
  const em = (email ?? subj).trim().toLowerCase();
  if (!em) return false;
  let fae: Record<string, FamilyAccessStatus> | undefined;
  // No Edge Config connected at all (local dev, a QA stand): the env seed is the whole list.
  if (process.env.EDGE_CONFIG) {
    try {
      fae = await get<Record<string, FamilyAccessStatus>>("familyAccessEmails");
    } catch {
      console.warn("[family-access] Edge Config unreadable: seed addresses refused until it answers");
      return false;
    }
  }
  // Explicit revoke beats any allow below.
  if (fae?.[em] === "revoked") return false;
  if (fae?.[em] === "approved") return true;
  return familyEnv.approvedEmails().includes(em);
}

/**
 * bus 172 P4: the owner's view of one address on the access list, for the invite wizard and «Ждут ответа». Same
 * sources and order as isViewerApproved, but it tells "not on the list" apart from "could not read the list".
 * Read-only: nothing here adds or removes an address.
 */
export type AccessListState = "listed" | "not_listed" | "revoked" | "unknown";
export async function accessListState(email: string): Promise<AccessListState> {
  return (await accessListStates([email]))[0];
}
/** The same, for several addresses with one Edge Config read (QA P4: «Люди» read it once per waiting person). */
export async function accessListStates(emails: string[]): Promise<AccessListState[]> {
  let fae: Record<string, FamilyAccessStatus> | undefined, unread = false;
  if (emails.length && process.env.EDGE_CONFIG) {
    try { fae = await get<Record<string, FamilyAccessStatus>>("familyAccessEmails"); } catch { unread = true; }
  }
  return emails.map((email) => {
    const em = email.trim().toLowerCase();
    if (!em) return "not_listed";
    if (familyEnv.adminEmails().includes(em)) return "listed";
    if (unread) return "unknown";
    if (fae?.[em] === "revoked") return "revoked";
    if (fae?.[em] === "approved" || familyEnv.approvedEmails().includes(em)) return "listed";
    return "not_listed";
  });
}
