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

/**
 * "admin:a@b" → { role: "admin", email: "a@b" }; anything else → null.
 * bus 176 P4: "guest:<grant uuid>" → { role: "guest", id, email: "guest:<id>" }. The `email` is only a key (rate limits,
 * the «Завершить сеансы для всех» cut-off); no person has it, so a guest is never `me`.
 */
export function parseActor(actor) {
  const s = String(actor ?? "");
  const g = /^guest:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(s);
  if (g) return { role: "guest", id: g[1], email: `guest:${g[1]}` };
  const m = /^(admin|member):([^\s@:]+@[^\s@:]+)$/.exec(s);
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

// ---- Stage 2: routines and chores (plan v3.8 §3.2, §4.1; bus 72) ---------------------------------
// - Read a person's routines: that person; for a child, guardians whose grant includes "routines".
//   An adult's routines are that adult's own. Admin is not an implicit reader (same as notes).
// - Create / change / archive: an adult for themselves; a guardian with "routines" for a child
//   ("parents assign to minors"). A child does not create or delete their own items.
// - Tick off: the person themselves (a child too) and guardians with "routines".
// Every refusal carries a short reason (plan §3.2) for the screen.

export function routineAccess(me, subject, grants) {
  if (!me || !subject) return { read: false, manage: false, check: false, reason: "not_a_member" };
  if (me.id === subject.id) return { read: true, manage: subject.kind === "adult", check: true, reason: null };
  if (subject.kind === "adult") return { read: false, manage: false, check: false, reason: "adult_private" };
  if (guardianOf(me, subject, grants, "routines")) return { read: true, manage: true, check: true, reason: null };
  return { read: false, manage: false, check: false, reason: guardianOf(me, subject, grants, null) ? "no_scope" : "no_relation" };
}

/** Who may see a child's guardians and their scopes: the child, their guardians, the admin. */
export function canSeeGuardians(me, subject, grants, admin) {
  if (admin) return true;
  if (!me || !subject) return false;
  return me.id === subject.id || guardianOf(me, subject, grants, null);
}

export const ROUTINE_KINDS = ["routine", "chore"];

// ---- Stage 3a: notification settings and pauses (bus 77) ----------------------------------------
// A person's settings and «день без ритма»: the person themselves (a child too — it is their inbox),
// and for a child, guardians with "routines". Admin is not implicit.
export function canEditPrefs(me, subject, grants) {
  if (!me || !subject) return false;
  if (me.id === subject.id) return true;
  return subject.kind === "child" && guardianOf(me, subject, grants, "routines");
}

// ---- Stage 3b: council, goals, calendar (bus 79; plan v3.8 §3.6, §4.1) ---------------------------
// Council: every member reads the agenda, notes and decisions; adults write them. A decision's task is
// ticked by its owner or by any adult. The agenda is aggregate only — no per-person counts.
export const canReadCouncil = (me) => Boolean(me);
export const canWriteCouncil = (me) => Boolean(me) && me.kind === "adult";
export const canTickTask = (me, task) => Boolean(me) && (me.id === task.owner_id || me.kind === "adult");

// Goals (Floor №8): only the owner creates or changes a goal — a child's goals are exactly what the
// child entered; nobody writes goals for someone else. Visibility is the owner's choice:
//   "owner" (default) · "guardians" — «Я и родители»: the child's PARENTS only (QA-156 H2, R0 25.11; a relative's
//   grant, whatever its scopes, does not open them) · "family" (every member).
export const GOAL_SPHERES = ["health", "learning", "character", "finance", "contribution", "joy"];
export const goalVisibilities = (owner) => (owner.kind === "child" ? ["owner", "guardians", "family"] : ["owner", "family"]);
export function canReadGoal(me, goal, owner, grants) {
  if (!me || !owner) return false;
  if (me.id === owner.id) return true;
  if (goal.visibility === "family") return true;
  return goal.visibility === "guardians" && owner.kind === "child"
    && grants.some((g) => !g.revoked_at && g.relation === "parent" && g.guardian_id === me.id && g.child_id === owner.id);
}
export const canWriteGoal = (me, owner) => Boolean(me && owner && me.id === owner.id);

// Calendar: members see family events and the council; adults add family events. Birthdays only where
// the birth date may be seen (canSeeBirth). The personal ICS link is the person's own, nobody else's.
export const canWriteEvent = (me) => Boolean(me) && me.kind === "adult";
export const canSeeBirthday = (me, person, grants) => canSeeBirth(me, person, grants, false);
// R0 2026-11-18 (bus 81): every member sees every living person's birthday as day + month
// (capability "birthday.daymonth"). The year — and so the age — stays under canSeeBirth.
export const canSeeBirthdayDayMonth = (me) => Boolean(me);
