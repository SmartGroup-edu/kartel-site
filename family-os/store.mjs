// Family OS storage: Postgres in production, an in-memory twin for tests. Both expose the same
// methods; authorisation lives in server.mjs/policy.mjs, not here.
import { randomUUID } from "node:crypto";

/** The timestamp column each state sets (a same-state update, like «Продолжаю», stamps nothing). */
const STAMP = { approved: "approved_at", accepted: "accepted_at", in_progress: "started_at", done: "done_at", reviewed: "reviewed_at", declined: "declined_at", declined_by_adult: "declined_at" };

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
    // ---- Stage 2a: documents
    async setBirthDate(id, date, actor) {
      const r = await q("UPDATE person SET birth_date = $2 WHERE id = $1", [id, date]);
      if (r.rowCount) await audit(actor, "person.birth_date", `person:${id}`);
      return r.rowCount === 1;
    },
    // QA-156 M2: the owner's one-time «взрослый, 18+» for a person without a birth date (true sets, false clears).
    async setAdultConfirmed(id, on, actor) {
      const r = await q("UPDATE person SET adult_confirmed_at = CASE WHEN $2 THEN coalesce(adult_confirmed_at, now()) END WHERE id = $1", [id, on]);
      if (r.rowCount) await audit(actor, on ? "person.adult_confirm" : "person.adult_unconfirm", `person:${id}`);
      return r.rowCount === 1;
    },
    async createDocument(d, actor) {
      await q(`INSERT INTO document (id, person_id, archive, type, country, issue_date, expiry_date, number_hint, wrapped_key, fields_ct, number_ct, pcode_ct, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [d.id, d.person_id, d.archive, d.type, d.country, d.issue_date, d.expiry_date, d.number_hint, d.wrapped_key, d.fields_ct, d.number_ct, d.pcode_ct, actor]);
      await audit(actor, "document.create", `document:${d.id}`);
    },
    async getDocument(id) { return (await q("SELECT * FROM document WHERE id = $1", [id])).rows[0] ?? null; },
    async listDocuments(personId) { return (await q("SELECT * FROM document WHERE person_id = $1 AND NOT archive ORDER BY type, created_at", [personId])).rows; },
    async listArchiveDocuments() { return (await q("SELECT * FROM document WHERE archive ORDER BY created_at")).rows; },
    async listExpiring(personIds, until) {
      if (!personIds.length) return [];
      return (await q("SELECT id, person_id, type, country, expiry_date FROM document WHERE person_id = ANY($1::uuid[]) AND NOT archive AND expiry_date IS NOT NULL AND expiry_date <= $2 ORDER BY expiry_date", [personIds, until])).rows;
    },
    async createFile(f, actor) {
      await q("INSERT INTO document_file (id, document_id, name_ct, mime, size, wrapped_key, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [f.id, f.document_id, f.name_ct, f.mime, f.size, f.wrapped_key, actor]);
      await audit(actor, "file.upload", `file:${f.id}`);
    },
    async listFiles(documentId) { return (await q("SELECT * FROM document_file WHERE document_id = $1 ORDER BY created_at", [documentId])).rows; },
    async getFile(id) { return (await q("SELECT * FROM document_file WHERE id = $1", [id])).rows[0] ?? null; },
    async retypeDocument(id, type, actor) {
      const r = await q("UPDATE document SET type = $2 WHERE id = $1", [id, type]);
      if (r.rowCount) await audit(actor, "document.retype", `document:${id}`);
      return r.rowCount === 1;
    },
    // ---- Stage 2: people/grants admin, routines
    async updatePerson(id, patch, actor) {
      const r = await q("UPDATE person SET name_en = COALESCE($2, name_en), name_ru = COALESCE($3, name_ru), kind = COALESCE($4, kind) WHERE id = $1", [id, patch.name_en ?? null, patch.name_ru ?? null, patch.kind ?? null]);
      if (r.rowCount) await audit(actor, "person.update", `person:${id}`);
      return r.rowCount === 1;
    },
    async setGrantScopes(id, scopes, actor) {
      const r = await q("UPDATE guardian_grant SET scopes = $2 WHERE id = $1 AND revoked_at IS NULL", [id, scopes]);
      if (r.rowCount) await audit(actor, "grant.scopes", `grant:${id}`);
      return r.rowCount === 1;
    },
    async listRoutines(personId) {
      return (await q(`SELECT id, person_id, kind, title, rrule, to_char(dtstart, 'YYYY-MM-DD') AS dtstart, at_time, anchor_text, anchor_routine_id, created_at FROM routine
                       WHERE person_id = $1 AND archived_at IS NULL ORDER BY at_time NULLS LAST, created_at`, [personId])).rows;
    },
    async getRoutine(id) {
      return (await q("SELECT id, person_id, kind, title, rrule, to_char(dtstart, 'YYYY-MM-DD') AS dtstart, at_time, archived_at FROM routine WHERE id = $1", [id])).rows[0] ?? null;
    },
    async createRoutine(r, actor) {
      await q("INSERT INTO routine (id, person_id, kind, title, rrule, dtstart, at_time, anchor_text, anchor_routine_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [r.id, r.person_id, r.kind, r.title, r.rrule, r.dtstart, r.at_time, r.anchor_text ?? null, r.anchor_routine_id ?? null, actor]);
      await audit(actor, "routine.create", `routine:${r.id}`);
    },
    async updateRoutine(id, patch, actor) {
      const r = await q(`UPDATE routine SET title = COALESCE($2, title), rrule = COALESCE($3, rrule), at_time = CASE WHEN $4::boolean THEN $5 ELSE at_time END,
                         archived_at = CASE WHEN $6::boolean THEN now() ELSE archived_at END WHERE id = $1 AND archived_at IS NULL`,
        [id, patch.title ?? null, patch.rrule ?? null, "at_time" in patch, patch.at_time ?? null, Boolean(patch.archived)]);
      if (r.rowCount) await audit(actor, patch.archived ? "routine.archive" : "routine.update", `routine:${id}`);
      return r.rowCount === 1;
    },
    /** Latest state per (routine, day) since `from`: [{ routine_id, on_date, done }] */
    async listChecks(routineIds, from) {
      if (!routineIds.length) return [];
      return (await q(`SELECT DISTINCT ON (routine_id, on_date) routine_id, to_char(on_date, 'YYYY-MM-DD') AS on_date, done FROM routine_check
                       WHERE routine_id = ANY($1::uuid[]) AND on_date >= $2 ORDER BY routine_id, on_date, id DESC`, [routineIds, from])).rows;
    },
    async addCheck(routineId, date, done, actor) {
      await q("INSERT INTO routine_check (routine_id, on_date, done, by_actor) VALUES ($1, $2, $3, $4)", [routineId, date, done, actor]);
    },
    // ---- Stage 3a: events, rules, prefs, pauses, rotations
    async emit(type, actor, subject = null, ref = null) {
      await q("INSERT INTO event (type, actor, subject_person_id, ref) VALUES ($1, $2, $3, $4)", [type, actor, subject, ref]);
    },
    async listRules() { return (await q("SELECT id, enabled, dry_run, updated_at FROM rule ORDER BY id")).rows; },
    async setRule(id, patch, actor) {
      const r = await q("UPDATE rule SET enabled = COALESCE($2, enabled), dry_run = COALESCE($3, dry_run), updated_by = $4, updated_at = now() WHERE id = $1", [id, patch.enabled ?? null, patch.dry_run ?? null, actor]);
      if (r.rowCount) await audit(actor, "rule.update", `rule:${id}`);
      return r.rowCount === 1;
    },
    async ruleRunCounts(sinceDate) {
      return (await q("SELECT rule_id, outcome, count(*)::int AS n FROM rule_run WHERE family_date >= $1 GROUP BY rule_id, outcome ORDER BY 1, 2", [sinceDate])).rows;
    },
    async getPrefs(personId) {
      return (await q("SELECT email_on, digest_time, evening_on, evening_time, lang, count_mode FROM notification_pref WHERE person_id = $1", [personId])).rows[0] ?? null;
    },
    async setPrefs(personId, p, actor) {
      await q(`INSERT INTO notification_pref (person_id, email_on, digest_time, evening_on, evening_time, lang, count_mode, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($8, 'week'), $7, now())
               ON CONFLICT (person_id) DO UPDATE SET email_on = $2, digest_time = $3, evening_on = $4, evening_time = $5, lang = $6, count_mode = COALESCE($8, notification_pref.count_mode), updated_by = $7, updated_at = now()`,
        [personId, p.email_on, p.digest_time, p.evening_on, p.evening_time, p.lang, actor, p.count_mode ?? null]);
    },
    async listPauses(personId) {
      return (await q("SELECT id, person_id, to_char(from_date, 'YYYY-MM-DD') AS from_date, to_char(to_date, 'YYYY-MM-DD') AS to_date, cancelled_at FROM pause WHERE person_id = $1 AND cancelled_at IS NULL ORDER BY from_date", [personId])).rows;
    },
    async getPause(id) { return (await q("SELECT id, person_id, cancelled_at FROM pause WHERE id = $1", [id])).rows[0] ?? null; },
    async createPause(p, actor) {
      await q("INSERT INTO pause (id, person_id, from_date, to_date, created_by) VALUES ($1, $2, $3, $4, $5)", [p.id, p.person_id, p.from_date, p.to_date, actor]);
    },
    async cancelPause(id) { return (await q("UPDATE pause SET cancelled_at = now() WHERE id = $1 AND cancelled_at IS NULL", [id])).rowCount === 1; },
    async listRotations() {
      return (await q("SELECT id, title, rrule, to_char(dtstart, 'YYYY-MM-DD') AS dtstart, at_time, members FROM rotation WHERE archived_at IS NULL ORDER BY created_at")).rows;
    },
    async getRotation(id) {
      return (await q("SELECT id, title, rrule, to_char(dtstart, 'YYYY-MM-DD') AS dtstart, at_time, members, archived_at FROM rotation WHERE id = $1", [id])).rows[0] ?? null;
    },
    async createRotation(r, actor) {
      await q("INSERT INTO rotation (id, title, rrule, dtstart, at_time, members, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)", [r.id, r.title, r.rrule, r.dtstart, r.at_time, r.members, actor]);
      await audit(actor, "rotation.create", `rotation:${r.id}`);
    },
    async archiveRotation(id, actor) {
      const r = await q("UPDATE rotation SET archived_at = now() WHERE id = $1 AND archived_at IS NULL", [id]);
      if (r.rowCount) await audit(actor, "rotation.archive", `rotation:${id}`);
      return r.rowCount === 1;
    },
    async listRotationChecks(ids, from) {
      if (!ids.length) return [];
      return (await q(`SELECT DISTINCT ON (rotation_id, on_date) rotation_id, to_char(on_date, 'YYYY-MM-DD') AS on_date, done FROM rotation_check
                       WHERE rotation_id = ANY($1::uuid[]) AND on_date >= $2 ORDER BY rotation_id, on_date, id DESC`, [ids, from])).rows;
    },
    async addRotationCheck(id, date, personId, done, actor) {
      await q("INSERT INTO rotation_check (rotation_id, on_date, person_id, done, by_actor) VALUES ($1, $2, $3, $4, $5)", [id, date, personId, done, actor]);
    },
    // ---- Stage 3b: council, goals, calendar, ICS
    async allRoutines() { return (await q("SELECT id, person_id, rrule, to_char(dtstart, 'YYYY-MM-DD') AS dtstart FROM routine WHERE archived_at IS NULL")).rows; },
    async allChecks(from) { return (await q("SELECT DISTINCT ON (routine_id, on_date) routine_id, to_char(on_date, 'YYYY-MM-DD') AS on_date, done FROM routine_check WHERE on_date >= $1 ORDER BY routine_id, on_date, id DESC", [from])).rows; },
    async allRotationChecks(from) { return (await q("SELECT DISTINCT ON (rotation_id, on_date) rotation_id, to_char(on_date, 'YYYY-MM-DD') AS on_date, done FROM rotation_check WHERE on_date >= $1 ORDER BY rotation_id, on_date, id DESC", [from])).rows; },
    async allPauses() { return (await q("SELECT person_id, to_char(from_date, 'YYYY-MM-DD') AS from_date, to_char(to_date, 'YYYY-MM-DD') AS to_date, cancelled_at FROM pause WHERE cancelled_at IS NULL")).rows; },
    async getMeeting(date) { return (await q("SELECT id, to_char(on_date, 'YYYY-MM-DD') AS on_date, wrapped_key, notes_ct, held_at FROM council_meeting WHERE on_date = $1", [date])).rows[0] ?? null; },
    async prevMeeting(date) { return (await q("SELECT id, to_char(on_date, 'YYYY-MM-DD') AS on_date FROM council_meeting WHERE on_date < $1 ORDER BY on_date DESC LIMIT 1", [date])).rows[0] ?? null; },
    async saveMeeting(m, actor) {
      await q(`INSERT INTO council_meeting (id, on_date, wrapped_key, notes_ct, held_at, created_by) VALUES ($1, $2, $3, $4, CASE WHEN $5::boolean THEN now() END, $6)
               ON CONFLICT (on_date) DO UPDATE SET notes_ct = $4, held_at = CASE WHEN $5::boolean THEN COALESCE(council_meeting.held_at, now()) ELSE NULL END`,
        [m.id, m.on_date, m.wrapped_key, m.notes_ct, Boolean(m.held), actor]);
      await audit(actor, "council.save", `council:${m.on_date}`);
    },
    async listTasks(meetingId) { return (await q("SELECT id, meeting_id, title, owner_id, to_char(due_date, 'YYYY-MM-DD') AS due_date, done_at FROM council_task WHERE meeting_id = $1 ORDER BY due_date, created_at", [meetingId])).rows; },
    async openTasksOf(ownerId) { return (await q("SELECT id, meeting_id, title, owner_id, to_char(due_date, 'YYYY-MM-DD') AS due_date, done_at FROM council_task WHERE owner_id = $1 AND done_at IS NULL ORDER BY due_date", [ownerId])).rows; },
    async getTask(id) { return (await q("SELECT id, meeting_id, title, owner_id, to_char(due_date, 'YYYY-MM-DD') AS due_date, done_at FROM council_task WHERE id = $1", [id])).rows[0] ?? null; },
    async createTask(t, actor) {
      await q("INSERT INTO council_task (id, meeting_id, title, owner_id, due_date, created_by) VALUES ($1, $2, $3, $4, $5, $6)", [t.id, t.meeting_id, t.title, t.owner_id, t.due_date, actor]);
      await audit(actor, "council.task", `task:${t.id}`);
    },
    async setTaskDone(id, done, actor) { return (await q("UPDATE council_task SET done_at = CASE WHEN $2::boolean THEN now() END, done_by = CASE WHEN $2::boolean THEN $3 END WHERE id = $1", [id, done, actor])).rowCount === 1; },
    async listGoals(personId) { return (await q("SELECT id, person_id, sphere, visibility, wrapped_key, title_ct, woop_ct, status, created_at FROM goal WHERE person_id = $1 AND status <> 'archived' ORDER BY status, created_at", [personId])).rows; },
    async getGoal(id) { return (await q("SELECT id, person_id, sphere, visibility, wrapped_key, title_ct, woop_ct, status FROM goal WHERE id = $1", [id])).rows[0] ?? null; },
    async createGoal(g, actor) {
      await q("INSERT INTO goal (id, person_id, sphere, visibility, wrapped_key, title_ct, woop_ct, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [g.id, g.person_id, g.sphere, g.visibility, g.wrapped_key, g.title_ct, g.woop_ct ?? null, actor]);
    },
    async updateGoal(id, patch) {
      // woop_ct: undefined = unchanged, null = cleared
      return (await q("UPDATE goal SET status = COALESCE($2, status), visibility = COALESCE($3, visibility), woop_ct = CASE WHEN $4::boolean THEN $5 ELSE woop_ct END, updated_at = now() WHERE id = $1",
        [id, patch.status ?? null, patch.visibility ?? null, patch.woop_ct !== undefined, patch.woop_ct ?? null])).rowCount === 1;
    },
    // ---- Stage 3d: Кодекс, принцип недели, признание
    async kodeksVersions() { return (await q("SELECT version, body, status, to_char(approved_on, 'YYYY-MM-DD') AS approved_on, created_by, created_at FROM kodeks_version ORDER BY version DESC")).rows; },
    async addKodeksVersion(v, actor) {
      await q("INSERT INTO kodeks_version (version, body, status, approved_on, created_by) VALUES ($1, $2, $3, $4, $5)", [v.version, JSON.stringify(v.body), v.status, v.approved_on, actor]);
      await audit(actor, "kodeks.version", `kodeks:${v.version}`);
    },
    async principlePick(week) { return (await q("SELECT idx FROM principle_week WHERE week_start = $1", [week])).rows[0]?.idx ?? null; },
    async setPrinciplePick(week, idx, actor) {
      await q("INSERT INTO principle_week (week_start, idx, set_by) VALUES ($1, $2, $3) ON CONFLICT (week_start) DO UPDATE SET idx = $2, set_by = $3, set_at = now()", [week, idx, actor]);
      await audit(actor, "principle.pick", `week:${week}`);
    },
    async recognitionsBetween(from, to) {
      return (await q("SELECT id, from_id, to_id, idx, wrapped_key, text_ct, to_char(on_date, 'YYYY-MM-DD') AS on_date, created_at FROM recognition WHERE on_date BETWEEN $1 AND $2 ORDER BY created_at", [from, to])).rows;
    },
    async recognitionsSentOn(fromId, date) { return (await q("SELECT count(*)::int AS n FROM recognition WHERE from_id = $1 AND on_date = $2", [fromId, date])).rows[0].n; },
    async addRecognition(r, actor) {
      await q("INSERT INTO recognition (id, from_id, to_id, idx, wrapped_key, text_ct, on_date, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [r.id, r.from_id, r.to_id, r.idx, r.wrapped_key, r.text_ct, r.on_date, actor]);
      await audit(actor, "recognition.create", `recognition:${r.id}`);
    },
    // ---- Stage 3d-2 (bus 84/97): «Кто уже с нами»
    async noteSignIn(email, date) {
      await q("INSERT INTO signin_seen (email, first_on, last_on) VALUES ($1, $2, $2) ON CONFLICT (email) DO UPDATE SET last_on = GREATEST(signin_seen.last_on, $2)", [email, date]);
    },
    async signIns() { return (await q("SELECT email, to_char(first_on, 'YYYY-MM-DD') AS first_on, to_char(last_on, 'YYYY-MM-DD') AS last_on FROM signin_seen")).rows; },
    async requestInvite(personId, date, actor) {
      const r = await q("INSERT INTO invite_request (person_id, on_date, requested_by) VALUES ($1, $2, $3) ON CONFLICT (person_id, on_date) DO NOTHING RETURNING id", [personId, date, actor]);
      if (r.rows.length) await audit(actor, "invite.request", `person:${personId}`);
      return r.rows.length > 0;
    },
    async lastInvites() { return (await q("SELECT DISTINCT ON (person_id) person_id, to_char(on_date, 'YYYY-MM-DD') AS on_date, sent_at FROM invite_request ORDER BY person_id, on_date DESC")).rows; },
    async pendingInvites(since) { return (await q("SELECT id, person_id, to_char(on_date, 'YYYY-MM-DD') AS on_date, sent_at FROM invite_request WHERE sent_at IS NULL AND on_date >= $1", [since])).rows; },
    async markInviteSent(id) { await q("UPDATE invite_request SET sent_at = now() WHERE id = $1 AND sent_at IS NULL", [id]); },
    // ---- Go-live R1: session cut-offs ('*' = everyone). The later of the person's and the family-wide one wins.
    async sessionCutoff(email) {
      const r = (await q("SELECT max(cut_at) AS at FROM session_cutoff WHERE email = $1 OR email = '*'", [email])).rows[0];
      return r?.at ? new Date(r.at) : null;
    },
    async endSessions(email, actor) {
      await q("INSERT INTO session_cutoff (email, cut_at, cut_by) VALUES ($1, now(), $2) ON CONFLICT (email) DO UPDATE SET cut_at = now(), cut_by = $2", [email, actor]);
      await audit(actor, "sessions.end", email === "*" ? "family:*" : `email:${email}`);
    },
    // ---- Stage 3e-2: an adult's own body log (sealed rows; the server decides who may call these)
    async bodyOn(personId) { return Boolean((await q("SELECT body_on FROM body_pref WHERE person_id = $1", [personId])).rows[0]?.body_on); },
    async setBodyOn(personId, on) { await q("INSERT INTO body_pref (person_id, body_on) VALUES ($1, $2) ON CONFLICT (person_id) DO UPDATE SET body_on = $2", [personId, on]); },
    async bodyLog(personId) { return (await q("SELECT id, to_char(on_date, 'YYYY-MM-DD') AS on_date, wrapped_key, value_ct FROM body_log WHERE person_id = $1 ORDER BY on_date", [personId])).rows; },
    async bodyLogId(personId, date) { return (await q("SELECT id FROM body_log WHERE person_id = $1 AND on_date = $2", [personId, date])).rows[0]?.id ?? null; },
    async setBodyLog(r) { await q("INSERT INTO body_log (id, person_id, on_date, wrapped_key, value_ct) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (person_id, on_date) DO UPDATE SET wrapped_key = $4, value_ct = $5", [r.id, r.person_id, r.on_date, r.wrapped_key, r.value_ct]); },
    async deleteBodyLog(personId, date) { await q("DELETE FROM body_log WHERE person_id = $1 AND on_date = $2", [personId, date]); },
    async bodyGoal(personId) { return (await q("SELECT wrapped_key, goal_ct FROM body_goal WHERE person_id = $1", [personId])).rows[0] ?? null; },
    async setBodyGoal(personId, wrapped, ct) { await q("INSERT INTO body_goal (person_id, wrapped_key, goal_ct) VALUES ($1, $2, $3) ON CONFLICT (person_id) DO UPDATE SET wrapped_key = $2, goal_ct = $3", [personId, wrapped, ct]); },
    // QA-156 M3: the person's /body key (wrapped by the master key). Created once; ON CONFLICT keeps the first.
    async bodyKey(personId) { return (await q("SELECT wrapped_key FROM body_key WHERE person_id = $1", [personId])).rows[0]?.wrapped_key ?? null; },
    async createBodyKey(personId, wrapped) {
      await q("INSERT INTO body_key (person_id, wrapped_key) VALUES ($1, $2) ON CONFLICT (person_id) DO NOTHING", [personId, wrapped]);
      return this.bodyKey(personId);
    },
    // «Удалить все записи»: the key goes with the rows, in one transaction (crypto-shredding, QA-156 M3).
    async deleteBody(personId) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        for (const t of ["body_key", "body_log", "body_goal", "body_pref"]) await c.query(`DELETE FROM ${t} WHERE person_id = $1`, [personId]);
        await c.query("COMMIT");
      } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
    },
    // ---- Stage 3e-1 «Здоровье-лайт»
    async healthPrefs() { return (await q("SELECT person_id, ticks_on, evening_q_on FROM health_pref")).rows; },
    async setHealthPref(personId, p) {
      await q("INSERT INTO health_pref (person_id, ticks_on, evening_q_on) VALUES ($1, $2, $3) ON CONFLICT (person_id) DO UPDATE SET ticks_on = $2, evening_q_on = $3, updated_at = now()", [personId, p.ticks_on, p.evening_q_on]);
    },
    async healthTicks(from, to) { return (await q("SELECT person_id, to_char(on_date, 'YYYY-MM-DD') AS on_date, kind, done FROM health_tick WHERE on_date BETWEEN $1 AND $2", [from, to])).rows; },
    async setHealthTick(personId, date, kind, done) {
      await q("INSERT INTO health_tick (person_id, on_date, kind, done) VALUES ($1, $2, $3, $4) ON CONFLICT (person_id, on_date, kind) DO UPDATE SET done = $4", [personId, date, kind, done]);
    },
    async eveningFor(personId, from, to) { return (await q("SELECT id, to_char(on_date, 'YYYY-MM-DD') AS on_date, wrapped_key, text_ct FROM evening_answer WHERE person_id = $1 AND on_date BETWEEN $2 AND $3 ORDER BY on_date DESC", [personId, from, to])).rows; },
    async eveningId(personId, date) { return (await q("SELECT id FROM evening_answer WHERE person_id = $1 AND on_date = $2", [personId, date])).rows[0]?.id ?? null; },
    async setEvening(r) {
      await q("INSERT INTO evening_answer (id, person_id, on_date, wrapped_key, text_ct) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (person_id, on_date) DO UPDATE SET wrapped_key = $4, text_ct = $5", [r.id, r.person_id, r.on_date, r.wrapped_key, r.text_ct]);
    },
    async deleteEvening(personId, date) { await q("DELETE FROM evening_answer WHERE person_id = $1 AND on_date = $2", [personId, date]); },
    // ---- Passkeys (bus 98/100)
    async pkUser(email) { return (await q("SELECT email, user_handle FROM passkey_user WHERE email = $1", [email])).rows[0] ?? null; },
    async pkAddUser(email, handle) { await q("INSERT INTO passkey_user (email, user_handle) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING", [email, handle]); return this.pkUser(email); },
    async pkList(email) { return (await q("SELECT * FROM passkey WHERE email = $1 AND revoked_at IS NULL ORDER BY created_at", [email])).rows; },
    async pkActiveEmails() { return (await q("SELECT DISTINCT email FROM passkey WHERE revoked_at IS NULL")).rows.map((r) => r.email); },
    async pkGet(id) { return (await q("SELECT * FROM passkey WHERE id = $1", [id])).rows[0] ?? null; },
    async pkByCredential(credId) { return (await q("SELECT * FROM passkey WHERE credential_id = $1", [credId])).rows[0] ?? null; },
    async pkAdd(r, actor) {
      await q(`INSERT INTO passkey (id, email, credential_id, public_key, counter, transports, aaguid, device_kind, device_type, backed_up, label)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [r.id, r.email, r.credential_id, r.public_key, r.counter, r.transports, r.aaguid, r.device_kind, r.device_type, r.backed_up, r.label]);
      await audit(actor, "passkey.register", `passkey:${r.id}`);
    },
    async pkCreatedSince(email, since) { return (await q("SELECT count(*)::int AS n FROM passkey WHERE email = $1 AND created_at >= $2", [email, since])).rows[0].n; },
    async pkTouch(id, counter, backedUp) { await q("UPDATE passkey SET counter = $2, backed_up = $3, last_used_at = now() WHERE id = $1 AND revoked_at IS NULL", [id, counter, backedUp]); },
    async pkFlag(id) { return (await q("UPDATE passkey SET flagged_at = now() WHERE id = $1 AND flagged_at IS NULL AND revoked_at IS NULL RETURNING id", [id])).rowCount > 0; },
    async pkClearFlag(id, actor) { const n = (await q("UPDATE passkey SET flagged_at = NULL WHERE id = $1 AND flagged_at IS NOT NULL AND revoked_at IS NULL RETURNING id", [id])).rowCount; if (n) await audit(actor, "passkey.unflag", `passkey:${id}`); return n > 0; },
    async pkRevoke(id, actor) { const n = (await q("UPDATE passkey SET revoked_at = now(), revoked_by = $2 WHERE id = $1 AND revoked_at IS NULL RETURNING id", [id, actor])).rowCount; if (n) await audit(actor, "passkey.revoke", `passkey:${id}`); return n > 0; },
    async pkRename(id, label) { return (await q("UPDATE passkey SET label = $2 WHERE id = $1 AND revoked_at IS NULL RETURNING id", [id, label])).rowCount > 0; },
    async pkChallengeAdd(c) { await q("INSERT INTO passkey_challenge (id, purpose, email, challenge, expires_at) VALUES ($1, $2, $3, $4, $5)", [c.id, c.purpose, c.email, c.challenge, c.expires_at]); },
    async pkChallengeTake(id, purpose, email, now) {
      return (await q("DELETE FROM passkey_challenge WHERE id = $1 AND purpose = $2 AND email IS NOT DISTINCT FROM $3 RETURNING challenge, expires_at", [id, purpose, email])).rows.filter((r) => new Date(r.expires_at) > now)[0] ?? null;
    },
    async pkChallengePrune(now, keep) {
      await q("DELETE FROM passkey_challenge WHERE expires_at <= $1", [now]);
      await q("DELETE FROM passkey_challenge WHERE id IN (SELECT id FROM passkey_challenge ORDER BY expires_at DESC OFFSET $1)", [keep]);
    },
    async pkAttempt(key, kind, at = new Date()) { await q("INSERT INTO passkey_attempt (key, kind, at) VALUES ($1, $2, $3)", [key, kind, at]); },
    async pkAttempts(key, kind, since) { return (await q("SELECT count(*)::int AS n FROM passkey_attempt WHERE key = $1 AND kind = $2 AND at >= $3", [key, kind, since])).rows[0].n; },
    async noticeAdd(n) { await q("INSERT INTO security_notice (kind, email, device_kind, on_date) VALUES ($1, $2, $3, $4)", [n.kind, n.email, n.device_kind, n.on_date]); },
    // ---- 3d-2: review photo
    async activeTaskPhoto(taskId) { return (await q("SELECT id, task_id, mime, size, wrapped_key, uploaded_at, delete_after FROM task_photo WHERE task_id = $1 AND deleted_at IS NULL", [taskId])).rows[0] ?? null; },
    async addTaskPhoto(p, actor) {
      await q("INSERT INTO task_photo (id, task_id, mime, size, wrapped_key, uploaded_by, uploaded_at, delete_after) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [p.id, p.task_id, p.mime, p.size, p.wrapped_key, actor, p.uploaded_at, p.delete_after]);
      await audit(actor, "task.photo", `task:${p.task_id}`);
    },
    async duePhotos(now) { return (await q("SELECT id FROM task_photo WHERE deleted_at IS NULL AND delete_after <= $1", [now])).rows; },
    async markPhotoDeleted(id) { await q("UPDATE task_photo SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL", [id]); },
    async listCheckins(goalIds) {
      if (!goalIds.length) return [];
      return (await q("SELECT id, goal_id, to_char(week_start, 'YYYY-MM-DD') AS week_start, mood, note_ct FROM goal_checkin WHERE goal_id = ANY($1::uuid[]) ORDER BY week_start DESC", [goalIds])).rows;
    },
    async saveCheckin(c, actor) {
      return (await q(`INSERT INTO goal_checkin (goal_id, week_start, mood, note_ct, created_by) VALUES ($1, $2, $3, $4, $5)
                       ON CONFLICT (goal_id, week_start) DO UPDATE SET mood = $3, note_ct = $4 RETURNING id`, [c.goal_id, c.week_start, c.mood, c.note_ct, actor])).rows[0].id;
    },
    async listEvents(from, to) { return (await q("SELECT id, title, to_char(on_date, 'YYYY-MM-DD') AS on_date, at_time, created_by FROM family_event WHERE archived_at IS NULL AND on_date BETWEEN $1 AND $2 ORDER BY on_date", [from, to])).rows; },
    async getEvent(id) { return (await q("SELECT id, archived_at FROM family_event WHERE id = $1", [id])).rows[0] ?? null; },
    async createEvent(e, actor) { await q("INSERT INTO family_event (id, title, on_date, at_time, created_by) VALUES ($1, $2, $3, $4, $5)", [e.id, e.title, e.on_date, e.at_time, actor]); },
    async archiveEvent(id) { return (await q("UPDATE family_event SET archived_at = now() WHERE id = $1 AND archived_at IS NULL", [id])).rowCount === 1; },
    async getIcs(personId) { return (await q("SELECT created_at FROM ics_token WHERE person_id = $1 AND revoked_at IS NULL", [personId])).rows[0] ?? null; },
    async setIcs(personId, hash, actor) {
      await q("INSERT INTO ics_token (person_id, token_hash) VALUES ($1, $2) ON CONFLICT (person_id) DO UPDATE SET token_hash = $2, created_at = now(), revoked_at = NULL", [personId, hash]);
      await audit(actor, "ics.issue", `person:${personId}`);
    },
    async revokeIcs(personId, actor) {
      const r = await q("UPDATE ics_token SET revoked_at = now() WHERE person_id = $1 AND revoked_at IS NULL", [personId]);
      if (r.rowCount) await audit(actor, "ics.revoke", `person:${personId}`);
      return r.rowCount === 1;
    },
    async revokeAllIcs(actor) {
      const r = await q("UPDATE ics_token SET revoked_at = now() WHERE revoked_at IS NULL");
      if (r.rowCount) await audit(actor, "ics.revoke", "family:*");
      return r.rowCount;
    },
    async personByIcs(hash) { return (await q("SELECT p.* FROM ics_token t JOIN person p ON p.id = t.person_id WHERE t.token_hash = $1 AND t.revoked_at IS NULL", [hash])).rows[0] ?? null; },
    // ---- Stage 3c: board
    // ---- bus 85: council decisions are tasks; legacy chores/rotations/council_task rows migrate to the task model
    async councilTasks(date) { return (await q(`SELECT *, to_char(plan_date, 'YYYY-MM-DD') AS plan_date, to_char(council_date, 'YYYY-MM-DD') AS council_date FROM task WHERE council_date = $1 ORDER BY created_at`, [date])).rows; },
    async openCouncilTasksOf(pid) { return (await q(`SELECT *, to_char(plan_date, 'YYYY-MM-DD') AS plan_date, to_char(council_date, 'YYYY-MM-DD') AS council_date FROM task WHERE origin = 'council' AND state IN ('approved', 'accepted', 'in_progress') AND (assignee_id = $1 OR $1 = ANY (co_ids)) ORDER BY task.plan_date`, [pid])).rows; },
    async choreRoutines() { return (await q("SELECT id, person_id, kind, title, rrule, to_char(dtstart, 'YYYY-MM-DD') AS dtstart, at_time, created_by FROM routine WHERE archived_at IS NULL AND kind = 'chore'")).rows; },
    async legacyCouncilTasks() { return (await q("SELECT t.id, t.title, t.owner_id, to_char(t.due_date, 'YYYY-MM-DD') AS due_date, t.done_at, t.created_by, to_char(m.on_date, 'YYYY-MM-DD') AS on_date FROM council_task t JOIN council_meeting m ON m.id = t.meeting_id")).rows; },
    async boardTasks(from, to) { return (await q(`SELECT *, to_char(plan_date, 'YYYY-MM-DD') AS plan_date, to_char(council_date, 'YYYY-MM-DD') AS council_date FROM task WHERE plan_date BETWEEN $1 AND $2 ORDER BY due_time NULLS LAST, created_at`, [from, to])).rows; },
    async boardTask(id) { return (await q(`SELECT *, to_char(plan_date, 'YYYY-MM-DD') AS plan_date, to_char(council_date, 'YYYY-MM-DD') AS council_date FROM task WHERE id = $1`, [id])).rows[0] ?? null; },
    async insertTask(t, actor) {
      return (await q(`INSERT INTO task (id, plan_date, kind, origin, template_id, sprint_goal_id, carried_from, assignee_id, wrapped_key, title_ct, due_time, needs_review, state, approved_by, approved_at, created_by,
                         co_ids, accountable_id, when_slot, estimate_min, council_date)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CASE WHEN $14::text IS NULL THEN NULL ELSE now() END, $15, $16, $17, $18, $19, $20) ON CONFLICT DO NOTHING RETURNING id`,
        [t.id, t.plan_date, t.kind, t.origin, t.template_id ?? null, t.sprint_goal_id ?? null, t.carried_from ?? null, t.assignee_id, t.wrapped_key, t.title_ct, t.due_time ?? null, Boolean(t.needs_review), t.state ?? "proposed", t.approved_by ?? null, actor,
         t.co_ids ?? [], t.accountable_id ?? null, t.when_slot ?? null, t.estimate_min ?? null, t.council_date ?? null])).rowCount === 1;
    },
    /** Move only if the task is still in `from` (two taps never double-move); stamps the matching *_at column. */
    async moveTask(id, from, to, patch = {}) {
      const stamp = from === to ? null : STAMP[to];
      const sets = ["state = $3", "updated_at = now()"], args = [id, from, to];
      if (stamp) sets.push(`${stamp} = now()`);
      for (const [k, v] of Object.entries(patch)) { args.push(v); sets.push(`${k} = $${args.length}`); }
      return (await q(`UPDATE task SET ${sets.join(", ")} WHERE id = $1 AND state = $2`, args)).rowCount === 1;
    },
    async inProgressOf(personId) { return (await q(`SELECT id FROM task WHERE state = 'in_progress' AND (assignee_id = $1 OR $1 = ANY (co_ids))`, [personId])).rows[0] ?? null; },
    async taskEvents(id) { return (await q(`SELECT type, actor, at FROM event WHERE ref = $1 AND type LIKE 'task.%' ORDER BY at, id`, [id])).rows; },
    async listTemplates() { return (await q(`SELECT *, to_char(dtstart, 'YYYY-MM-DD') AS dtstart FROM task_template WHERE archived_at IS NULL ORDER BY created_at`)).rows; },
    async getTemplate(id) { return (await q(`SELECT *, to_char(dtstart, 'YYYY-MM-DD') AS dtstart FROM task_template WHERE id = $1`, [id])).rows[0] ?? null; },
    async insertTemplate(t, actor) {
      await q("INSERT INTO task_template (id, wrapped_key, title_ct, mask, dtstart, assignee_id, members, due_time, needs_review, active, created_by, when_slot, estimate_min) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
        [t.id, t.wrapped_key, t.title_ct, t.mask, t.dtstart, t.assignee_id ?? null, t.members ?? null, t.due_time ?? null, Boolean(t.needs_review), Boolean(t.active), actor, t.when_slot ?? null, t.estimate_min ?? null]);
      await audit(actor, "template.create", `template:${t.id}`);
    },
    async updateTemplate(id, p, actor) {
      const r = await q(`UPDATE task_template SET mask = COALESCE($2, mask), due_time = CASE WHEN $3::boolean THEN $4 ELSE due_time END, needs_review = COALESCE($5, needs_review),
                         archived_at = CASE WHEN $6::boolean THEN now() ELSE archived_at END WHERE id = $1 AND archived_at IS NULL`,
        [id, p.mask ?? null, "due_time" in p, p.due_time ?? null, p.needs_review ?? null, Boolean(p.archived)]);
      if (r.rowCount) await audit(actor, p.archived ? "template.archive" : "template.update", `template:${id}`);
      return r.rowCount === 1;
    },
    async activateTemplates(ids, actor) {
      const r = await q("UPDATE task_template SET active = true WHERE archived_at IS NULL AND NOT active AND ($1::uuid[] IS NULL OR id = ANY($1::uuid[]))", [ids]);
      if (r.rowCount) await audit(actor, "template.activate", `templates:${r.rowCount}`);
      return r.rowCount;
    },
    async sprintGoals(week) { return (await q(`SELECT id, to_char(week_start, 'YYYY-MM-DD') AS week_start, title, source_task_id FROM sprint_goal WHERE week_start = $1 AND archived_at IS NULL ORDER BY created_at`, [week])).rows; },
    async getSprintGoal(id) { return (await q(`SELECT id, to_char(week_start, 'YYYY-MM-DD') AS week_start, title, archived_at FROM sprint_goal WHERE id = $1`, [id])).rows[0] ?? null; },
    async insertSprintGoal(g, actor) {
      await q("INSERT INTO sprint_goal (id, week_start, title, source_task_id, created_by) VALUES ($1, $2, $3, $4, $5)", [g.id, g.week_start, g.title, g.source_task_id ?? null, actor]);
      await audit(actor, "sprint.goal", `sprint_goal:${g.id}`);
    },
    async updateSprintGoal(id, p) { return (await q("UPDATE sprint_goal SET title = COALESCE($2, title), archived_at = CASE WHEN $3::boolean THEN now() ELSE archived_at END WHERE id = $1 AND archived_at IS NULL", [id, p.title ?? null, Boolean(p.archived)])).rowCount === 1; },
    async planApproval(date) { return (await q("SELECT approved_by, auto, at FROM plan_approval WHERE plan_date = $1", [date])).rows[0] ?? null; },
    async approvePlan(date, by, auto) { return (await q("INSERT INTO plan_approval (plan_date, approved_by, auto) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [date, by, auto])).rowCount === 1; },
  };
}

export const LOG_ACTIONS = ["read", "write", "reveal", "copy", "export", "delete"];

export function memoryStore() {
  const people = new Map(), grants = new Map(), notes = new Map(), docs = new Map(), files = new Map(), routines = new Map(), checks = [], log = [], auditLog = [], events = [], prefs = new Map(), pauses = new Map(), rotations = new Map(), rchecks = [], meetings = new Map(), tasks = new Map(), goals = new Map(), checkins = new Map(), events3 = new Map(), ics = new Map(), btasks = new Map(), templates = new Map(), sgoals = new Map(), approvals = new Map();
  const kodeks = [], picks = new Map(), recs = [];
  const seen = new Map(), invites = [], photos = [], cutoffs = new Map(), hprefs = new Map(), hticks = new Map(), evenings = new Map(), bprefs = new Map(), blogs = new Map(), bgoals = new Map(), bkeys = new Map();
  const pk = { users: new Map(), keys: [], challenges: new Map(), attempts: [], notices: [] };
  const rules = new Map(["digest", "evening_checkin", "documents_in_digest", "missed_routine_parent_note", "council_reminder", "board_new_tasks", "plan_ready", "needs_decision"].map((id) => [id, { id, enabled: ["digest", "evening_checkin"].includes(id), dry_run: true }]));
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
    // Same action enum as the access_log CHECK in schema.sql — so a new action fails here, not first in Postgres.
    async logAccess(entry) { if (this.failLog) throw new Error("log unavailable"); if (!LOG_ACTIONS.includes(entry.action)) throw new Error(`access_log action ${entry.action} not allowed`); log.push({ id: log.length + 1, at: now(), ...entry }); },
    async accessLog() { return [...log].reverse(); },
    // ---- Stage 2a
    async setBirthDate(id, date) { const p = people.get(id); if (!p) return false; p.birth_date = date; return true; },
    async setAdultConfirmed(id, on) { const p = people.get(id); if (!p) return false; p.adult_confirmed_at = on ? (p.adult_confirmed_at ?? now()) : null; return true; },
    async createDocument(d, actor) { docs.set(d.id, { ...d, created_by: actor, created_at: now() }); },
    async getDocument(id) { return docs.get(id) ?? null; },
    async listDocuments(personId) { return [...docs.values()].filter((d) => d.person_id === personId && !d.archive); },
    async listArchiveDocuments() { return [...docs.values()].filter((d) => d.archive); },
    async listExpiring(personIds, until) { return [...docs.values()].filter((d) => !d.archive && personIds.includes(d.person_id) && d.expiry_date && d.expiry_date <= until).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)); },
    async createFile(f, actor) { files.set(f.id, { ...f, created_by: actor, created_at: now() }); },
    async listFiles(documentId) { return [...files.values()].filter((f) => f.document_id === documentId); },
    async getFile(id) { return files.get(id) ?? null; },
    async retypeDocument(id, type) { const d = docs.get(id); if (!d) return false; d.type = type; return true; },
    // ---- Stage 2
    async updatePerson(id, patch) { const p = people.get(id); if (!p) return false; for (const k of ["name_en", "name_ru", "kind"]) if (patch[k]) p[k] = patch[k]; return true; },
    async setGrantScopes(id, scopes) { const g = grants.get(id); if (!g || g.revoked_at) return false; g.scopes = scopes; return true; },
    async listRoutines(personId) { return [...routines.values()].filter((r) => r.person_id === personId && !r.archived_at); },
    async getRoutine(id) { return routines.get(id) ?? null; },
    async createRoutine(r, actor) { routines.set(r.id, { ...r, created_by: actor, created_at: now(), archived_at: null }); },
    async updateRoutine(id, patch) {
      const r = routines.get(id); if (!r || r.archived_at) return false;
      if (patch.title) r.title = patch.title; if (patch.rrule) r.rrule = patch.rrule; if ("at_time" in patch) r.at_time = patch.at_time ?? null;
      if (patch.archived) r.archived_at = now(); return true;
    },
    async listChecks(routineIds, from) {
      const latest = new Map();
      for (const c of checks) if (routineIds.includes(c.routine_id) && c.on_date >= from) latest.set(`${c.routine_id}|${c.on_date}`, c);
      return [...latest.values()].map(({ routine_id, on_date, done }) => ({ routine_id, on_date, done }));
    },
    async addCheck(routineId, date, done, actor) { checks.push({ routine_id: routineId, on_date: date, done, by_actor: actor }); },
    // ---- Stage 3a
    failEvents: false,
    async emit(type, actor, subject = null, ref = null) { if (this.failEvents) throw new Error("event bus down"); events.push({ type, actor, subject_person_id: subject, ref, at: now() }); },
    async listRules() { return [...rules.values()]; },
    async setRule(id, patch) { const r = rules.get(id); if (!r) return false; if (patch.enabled !== undefined) r.enabled = patch.enabled; if (patch.dry_run !== undefined) r.dry_run = patch.dry_run; return true; },
    async ruleRunCounts() { return []; },
    async getPrefs(id) { return prefs.get(id) ?? null; },
    async setPrefs(id, p) { prefs.set(id, { ...p, count_mode: p.count_mode ?? prefs.get(id)?.count_mode ?? "week" }); },
    async listPauses(id) { return [...pauses.values()].filter((p) => p.person_id === id && !p.cancelled_at); },
    async getPause(id) { return pauses.get(id) ?? null; },
    async createPause(p) { pauses.set(p.id, { ...p, cancelled_at: null }); },
    async cancelPause(id) { const p = pauses.get(id); if (!p || p.cancelled_at) return false; p.cancelled_at = now(); return true; },
    async listRotations() { return [...rotations.values()].filter((r) => !r.archived_at); },
    async getRotation(id) { return rotations.get(id) ?? null; },
    async createRotation(r) { rotations.set(r.id, { ...r, archived_at: null }); },
    async archiveRotation(id) { const r = rotations.get(id); if (!r || r.archived_at) return false; r.archived_at = now(); return true; },
    async listRotationChecks(ids, from) {
      const latest = new Map();
      for (const c of rchecks) if (ids.includes(c.rotation_id) && c.on_date >= from) latest.set(`${c.rotation_id}|${c.on_date}`, c);
      return [...latest.values()].map(({ rotation_id, on_date, done }) => ({ rotation_id, on_date, done }));
    },
    async addRotationCheck(id, date, personId, done, actor) { rchecks.push({ rotation_id: id, on_date: date, person_id: personId, done, by_actor: actor }); },
    // ---- Stage 3b
    async allRoutines() { return [...routines.values()].filter((r) => !r.archived_at); },
    async allChecks(from) { return this.listChecks([...routines.keys()], from); },
    async allRotationChecks(from) { return this.listRotationChecks([...rotations.keys()], from); },
    async allPauses() { return [...pauses.values()].filter((p) => !p.cancelled_at); },
    async getMeeting(date) { return [...meetings.values()].find((m) => m.on_date === date) ?? null; },
    async prevMeeting(date) { return [...meetings.values()].filter((m) => m.on_date < date).sort((a, b) => b.on_date.localeCompare(a.on_date))[0] ?? null; },
    async saveMeeting(m) { const cur = [...meetings.values()].find((x) => x.on_date === m.on_date); if (cur) { cur.notes_ct = m.notes_ct; cur.held_at = m.held ? cur.held_at ?? now() : null; } else meetings.set(m.id, { ...m, held_at: m.held ? now() : null }); },
    async listTasks(meetingId) { return [...tasks.values()].filter((t) => t.meeting_id === meetingId); },
    async openTasksOf(ownerId) { return [...tasks.values()].filter((t) => t.owner_id === ownerId && !t.done_at); },
    async getTask(id) { return tasks.get(id) ?? null; },
    async createTask(t) { tasks.set(t.id, { ...t, done_at: null }); },
    async setTaskDone(id, done) { const t = tasks.get(id); if (!t) return false; t.done_at = done ? now() : null; return true; },
    async listGoals(pid) { return [...goals.values()].filter((g) => g.person_id === pid && g.status !== "archived"); },
    async getGoal(id) { return goals.get(id) ?? null; },
    async createGoal(g) { goals.set(g.id, { ...g, status: "active" }); },
    async updateGoal(id, patch) { const g = goals.get(id); if (!g) return false; if (patch.status) g.status = patch.status; if (patch.visibility) g.visibility = patch.visibility; if (patch.woop_ct !== undefined) g.woop_ct = patch.woop_ct; return true; },
    // ---- Stage 3d
    async kodeksVersions() { return [...kodeks].sort((a, b) => b.version - a.version).map((v) => ({ ...v, body: structuredClone(v.body) })); },
    async addKodeksVersion(v, actor) {
      if (kodeks.some((x) => x.version === v.version)) throw Object.assign(new Error("duplicate"), { code: "23505" });
      kodeks.push({ ...v, body: structuredClone(v.body), created_by: actor, created_at: now() });
    },
    async principlePick(week) { return picks.get(week) ?? null; },
    async setPrinciplePick(week, idx) { picks.set(week, idx); },
    async recognitionsBetween(from, to) { return recs.filter((r) => r.on_date >= from && r.on_date <= to); },
    async recognitionsSentOn(fromId, date) { return recs.filter((r) => r.from_id === fromId && r.on_date === date).length; },
    async addRecognition(r, actor) { recs.push({ ...r, created_by: actor, created_at: now() }); },
    // ---- Go-live R1
    async sessionCutoff(email) { const xs = [cutoffs.get(email), cutoffs.get("*")].filter(Boolean); return xs.length ? new Date(Math.max(...xs.map((d) => d.getTime()))) : null; },
    async endSessions(email, actor) { cutoffs.set(email, new Date(now())); auditLog.push({ actor, action: "sessions.end", entity: email === "*" ? "family:*" : `email:${email}` }); },
    // ---- Stage 3e-2
    async bodyOn(personId) { return Boolean(bprefs.get(personId)); },
    async setBodyOn(personId, on) { bprefs.set(personId, on); },
    async bodyLog(personId) { return [...blogs.values()].filter((r) => r.person_id === personId).sort((a, b) => (a.on_date < b.on_date ? -1 : 1)); },
    async bodyLogId(personId, date) { return blogs.get(`${personId}|${date}`)?.id ?? null; },
    async setBodyLog(r) { blogs.set(`${r.person_id}|${r.on_date}`, { ...r }); },
    async deleteBodyLog(personId, date) { blogs.delete(`${personId}|${date}`); },
    async bodyGoal(personId) { return bgoals.get(personId) ?? null; },
    async setBodyGoal(personId, wrapped, ct) { bgoals.set(personId, { wrapped_key: wrapped, goal_ct: ct }); },
    async bodyKey(personId) { return bkeys.get(personId) ?? null; },
    async createBodyKey(personId, wrapped) { if (!bkeys.has(personId)) bkeys.set(personId, wrapped); return bkeys.get(personId); },
    async deleteBody(personId) { for (const k of [...blogs.keys()]) if (k.startsWith(`${personId}|`)) blogs.delete(k); bgoals.delete(personId); bprefs.delete(personId); bkeys.delete(personId); },
    // ---- Stage 3e-1
    async healthPrefs() { return [...hprefs.entries()].map(([person_id, p]) => ({ person_id, ...p })); },
    async setHealthPref(personId, p) { hprefs.set(personId, { ticks_on: p.ticks_on, evening_q_on: p.evening_q_on }); },
    async healthTicks(from, to) { return [...hticks.values()].filter((t) => t.on_date >= from && t.on_date <= to); },
    async setHealthTick(personId, date, kind, done) { hticks.set(`${personId}|${date}|${kind}`, { person_id: personId, on_date: date, kind, done }); },
    async eveningFor(personId, from, to) { return [...evenings.values()].filter((e) => e.person_id === personId && e.on_date >= from && e.on_date <= to).sort((a, b) => (a.on_date < b.on_date ? 1 : -1)); },
    async eveningId(personId, date) { return evenings.get(`${personId}|${date}`)?.id ?? null; },
    async setEvening(r) { evenings.set(`${r.person_id}|${r.on_date}`, { ...r }); },
    async deleteEvening(personId, date) { evenings.delete(`${personId}|${date}`); },
    // ---- Stage 3d-2
    async noteSignIn(email, date) { const x = seen.get(email); seen.set(email, x ? { ...x, last_on: date > x.last_on ? date : x.last_on } : { email, first_on: date, last_on: date }); },
    async signIns() { return [...seen.values()]; },
    async requestInvite(personId, date, actor) {
      if (invites.some((i) => i.person_id === personId && i.on_date === date)) return false;
      invites.push({ id: invites.length + 1, person_id: personId, on_date: date, requested_by: actor, sent_at: null }); return true;
    },
    async lastInvites() { const m = new Map(); for (const i of invites) if (!m.has(i.person_id) || m.get(i.person_id).on_date < i.on_date) m.set(i.person_id, i); return [...m.values()]; },
    async pendingInvites(since) { return invites.filter((i) => !i.sent_at && i.on_date >= since); },
    async markInviteSent(id) { const i = invites.find((x) => x.id === id); if (i && !i.sent_at) i.sent_at = now(); },
    // ---- Passkeys
    async pkUser(email) { return pk.users.get(email) ?? null; },
    async pkAddUser(email, handle) { if (!pk.users.has(email)) pk.users.set(email, { email, user_handle: handle }); return pk.users.get(email); },
    async pkList(email) { return pk.keys.filter((k) => k.email === email && !k.revoked_at); },
    async pkActiveEmails() { return [...new Set(pk.keys.filter((k) => !k.revoked_at).map((k) => k.email))]; },
    async pkGet(id) { return pk.keys.find((k) => k.id === id) ?? null; },
    async pkByCredential(credId) { return pk.keys.find((k) => Buffer.compare(k.credential_id, credId) === 0) ?? null; },
    async pkAdd(r) { if (pk.keys.some((k) => Buffer.compare(k.credential_id, r.credential_id) === 0)) throw Object.assign(new Error("duplicate"), { code: "23505" }); pk.keys.push({ ...r, created_at: new Date(), last_used_at: null, revoked_at: null, revoked_by: null, flagged_at: null }); },
    async pkCreatedSince(email, since) { return pk.keys.filter((k) => k.email === email && k.created_at >= since).length; },
    async pkTouch(id, counter, backedUp) { const k = pk.keys.find((x) => x.id === id && !x.revoked_at); if (k) Object.assign(k, { counter, backed_up: backedUp, last_used_at: new Date() }); },
    async pkFlag(id) { const k = pk.keys.find((x) => x.id === id && !x.revoked_at && !x.flagged_at); if (!k) return false; k.flagged_at = new Date(); return true; },
    async pkClearFlag(id) { const k = pk.keys.find((x) => x.id === id && !x.revoked_at && x.flagged_at); if (!k) return false; k.flagged_at = null; return true; },
    async pkRevoke(id, actor) { const k = pk.keys.find((x) => x.id === id && !x.revoked_at); if (!k) return false; k.revoked_at = new Date(); k.revoked_by = actor; return true; },
    async pkRename(id, label) { const k = pk.keys.find((x) => x.id === id && !x.revoked_at); if (!k) return false; k.label = label; return true; },
    async pkChallengeAdd(c) { pk.challenges.set(c.id, { ...c }); },
    async pkChallengeTake(id, purpose, email, now) { const c = pk.challenges.get(id); if (!c || c.purpose !== purpose || (c.email ?? null) !== (email ?? null)) return null; pk.challenges.delete(id); return c.expires_at > now ? c : null; },
    async pkChallengePrune(now, keep) { for (const [id, c] of pk.challenges) if (c.expires_at <= now) pk.challenges.delete(id); const all = [...pk.challenges.values()].sort((a, b) => b.expires_at - a.expires_at); for (const c of all.slice(keep)) pk.challenges.delete(c.id); },
    async pkAttempt(key, kind, at = new Date()) { pk.attempts.push({ key, kind, at }); },
    async pkAttempts(key, kind, since) { return pk.attempts.filter((a) => a.key === key && a.kind === kind && a.at >= since).length; },
    async noticeAdd(n) { pk.notices.push({ ...n, id: pk.notices.length + 1, sent_at: null }); },
    // ---- 3d-2: review photo
    async activeTaskPhoto(taskId) { return photos.find((p) => p.task_id === taskId && !p.deleted_at) ?? null; },
    async addTaskPhoto(p, actor) {
      if (photos.some((x) => x.task_id === p.task_id && !x.deleted_at)) throw Object.assign(new Error("duplicate"), { code: "23505" });
      photos.push({ ...p, uploaded_by: actor, deleted_at: null });
    },
    async duePhotos(now) { return photos.filter((p) => !p.deleted_at && p.delete_after <= now); },
    async markPhotoDeleted(id) { const p = photos.find((x) => x.id === id); if (p && !p.deleted_at) p.deleted_at = new Date(); },
    async listCheckins(ids) { return [...checkins.values()].filter((c) => ids.includes(c.goal_id)); },
    async saveCheckin(c) { const k = `${c.goal_id}|${c.week_start}`; const id = checkins.get(k)?.id ?? checkins.size + 1; checkins.set(k, { ...c, id }); return id; },
    async listEvents(from, to) { return [...events3.values()].filter((e) => !e.archived_at && e.on_date >= from && e.on_date <= to); },
    async getEvent(id) { return events3.get(id) ?? null; },
    async createEvent(e) { events3.set(e.id, { ...e, archived_at: null }); },
    async archiveEvent(id) { const e = events3.get(id); if (!e || e.archived_at) return false; e.archived_at = now(); return true; },
    async getIcs(pid) { const t = ics.get(pid); return t && !t.revoked_at ? { created_at: t.created_at } : null; },
    async setIcs(pid, hash) { ics.set(pid, { hash, created_at: now(), revoked_at: null }); },
    async revokeIcs(pid) { const t = ics.get(pid); if (!t || t.revoked_at) return false; t.revoked_at = now(); return true; },
    async revokeAllIcs() { let n = 0; for (const t of ics.values()) if (!t.revoked_at) { t.revoked_at = now(); n++; } return n; },
    async personByIcs(hash) { for (const [pid, t] of ics) if (t.hash === hash && !t.revoked_at) return people.get(pid) ?? null; return null; },
    // ---- Stage 3c
    async councilTasks(date) { return [...btasks.values()].filter((t) => t.council_date === date); },
    async openCouncilTasksOf(pid) { return [...btasks.values()].filter((t) => t.origin === "council" && ["approved", "accepted", "in_progress"].includes(t.state) && (t.assignee_id === pid || (t.co_ids ?? []).includes(pid))); },
    async choreRoutines() { return [...routines.values()].filter((r) => !r.archived_at && r.kind === "chore"); },
    async legacyCouncilTasks() { return [...tasks.values()].map((t) => ({ ...t, on_date: [...meetings.values()].find((m) => m.id === t.meeting_id)?.on_date })); },
    async boardTasks(from, to) { return [...btasks.values()].filter((t) => t.plan_date >= from && t.plan_date <= to); },
    async boardTask(id) { return btasks.get(id) ?? null; },
    async insertTask(t, actor) {
      const all = [...btasks.values()];
      if (btasks.has(t.id) || (t.template_id && all.some((x) => x.template_id === t.template_id && x.plan_date === t.plan_date)) || (t.carried_from && all.some((x) => x.carried_from === t.carried_from))) return false; // same as the PK + ON CONFLICT in Postgres
      btasks.set(t.id, { co_ids: [], accountable_id: null, when_slot: null, estimate_min: null, ...t, state: t.state ?? "proposed", approved_at: t.approved_by ? now() : null, created_by: actor, created_at: now() }); return true;
    },
    async moveTask(id, from, to, patch = {}) {
      const t = btasks.get(id); if (!t || t.state !== from) return false;
      const who = (x) => [x.assignee_id, ...(x.co_ids ?? [])], mine = who({ ...t, ...patch });
      if (to === "in_progress" && [...btasks.values()].some((x) => x.id !== id && x.state === "in_progress" && who(x).some((p) => mine.includes(p)))) throw Object.assign(new Error("one in progress"), { code: "23505" });
      const stamp = from === to ? null : STAMP[to];
      Object.assign(t, patch, { state: to }); if (stamp) t[stamp] = now(); return true;
    },
    async inProgressOf(pid) { const t = [...btasks.values()].find((x) => x.state === "in_progress" && (x.assignee_id === pid || (x.co_ids ?? []).includes(pid))); return t ? { id: t.id } : null; },
    async taskEvents(id) { return events.filter((e) => e.ref === id && e.type.startsWith("task.")).map((e) => ({ type: e.type, actor: e.actor, at: e.at })); },
    async listTemplates() { return [...templates.values()].filter((t) => !t.archived_at); },
    async getTemplate(id) { return templates.get(id) ?? null; },
    async insertTemplate(t, actor) { templates.set(t.id, { ...t, active: Boolean(t.active), archived_at: null, created_by: actor }); },
    async updateTemplate(id, p) { const t = templates.get(id); if (!t || t.archived_at) return false; for (const k of ["mask", "needs_review"]) if (p[k] !== undefined) t[k] = p[k]; if ("due_time" in p) t.due_time = p.due_time; if (p.archived) t.archived_at = now(); return true; },
    async activateTemplates(ids) { let n = 0; for (const t of templates.values()) if (!t.archived_at && !t.active && (!ids || ids.includes(t.id))) { t.active = true; n++; } return n; },
    async sprintGoals(week) { return [...sgoals.values()].filter((g) => g.week_start === week && !g.archived_at); },
    async getSprintGoal(id) { return sgoals.get(id) ?? null; },
    async insertSprintGoal(g) { sgoals.set(g.id, { ...g, archived_at: null }); },
    async updateSprintGoal(id, p) { const g = sgoals.get(id); if (!g || g.archived_at) return false; if (p.title) g.title = p.title; if (p.archived) g.archived_at = now(); return true; },
    async planApproval(date) { return approvals.get(date) ?? null; },
    async approvePlan(date, by, auto) { if (approvals.has(date)) return false; approvals.set(date, { approved_by: by, auto, at: now() }); return true; },

    _raw: { pk, photos: () => photos, notes, log, docs: () => docs, files: () => files, checks, events, rchecks, goals, meetings, ics, btasks, templates, approvals },
  };
}
