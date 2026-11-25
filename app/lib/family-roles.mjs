/**
 * Family roles (bus 87). owner = FAMILY_ADMIN_EMAILS (publishes, approves, manages access);
 * editor = FAMILY_EDITOR_EMAILS (opens the editor; every change waits for the owner's approval);
 * everyone else approved into the family is a member. The owner list wins if an address is on both.
 * Local allowlists only — never a federation role.
 */
const norm = (s) => String(s ?? "").trim().toLowerCase();

/** @returns {"owner" | "editor" | "member"} */
export function familyRoleOf(subject, owners, editors) {
  const s = norm(subject);
  if (!s) return "member";
  if (owners.includes(s)) return "owner";
  if (editors.includes(s)) return "editor";
  return "member";
}

/** The actor family-media sees, always with its role (QA-156 L4): "owner:<address>", "editor:<address>" (the
 *  service then turns every write into a proposal) or "member:<address>" (reads published content only). */
export const mediaActorFor = (role, subject) => `${role === "owner" || role === "editor" ? role : "member"}:${norm(subject)}`;
