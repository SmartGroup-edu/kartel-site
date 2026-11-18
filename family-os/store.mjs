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
      return (await q(`SELECT id, person_id, kind, title, rrule, to_char(dtstart, 'YYYY-MM-DD') AS dtstart, at_time, created_at FROM routine
                       WHERE person_id = $1 AND archived_at IS NULL ORDER BY at_time NULLS LAST, created_at`, [personId])).rows;
    },
    async getRoutine(id) {
      return (await q("SELECT id, person_id, kind, title, rrule, to_char(dtstart, 'YYYY-MM-DD') AS dtstart, at_time, archived_at FROM routine WHERE id = $1", [id])).rows[0] ?? null;
    },
    async createRoutine(r, actor) {
      await q("INSERT INTO routine (id, person_id, kind, title, rrule, dtstart, at_time, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [r.id, r.person_id, r.kind, r.title, r.rrule, r.dtstart, r.at_time, actor]);
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
      return (await q("SELECT email_on, digest_time, evening_on, evening_time, lang FROM notification_pref WHERE person_id = $1", [personId])).rows[0] ?? null;
    },
    async setPrefs(personId, p, actor) {
      await q(`INSERT INTO notification_pref (person_id, email_on, digest_time, evening_on, evening_time, lang, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
               ON CONFLICT (person_id) DO UPDATE SET email_on = $2, digest_time = $3, evening_on = $4, evening_time = $5, lang = $6, updated_by = $7, updated_at = now()`,
        [personId, p.email_on, p.digest_time, p.evening_on, p.evening_time, p.lang, actor]);
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
    async listGoals(personId) { return (await q("SELECT id, person_id, sphere, visibility, wrapped_key, title_ct, status, created_at FROM goal WHERE person_id = $1 AND status <> 'archived' ORDER BY status, created_at", [personId])).rows; },
    async getGoal(id) { return (await q("SELECT id, person_id, sphere, visibility, wrapped_key, title_ct, status FROM goal WHERE id = $1", [id])).rows[0] ?? null; },
    async createGoal(g, actor) {
      await q("INSERT INTO goal (id, person_id, sphere, visibility, wrapped_key, title_ct, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)", [g.id, g.person_id, g.sphere, g.visibility, g.wrapped_key, g.title_ct, actor]);
    },
    async updateGoal(id, patch) { return (await q("UPDATE goal SET status = COALESCE($2, status), visibility = COALESCE($3, visibility), updated_at = now() WHERE id = $1", [id, patch.status ?? null, patch.visibility ?? null])).rowCount === 1; },
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
    async personByIcs(hash) { return (await q("SELECT p.* FROM ics_token t JOIN person p ON p.id = t.person_id WHERE t.token_hash = $1 AND t.revoked_at IS NULL", [hash])).rows[0] ?? null; },
    // ---- Stage 3c: board
    async boardTasks(from, to) { return (await q(`SELECT *, to_char(plan_date, 'YYYY-MM-DD') AS plan_date FROM task WHERE plan_date BETWEEN $1 AND $2 ORDER BY due_time NULLS LAST, created_at`, [from, to])).rows; },
    async boardTask(id) { return (await q(`SELECT *, to_char(plan_date, 'YYYY-MM-DD') AS plan_date FROM task WHERE id = $1`, [id])).rows[0] ?? null; },
    async insertTask(t, actor) {
      return (await q(`INSERT INTO task (id, plan_date, kind, origin, template_id, sprint_goal_id, carried_from, assignee_id, wrapped_key, title_ct, due_time, needs_review, state, approved_by, approved_at, created_by,
                         co_ids, accountable_id, when_slot, estimate_min)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CASE WHEN $14::text IS NULL THEN NULL ELSE now() END, $15, $16, $17, $18, $19) ON CONFLICT DO NOTHING RETURNING id`,
        [t.id, t.plan_date, t.kind, t.origin, t.template_id ?? null, t.sprint_goal_id ?? null, t.carried_from ?? null, t.assignee_id, t.wrapped_key, t.title_ct, t.due_time ?? null, Boolean(t.needs_review), t.state ?? "proposed", t.approved_by ?? null, actor,
         t.co_ids ?? [], t.accountable_id ?? null, t.when_slot ?? null, t.estimate_min ?? null])).rowCount === 1;
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

export function memoryStore() {
  const people = new Map(), grants = new Map(), notes = new Map(), docs = new Map(), files = new Map(), routines = new Map(), checks = [], log = [], auditLog = [], events = [], prefs = new Map(), pauses = new Map(), rotations = new Map(), rchecks = [], meetings = new Map(), tasks = new Map(), goals = new Map(), checkins = new Map(), events3 = new Map(), ics = new Map(), btasks = new Map(), templates = new Map(), sgoals = new Map(), approvals = new Map();
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
    async logAccess(entry) { if (this.failLog) throw new Error("log unavailable"); log.push({ id: log.length + 1, at: now(), ...entry }); },
    async accessLog() { return [...log].reverse(); },
    // ---- Stage 2a
    async setBirthDate(id, date) { const p = people.get(id); if (!p) return false; p.birth_date = date; return true; },
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
    async setPrefs(id, p) { prefs.set(id, { ...p }); },
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
    async updateGoal(id, patch) { const g = goals.get(id); if (!g) return false; if (patch.status) g.status = patch.status; if (patch.visibility) g.visibility = patch.visibility; return true; },
    async listCheckins(ids) { return [...checkins.values()].filter((c) => ids.includes(c.goal_id)); },
    async saveCheckin(c) { const k = `${c.goal_id}|${c.week_start}`; const id = checkins.get(k)?.id ?? checkins.size + 1; checkins.set(k, { ...c, id }); return id; },
    async listEvents(from, to) { return [...events3.values()].filter((e) => !e.archived_at && e.on_date >= from && e.on_date <= to); },
    async getEvent(id) { return events3.get(id) ?? null; },
    async createEvent(e) { events3.set(e.id, { ...e, archived_at: null }); },
    async archiveEvent(id) { const e = events3.get(id); if (!e || e.archived_at) return false; e.archived_at = now(); return true; },
    async getIcs(pid) { const t = ics.get(pid); return t && !t.revoked_at ? { created_at: t.created_at } : null; },
    async setIcs(pid, hash) { ics.set(pid, { hash, created_at: now(), revoked_at: null }); },
    async revokeIcs(pid) { const t = ics.get(pid); if (!t || t.revoked_at) return false; t.revoked_at = now(); return true; },
    async personByIcs(hash) { for (const [pid, t] of ics) if (t.hash === hash && !t.revoked_at) return people.get(pid) ?? null; return null; },
    // ---- Stage 3c
    async boardTasks(from, to) { return [...btasks.values()].filter((t) => t.plan_date >= from && t.plan_date <= to); },
    async boardTask(id) { return btasks.get(id) ?? null; },
    async insertTask(t, actor) {
      const all = [...btasks.values()];
      if ((t.template_id && all.some((x) => x.template_id === t.template_id && x.plan_date === t.plan_date)) || (t.carried_from && all.some((x) => x.carried_from === t.carried_from))) return false;
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

    _raw: { notes, log, docs: () => docs, files: () => files, checks, events, rchecks, goals, meetings, ics, btasks, templates, approvals },
  };
}
