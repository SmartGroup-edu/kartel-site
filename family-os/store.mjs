// Family OS storage: Postgres in production, an in-memory twin for tests. Both expose the same
// methods; authorisation lives in server.mjs/policy.mjs, not here.
import { randomUUID } from "node:crypto";

export function pgStore(pool) {
  const q = (sql, args) => pool.query(sql, args);
  const audit = (actor, action, entity) => q("INSERT INTO audit (actor, action, entity) VALUES ($1, $2, $3)", [actor, action, entity]);
  return {
    async findPersonByEmail(email) { return (await q("SELECT * FROM person WHERE email = $1", [email])).rows[0] ?? null; },
    async getPerson(id) { return (await q("SELECT * FROM person WHERE id = $1", [id])).rows[0] ?? null; },
    async listPeople() { return (await q("SELECT id, email, name_en, name_ru, kind FROM person ORDER BY kind, name_en")).rows; },
    async createPerson(p, actor) {
      const id = randomUUID();
      await q("INSERT INTO person (id, email, name_en, name_ru, kind, created_by) VALUES ($1, $2, $3, $4, $5, $6)", [id, p.email, p.name_en, p.name_ru, p.kind, actor]);
      await audit(actor, "person.create", `person:${id}`);
      return id;
    },
    async listGrants() { return (await q("SELECT * FROM guardian_grant WHERE revoked_at IS NULL")).rows; },
    async createGrant(g, actor) {
      const id = randomUUID();
      await q("INSERT INTO guardian_grant (id, guardian_id, child_id, relation, scopes, granted_by) VALUES ($1, $2, $3, $4, $5, $6)", [id, g.guardian_id, g.child_id, g.relation, g.scopes, actor]);
      await audit(actor, "grant.create", `grant:${id}`);
      return id;
    },
    async revokeGrant(id, actor) {
      const r = await q("UPDATE guardian_grant SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [id]);
      if (r.rowCount) await audit(actor, "grant.revoke", `grant:${id}`);
      return r.rowCount === 1;
    },
    async listNotes(personId, kinds) {
      return (await q("SELECT * FROM care_note WHERE person_id = $1 AND kind = ANY($2::text[]) ORDER BY updated_at DESC", [personId, kinds])).rows;
    },
    async createNote(row, actor) {
      await q("INSERT INTO care_note (id, person_id, kind, wrapped_key, title_ct, body_ct, key_version, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [row.id, row.person_id, row.kind, row.wrapped_key, row.title_ct, row.body_ct, row.key_version, actor]);
    },
    async logAccess({ actor, subject, entity, action }) {
      await q("INSERT INTO access_log (actor, subject_person_id, entity, action) VALUES ($1, $2, $3, $4)", [actor, subject, entity, action]);
    },
    async accessLog(limit = 200) {
      return (await q("SELECT id, at, actor, subject_person_id, entity, action FROM access_log ORDER BY id DESC LIMIT $1", [limit])).rows;
    },
  };
}

export function memoryStore() {
  const people = new Map(), grants = new Map(), notes = new Map(), log = [], auditLog = [];
  const now = () => new Date().toISOString();
  return {
    failLog: false, // tests flip this to prove reads fail closed
    async findPersonByEmail(email) { return [...people.values()].find((p) => p.email === email) ?? null; },
    async getPerson(id) { return people.get(id) ?? null; },
    async listPeople() { return [...people.values()].map(({ id, email, name_en, name_ru, kind }) => ({ id, email, name_en, name_ru, kind })); },
    async createPerson(p, actor) {
      if ([...people.values()].some((x) => x.email === p.email)) throw Object.assign(new Error("duplicate"), { code: "23505" });
      const id = randomUUID(); people.set(id, { ...p, id, created_by: actor, created_at: now() }); auditLog.push({ actor, action: "person.create" }); return id;
    },
    async listGrants() { return [...grants.values()].filter((g) => !g.revoked_at); },
    async createGrant(g, actor) {
      if ([...grants.values()].some((x) => !x.revoked_at && x.guardian_id === g.guardian_id && x.child_id === g.child_id)) throw Object.assign(new Error("duplicate"), { code: "23505" });
      const id = randomUUID(); grants.set(id, { ...g, id, granted_by: actor, granted_at: now(), revoked_at: null }); return id;
    },
    async revokeGrant(id) { const g = grants.get(id); if (!g || g.revoked_at) return false; g.revoked_at = now(); return true; },
    async listNotes(personId, kinds) { return [...notes.values()].filter((n) => n.person_id === personId && kinds.includes(n.kind)); },
    async createNote(row, actor) { notes.set(row.id, { ...row, created_by: actor, created_at: now(), updated_at: now() }); },
    async logAccess(entry) { if (this.failLog) throw new Error("log unavailable"); log.push({ id: log.length + 1, at: now(), ...entry }); },
    async accessLog() { return [...log].reverse(); },
    _raw: { notes, log },
  };
}
