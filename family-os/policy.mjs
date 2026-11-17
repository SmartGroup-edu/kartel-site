// Who may do what in Family OS (plan v3 §3, §6.2; R0 decisions 2026-11-16). Pure, unit-tested.
//
// - The site signs the actor as "admin:<email>" or "member:<email>" (admin = FAMILY_ADMIN_EMAILS).
// - Admin manages people and guardian grants. Admin is NOT an implicit reader of anyone's notes:
//   reading follows the same rules for everyone (least privilege).
// - An adult's care notes: only that adult.
// - A child's care notes of kind K: only a guardian with an active grant whose scopes include K.
//   Both parents get a parent grant; any other relative only by an explicit admin grant.
// - A child does not read or edit health/education notes (plan v3 §3).

export const NOTE_KINDS = ["health", "education"];
export const SCOPES = ["routines", "health", "education", "documents"];

/** "admin:a@b" → { role: "admin", email: "a@b" }; anything else → null */
export function parseActor(actor) {
  const m = /^(admin|member):([^\s@:]+@[^\s@:]+)$/.exec(String(actor ?? ""));
  return m ? { role: m[1], email: m[2].toLowerCase() } : null;
}

const active = (g) => !g.revoked_at;

/** @returns {string[]} the note kinds `me` may read (and write) for `subject` */
export function noteKindsFor(me, subject, grants) {
  if (!me || !subject) return [];
  if (subject.kind === "adult") return me.id === subject.id ? [...NOTE_KINDS] : [];
  if (me.id === subject.id) return []; // a child does not read their own health/education notes
  const scopes = new Set(grants.filter((g) => active(g) && g.guardian_id === me.id && g.child_id === subject.id).flatMap((g) => g.scopes));
  return NOTE_KINDS.filter((k) => scopes.has(k));
}

/** Validate a new grant: both people exist, guardian is an adult, subject is a child, scopes known. */
export function checkGrant({ guardian, child, relation, scopes }) {
  if (!guardian || !child) return "unknown_person";
  if (guardian.id === child.id) return "self";
  if (guardian.kind !== "adult") return "guardian_not_adult";
  if (child.kind !== "child") return "subject_not_child";
  if (!["parent", "relative"].includes(relation)) return "bad_relation";
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some((s) => !SCOPES.includes(s))) return "bad_scopes";
  if (new Set(scopes).size !== scopes.length) return "bad_scopes";
  return null;
}

// ---- Stage 2a: documents (R0 2026-11-17) ---------------------------------------------------------
// - A person's documents: the holder (a minor too — unlike health notes) and guardians whose active
//   grant includes "documents". An adult's documents: that adult only.
// - Admin may ADD documents for anyone (R0 uploads the family's papers) but reads them only when one
//   of the rules above applies — admin is still not an implicit reader.
// - Heritage archive records (not a person): admin only.
// - Birth date / age on a profile: the person, their guardians (any scope), the admin.

const guardianOf = (me, subject, grants, scope) =>
  grants.some((g) => !g.revoked_at && g.guardian_id === me.id && g.child_id === subject.id && (!scope || g.scopes.includes(scope)));

export function canReadDocuments(me, subject, grants) {
  if (!me || !subject) return false;
  if (me.id === subject.id) return true;
  return subject.kind === "child" && guardianOf(me, subject, grants, "documents");
}

export function canAddDocuments(me, subject, grants, admin) {
  return Boolean(admin) || canReadDocuments(me, subject, grants);
}

export function canSeeBirth(me, subject, grants, admin) {
  if (admin) return true;
  if (!me || !subject) return false;
  return me.id === subject.id || guardianOf(me, subject, grants, null);
}

export const DOC_TYPES = ["passport", "national_id", "ni_number", "residence", "other"];
