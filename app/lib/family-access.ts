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
 * True iff this viewer may see the Family Heritage area. FAIL-CLOSED.
 *
 * Approval sources (any one grants; an explicit Edge Config "revoked" on the email overrides
 * every allow except admin):
 *   1. Admin — `FAMILY_ADMIN_EMAILS` (R0). Always allowed.
 *   2. Edge Config item `familyAccessEmails` ({ "<email>": "approved"|"revoked" }) for runtime
 *      add/revoke, OR the static founder seed `FAMILY_APPROVED_EMAILS` (env).
 * The subject-keyed Edge Config item `familyAccess` is no longer read: it was never written to
 * (key absent in production, verified 2026-11-14), so nothing is orphaned by dropping it.
 * Both the edge gate (proxy.ts) and the page guard call this. Edge Config read error → the
 * Edge Config check is skipped but the static env allowlist still applies (overall still fail-closed).
 */
export async function isViewerApproved(subject: string, email?: string): Promise<boolean> {
  const subj = subject.trim().toLowerCase();
  if (familyEnv.adminEmails().includes(subj)) return true;
  const em = (email ?? subj).trim().toLowerCase();
  try {
    const fae = await get<Record<string, FamilyAccessStatus>>("familyAccessEmails");
    // Explicit revoke beats any allow below.
    if (em && fae?.[em] === "revoked") return false;
    if (em && fae?.[em] === "approved") return true;
  } catch {
    // Edge Config unreachable → fall through to the static env allowlist.
  }
  if (em && familyEnv.approvedEmails().includes(em)) return true;
  return false;
}
