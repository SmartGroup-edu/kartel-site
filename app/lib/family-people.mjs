/**
 * «Люди» and «Доступ и безопасность» (bus 172 P3, mockup v5): the cards, the role rows and the sign-in summary, built
 * on the server from what Family OS already returns (/people with grants, /board, /adoption). Pure; tested in
 * tests/family-people.test.mjs.
 *
 * Roles are the ones the model has — nothing more: the owner (FAMILY_ADMIN_EMAILS), a heritage editor
 * (FAMILY_EDITOR_EMAILS), an adult family member (a parent when they hold a parent grant, a relative when they hold
 * only relative grants) and a child. There is no guest role and no expiry; «what they see» is read off the same rules
 * the menu uses (family-os-shell.mjs) and the grants.
 */

const nameOf = (p, lang) => (p ? (lang === "EN" ? p.name_en : p.name_ru) : "");
const collator = (lang) => new Intl.Collator(lang === "EN" ? "en" : "ru");

/** adult: "parent" (any parent grant) · "relative" (relative grants only) · "adult"; a child is "child". */
export function relationOf(person, grants) {
  if (person.kind === "child") return "child";
  const mine = (grants ?? []).filter((g) => g.guardian_id === person.id);
  if (mine.some((g) => g.relation === "parent")) return "parent";
  if (mine.length) return "relative";
  return "adult";
}

/**
 * One card per person: role, who the parents are (a child), whose areas a relative sees, and the open load today from
 * the board. `load` is null when the board did not answer — no number, not a zero.
 * @param {{ people: any[], grants: any[], board: any, meId: string | null, lang: "EN" | "RU" }} o
 */
export function peopleCards({ people, grants, board, meId, lang }) {
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const members = new Map((board?.members ?? []).map((m) => [m.id, m]));
  const c = collator(lang);
  const cards = (people ?? []).map((p) => {
    const rel = relationOf(p, grants);
    const parents = p.kind === "child" ? (grants ?? []).filter((g) => g.child_id === p.id && g.relation === "parent").map((g) => nameOf(byId.get(g.guardian_id), lang)).filter(Boolean) : [];
    const sees = rel === "relative" ? (grants ?? []).filter((g) => g.guardian_id === p.id).map((g) => ({ child: nameOf(byId.get(g.child_id), lang), scopes: g.scopes })) : [];
    const kids = rel === "parent" ? (grants ?? []).filter((g) => g.guardian_id === p.id && g.relation === "parent").map((g) => nameOf(byId.get(g.child_id), lang)).filter(Boolean) : [];
    const m = members.get(p.id);
    const load = board ? (m ? { open: Math.max(0, m.total - m.done), done: m.done, total: m.total, current: m.current?.title ?? null, routines: m.routines ?? null } : { open: 0, done: 0, total: 0, current: null, routines: null }) : null;
    return { id: p.id, name: nameOf(p, lang), kind: p.kind, rel, parents, kids, sees, load, me: p.id === meId };
  });
  const rank = { parent: 0, relative: 1, adult: 1, child: 2 };
  return cards.sort((a, b) => rank[a.rel] - rank[b.rel] || c.compare(a.name, b.name));
}

/**
 * «Роли» on «Доступ и безопасность» (owner only — the owner's view is the one that carries emails). Each row: the
 * person, their role and the sections they reach, from the real rules.
 * @param {{ people: any[], grants: any[], owners: string[], editors: string[], lang: "EN" | "RU" }} o
 */
export function roleRows({ people, grants, owners, editors, lang }) {
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const own = new Set((owners ?? []).map(norm)), ed = new Set((editors ?? []).map(norm));
  const c = collator(lang);
  const rows = (people ?? []).map((p) => {
    const rel = relationOf(p, grants);
    const email = norm(p.email);
    const role = p.kind === "child" ? "child" : own.has(email) ? "owner" : ed.has(email) ? "editor" : "member";
    const sees = rel === "relative" ? (grants ?? []).filter((g) => g.guardian_id === p.id).map((g) => ({ child: nameOf(people.find((x) => x.id === g.child_id), lang), scopes: g.scopes })) : [];
    return { id: p.id, name: nameOf(p, lang), role, rel, sees };
  });
  const rank = { owner: 0, editor: 1, member: 2, child: 3 };
  return rows.sort((a, b) => rank[a.role] - rank[b.role] || c.compare(a.name, b.name));
}

/**
 * «Вход и защита»: the sign-in methods and the latest sign-in. Read-only — the passkey switch is a deploy setting
 * (FAMILY_PASSKEYS), the letter with the link and the 6-digit code is always on. Dates only: Family OS keeps the day
 * of a sign-in, not the time or the device.
 * @param {{ adoption: any, passkeysOn: boolean, lang: "EN" | "RU" }} o
 */
export function signinSummary({ adoption, passkeysOn, lang }) {
  const rows = adoption?.people ?? null;
  const withKey = rows && passkeysOn ? rows.filter((r) => r.passkey === true).length : null;
  const seen = rows ? rows.filter((r) => r.signed_in).sort((a, b) => b.signed_in.last_on.localeCompare(a.signed_in.last_on)) : [];
  const last = seen[0] ? { name: nameOf(seen[0], lang), on: seen[0].signed_in.last_on } : null;
  const never = rows ? rows.filter((r) => !r.signed_in).length : null;
  return { passkeys: passkeysOn, withKey, of: rows ? rows.length : null, last, never };
}
