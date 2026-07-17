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
 * True iff this subject may view the Family Heritage area. FAIL-CLOSED.
 * P2 (2026-07-17): family_access is a Vercel **Edge Config** item `familyAccess`
 *   ({ "<cpifSubjectId>": "approved" | "revoked" }) — edge-readable, so both the edge gate
 *   (proxy.ts) and the page guard use it. R0 approves/revokes by editing the item (no redeploy).
 *   Admins (FAMILY_ADMIN_SUBS) are always allowed. Any read error → not approved (fail-closed).
 */
export async function isViewerApproved(cpifSubjectId: string): Promise<boolean> {
  if (familyEnv.adminSubs().includes(cpifSubjectId)) return true;
  try {
    const fa = await get<Record<string, FamilyAccessStatus>>("familyAccess");
    return fa?.[cpifSubjectId] === "approved";
  } catch {
    return false;
  }
}
