/**
 * Family access entitlement (kartel-site) — LOCAL authz, fail-closed.
 *
 * "Approved to view the Family Heritage area" is a LOCAL entitlement, NOT the federation
 * MembershipEdge and NOT a global role (Federation v2: authz local). P2 backs this with a
 * provisioned datastore (Vercel Postgres/KV) holding family_access {cpifSubjectId, status}.
 * Until that datastore exists, this is FAIL-CLOSED: no ordinary viewer is approved. Admins
 * (FAMILY_ADMIN_SUBS, e.g. R0) are allowed so approval tooling can be operated once wired.
 *
 * FEDERATION-V2 reference-implementation, ratification-pending
 * Pattern: local entitlement keyed by cpifSubjectId + env admin bootstrap; fail-closed stub
 *   pending the P2 datastore. Ratification gate: R0 act OR second-federated-client adoption.
 * Vault: KARTEL-Vault/40-Observations/2026-07-16-refimpl-kartel-site-family-gate.md
 */

import { get } from "@vercel/edge-config";
import { familyEnv } from "@/app/lib/family-env";

export type FamilyAccessStatus = "pending" | "approved" | "revoked";

/**
 * True iff this viewer may see the Family Heritage area. FAIL-CLOSED.
 *
 * Approval sources (any one grants; an explicit Edge Config "revoked" on the sub OR email overrides
 * every allow except admin):
 *   1. Admin — `FAMILY_ADMIN_SUBS` (R0). Always allowed.
 *   2. By cpifSubjectId — Edge Config item `familyAccess` ({ "<sub>": "approved"|"revoked" }). P2.
 *   3. By email — Edge Config item `familyAccessEmails` ({ "<email>": "approved"|"revoked" })
 *      for runtime add/revoke, OR the static founder seed `FAMILY_APPROVED_EMAILS` (env). The email
 *      is the practical INVITE key (a sub only exists post-login); it is IdP-asserted, so trusted.
 * Both the edge gate (proxy.ts) and the page guard call this. Edge Config read error → the sub/email
 * Edge Config checks are skipped but the static env allowlist still applies (overall still fail-closed).
 */
export async function isViewerApproved(cpifSubjectId: string, email?: string): Promise<boolean> {
  if (familyEnv.adminSubs().includes(cpifSubjectId)) return true;
  const em = (email ?? "").trim().toLowerCase();
  try {
    const [fa, fae] = await Promise.all([
      get<Record<string, FamilyAccessStatus>>("familyAccess"),
      get<Record<string, FamilyAccessStatus>>("familyAccessEmails"),
    ]);
    // Explicit revoke (by sub or email) beats any allow below.
    if (fa?.[cpifSubjectId] === "revoked") return false;
    if (em && fae?.[em] === "revoked") return false;
    if (fa?.[cpifSubjectId] === "approved") return true;
    if (em && fae?.[em] === "approved") return true;
  } catch {
    // Edge Config unreachable → fall through to the static env allowlist.
  }
  if (em && familyEnv.approvedEmails().includes(em)) return true;
  return false;
}
