-- Family OS (plan v3) — Stage 1: people, guardian grants, encrypted care notes, append-only read log.
-- Own database (CGOS D03: project data is not merged into another project's database).
-- Applied on every start; idempotent.

CREATE TABLE IF NOT EXISTS person (
  id               uuid PRIMARY KEY,
  email            text NOT NULL UNIQUE CHECK (email = lower(email) AND email ~ '^[^\s@]+@[^\s@]+$'),
  name_en          text NOT NULL CHECK (length(name_en) BETWEEN 1 AND 200),
  name_ru          text NOT NULL CHECK (length(name_ru) BETWEEN 1 AND 200),
  kind             text NOT NULL CHECK (kind IN ('adult', 'child')),
  cpif_subject_id  text,                       -- empty until an ecosystem identity is chosen
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       text NOT NULL
);

-- CGOS §3.2: a family link alone grants nothing; guardian authority is explicit, scoped, revocable.
CREATE TABLE IF NOT EXISTS guardian_grant (
  id           uuid PRIMARY KEY,
  guardian_id  uuid NOT NULL REFERENCES person(id),
  child_id     uuid NOT NULL REFERENCES person(id),
  relation     text NOT NULL CHECK (relation IN ('parent', 'relative')),
  scopes       text[] NOT NULL CHECK (cardinality(scopes) >= 1 AND scopes <@ ARRAY['routines', 'health', 'education']::text[]),
  granted_by   text NOT NULL,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  CHECK (guardian_id <> child_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS guardian_grant_active ON guardian_grant (guardian_id, child_id) WHERE revoked_at IS NULL;

-- Health and education notes: only ciphertext and the wrapped data key are stored (crypto.mjs).
CREATE TABLE IF NOT EXISTS care_note (
  id           uuid PRIMARY KEY,
  person_id    uuid NOT NULL REFERENCES person(id),
  kind         text NOT NULL CHECK (kind IN ('health', 'education')),
  wrapped_key  text NOT NULL,
  title_ct     text NOT NULL,
  body_ct      text NOT NULL,
  key_version  integer NOT NULL,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_note_person ON care_note (person_id, kind);

-- Every read of a care note or a child's record is written here BEFORE the data is returned; if the
-- write fails, the read fails. Rows can be added, never changed or removed.
CREATE TABLE IF NOT EXISTS access_log (
  id                 bigserial PRIMARY KEY,
  at                 timestamptz NOT NULL DEFAULT now(),
  actor              text NOT NULL,
  subject_person_id  uuid NOT NULL,
  entity             text NOT NULL,
  action             text NOT NULL CHECK (action IN ('read', 'write'))
);
CREATE OR REPLACE FUNCTION access_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'access_log is append-only'; END $$;
DROP TRIGGER IF EXISTS access_log_no_update ON access_log;
CREATE TRIGGER access_log_no_update BEFORE UPDATE OR DELETE ON access_log FOR EACH ROW EXECUTE FUNCTION access_log_append_only();
DROP TRIGGER IF EXISTS access_log_no_truncate ON access_log;
CREATE TRIGGER access_log_no_truncate BEFORE TRUNCATE ON access_log FOR EACH STATEMENT EXECUTE FUNCTION access_log_append_only();

-- Changes to people and grants (never note contents).
CREATE TABLE IF NOT EXISTS audit (
  id      bigserial PRIMARY KEY,
  at      timestamptz NOT NULL DEFAULT now(),
  actor   text NOT NULL,
  action  text NOT NULL,
  entity  text NOT NULL
);

-- One encrypted canary row (no personal data), so every restore drill can prove that the master key
-- still opens what the backup holds, even before any care note exists.
CREATE TABLE IF NOT EXISTS drill_canary (
  id           uuid PRIMARY KEY,
  wrapped_key  text NOT NULL,
  title_ct     text NOT NULL,
  body_ct      text NOT NULL,
  key_version  integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---- Stage 2a: documents (R0 2026-11-17) -------------------------------------------------------
ALTER TABLE person ADD COLUMN IF NOT EXISTS birth_date date;

-- Grants gain a "documents" scope; reads/reveals/copies are logged like note reads.
ALTER TABLE guardian_grant DROP CONSTRAINT IF EXISTS guardian_grant_scopes_check;
ALTER TABLE guardian_grant ADD CONSTRAINT guardian_grant_scopes_check
  CHECK (cardinality(scopes) >= 1 AND scopes <@ ARRAY['routines', 'health', 'education', 'documents']::text[]);
-- access_log_action_check is defined once, at the end of this file (3e-2). Re-adding a narrower list
-- here broke every start once an 'export'/'delete' row existed (QA-156 C1).

CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now());
-- One-time: parents' existing grants on minors include documents (R0 2026-11-17). Later grants are
-- whatever the admin sets.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migration WHERE name = '2026-11-17-parents-documents') THEN
    UPDATE guardian_grant SET scopes = array_append(scopes, 'documents')
      WHERE relation = 'parent' AND revoked_at IS NULL AND NOT ('documents' = ANY (scopes));
    INSERT INTO schema_migration (name) VALUES ('2026-11-17-parents-documents');
  END IF;
END $$;

-- An identity document. Plain: what lists and reminders need (type, issuing country, dates, the last
-- three characters of the number). Everything else is ciphertext under the document's own data key.
CREATE TABLE IF NOT EXISTS document (
  id           uuid PRIMARY KEY,
  person_id    uuid REFERENCES person(id),
  archive      boolean NOT NULL DEFAULT false,   -- heritage archive record (admin-only), not a person
  type         text NOT NULL CHECK (type IN ('passport', 'national_id', 'ni_number', 'residence', 'other')),
  country      text CHECK (country IS NULL OR length(country) <= 60),
  issue_date   date,
  expiry_date  date,
  number_hint  text CHECK (number_hint IS NULL OR length(number_hint) <= 3),
  wrapped_key  text NOT NULL,
  fields_ct    text NOT NULL,      -- JSON: authority, holder name, birth date/place, sex, nationality
  number_ct    text,
  pcode_ct     text,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (archive OR person_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS document_person ON document (person_id);

CREATE TABLE IF NOT EXISTS document_file (
  id           uuid PRIMARY KEY,
  document_id  uuid NOT NULL REFERENCES document(id),
  name_ct      text NOT NULL,      -- the original file name is personal too
  mime         text NOT NULL CHECK (mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/heic')),
  size         integer NOT NULL,
  wrapped_key  text NOT NULL,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_file_doc ON document_file (document_id);

-- Document-expiry reminders already sent (bus 66): one row per document, milestone and recipient.
CREATE TABLE IF NOT EXISTS reminder_sent (
  document_id   uuid NOT NULL REFERENCES document(id),
  milestone     smallint NOT NULL CHECK (milestone IN (12, 6, 3, 1, 0)),
  recipient_id  uuid NOT NULL REFERENCES person(id),
  sent_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, milestone, recipient_id)
);

-- ---- Stage 2: routines and chores (bus 72; plan v3.8 §3.4) ---------------------------------------
-- A recurring item of one person. The rule is an RRULE subset (recur.mjs); occurrences are computed.
CREATE TABLE IF NOT EXISTS routine (
  id           uuid PRIMARY KEY,
  person_id    uuid NOT NULL REFERENCES person(id),
  kind         text NOT NULL CHECK (kind IN ('routine', 'chore')),
  title        text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  rrule        text NOT NULL CHECK (length(rrule) BETWEEN 9 AND 120),
  dtstart      date NOT NULL,
  at_time      text CHECK (at_time IS NULL OR at_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz
);
CREATE INDEX IF NOT EXISTS routine_person ON routine (person_id) WHERE archived_at IS NULL;

-- Tick-offs. A tick or an untick is a new row; the latest row for (routine, day) is the state, and
-- the history is never lost (plan §3.4: «отметка — отдельная строка, история не теряется»).
CREATE TABLE IF NOT EXISTS routine_check (
  id          bigserial PRIMARY KEY,
  routine_id  uuid NOT NULL REFERENCES routine(id),
  on_date     date NOT NULL,
  done        boolean NOT NULL,
  by_actor    text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routine_check_day ON routine_check (routine_id, on_date, id DESC);

-- ---- Stage 3a: engine (bus 77; plan v3.8 §3.3–3.6) ------------------------------------------------
CREATE OR REPLACE FUNCTION append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;

-- The event bus: what happened, who, about whom, which object. Never titles, text, numbers or names.
CREATE TABLE IF NOT EXISTS event (
  id                 bigserial PRIMARY KEY,
  at                 timestamptz NOT NULL DEFAULT now(),
  type               text NOT NULL CHECK (type ~ '^[a-z_]+\.[a-z_]+$'),
  actor              text NOT NULL,
  subject_person_id  uuid,
  ref                text CHECK (ref IS NULL OR length(ref) <= 80)
);
CREATE INDEX IF NOT EXISTS event_at ON event (at);
DROP TRIGGER IF EXISTS event_no_update ON event;
CREATE TRIGGER event_no_update BEFORE UPDATE OR DELETE ON event FOR EACH ROW EXECUTE FUNCTION append_only();
DROP TRIGGER IF EXISTS event_no_truncate ON event;
CREATE TRIGGER event_no_truncate BEFORE TRUNCATE ON event FOR EACH STATEMENT EXECUTE FUNCTION append_only();

-- Rules are data: on/off and dry-run per rule. Dry-run records what would be sent, sends nothing.
CREATE TABLE IF NOT EXISTS rule (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z_]+$'),
  enabled     boolean NOT NULL,
  dry_run     boolean NOT NULL DEFAULT true,
  updated_by  text,
  updated_at  timestamptz
);
INSERT INTO rule (id, enabled) VALUES ('digest', true), ('evening_checkin', true), ('documents_in_digest', false),
  ('missed_routine_parent_note', false), ('council_reminder', false) ON CONFLICT DO NOTHING;

-- One row per (rule, idempotency key, person): written BEFORE a send; a failed send removes it.
CREATE TABLE IF NOT EXISTS rule_run (
  rule_id      text NOT NULL REFERENCES rule(id),
  key          text NOT NULL CHECK (length(key) <= 80),
  person_id    uuid NOT NULL REFERENCES person(id),
  family_date  date NOT NULL,
  outcome      text NOT NULL CHECK (outcome IN ('sent', 'dry_run', 'opted_out', 'quiet_hours', 'daily_cap', 'no_email')),
  at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, key, person_id)
);
CREATE INDEX IF NOT EXISTS rule_run_day ON rule_run (family_date, person_id);

-- Notification settings per person (defaults when no row): email on, digest 07:00, evening off.
-- Digest and evening times must fall outside the family quiet hours (21:00–07:00).
CREATE TABLE IF NOT EXISTS notification_pref (
  person_id     uuid PRIMARY KEY REFERENCES person(id),
  email_on      boolean NOT NULL DEFAULT true,
  digest_time   text NOT NULL DEFAULT '07:00' CHECK (digest_time ~ '^(0[7-9]|1[0-9]|20):[0-5][0-9]$'),
  evening_on    boolean NOT NULL DEFAULT false,
  evening_time  text NOT NULL DEFAULT '20:00' CHECK (evening_time ~ '^(0[7-9]|1[0-9]|20):[0-5][0-9]$'),
  lang          text NOT NULL DEFAULT 'ru' CHECK (lang IN ('ru', 'en')),
  updated_by    text,
  updated_at    timestamptz
);

-- «День без ритма»: no items, no reminders, streaks skip these days. Cancelled, never deleted.
CREATE TABLE IF NOT EXISTS pause (
  id            uuid PRIMARY KEY,
  person_id     uuid NOT NULL REFERENCES person(id),
  from_date     date NOT NULL,
  to_date       date NOT NULL,
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at  timestamptz,
  CHECK (to_date >= from_date AND to_date - from_date <= 60)
);
CREATE INDEX IF NOT EXISTS pause_person ON pause (person_id) WHERE cancelled_at IS NULL;

-- A chore that goes round the members in turn (round-robin by occurrence; engine.mjs rotationAssignee).
CREATE TABLE IF NOT EXISTS rotation (
  id           uuid PRIMARY KEY,
  title        text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  rrule        text NOT NULL CHECK (length(rrule) BETWEEN 9 AND 120),
  dtstart      date NOT NULL,
  at_time      text CHECK (at_time IS NULL OR at_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  members      uuid[] NOT NULL CHECK (cardinality(members) BETWEEN 2 AND 8),
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz
);
CREATE TABLE IF NOT EXISTS rotation_check (
  id           bigserial PRIMARY KEY,
  rotation_id  uuid NOT NULL REFERENCES rotation(id),
  on_date      date NOT NULL,
  person_id    uuid NOT NULL REFERENCES person(id),
  done         boolean NOT NULL,
  by_actor     text NOT NULL,
  at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rotation_check_day ON rotation_check (rotation_id, on_date, id DESC);

-- ---- Stage 3b: council, goals, calendar (bus 79) --------------------------------------------------
-- Family council: one meeting per date. Notes are free text → envelope-encrypted like care notes.
CREATE TABLE IF NOT EXISTS council_meeting (
  id           uuid PRIMARY KEY,
  on_date      date NOT NULL UNIQUE,
  wrapped_key  text NOT NULL,
  notes_ct     text,
  held_at      timestamptz,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- A decision becomes a task with an owner and a date. The title is shown on Today, like a routine title.
CREATE TABLE IF NOT EXISTS council_task (
  id           uuid PRIMARY KEY,
  meeting_id   uuid NOT NULL REFERENCES council_meeting(id),
  title        text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  owner_id     uuid NOT NULL REFERENCES person(id),
  due_date     date NOT NULL,
  done_at      timestamptz,
  done_by      text,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS council_task_owner ON council_task (owner_id) WHERE done_at IS NULL;

-- Goals: the title and every check-in note are ciphertext under the goal's own data key.
CREATE TABLE IF NOT EXISTS goal (
  id           uuid PRIMARY KEY,
  person_id    uuid NOT NULL REFERENCES person(id),
  sphere       text NOT NULL CHECK (sphere IN ('health', 'learning', 'character', 'finance', 'contribution', 'joy')),
  visibility   text NOT NULL DEFAULT 'owner' CHECK (visibility IN ('owner', 'guardians', 'family')),
  wrapped_key  text NOT NULL,
  title_ct     text NOT NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goal_person ON goal (person_id);
-- Weekly check-in: how it is going (no score of the person) + an optional short note.
CREATE TABLE IF NOT EXISTS goal_checkin (
  id           bigserial PRIMARY KEY,
  goal_id      uuid NOT NULL REFERENCES goal(id),
  week_start   date NOT NULL,
  mood         text NOT NULL CHECK (mood IN ('on_track', 'slow', 'paused')),
  note_ct      text,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, week_start)
);

CREATE TABLE IF NOT EXISTS family_event (
  id           uuid PRIMARY KEY,
  title        text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  on_date      date NOT NULL,
  at_time      text CHECK (at_time IS NULL OR at_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz
);
CREATE INDEX IF NOT EXISTS family_event_date ON family_event (on_date) WHERE archived_at IS NULL;

-- Personal calendar feed: only the SHA-256 of the token is stored; a new link revokes the old one.
CREATE TABLE IF NOT EXISTS ics_token (
  person_id    uuid PRIMARY KEY REFERENCES person(id),
  token_hash   text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);

-- ---- Stage 3c: family board (bus 82) ----------------------------------------------------------------
-- Templates for the daily plan. Titles are ciphertext. Imported templates arrive inactive (drafts);
-- nothing becomes active until a parent presses «Утвердить шаблоны».
CREATE TABLE IF NOT EXISTS task_template (
  id            uuid PRIMARY KEY,
  wrapped_key   text NOT NULL,
  title_ct      text NOT NULL,
  mask          text NOT NULL CHECK (mask ~ '^[01]{7}$' AND mask LIKE '%1%'),
  dtstart       date NOT NULL,
  assignee_id   uuid REFERENCES person(id),
  members       uuid[] CHECK (members IS NULL OR cardinality(members) BETWEEN 2 AND 8),
  due_time      text CHECK (due_time IS NULL OR due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  when_slot     text CHECK (when_slot IS NULL OR when_slot IN ('morning', 'after_school', 'after_dinner', 'evening')),
  estimate_min  integer CHECK (estimate_min IS NULL OR estimate_min BETWEEN 1 AND 600),
  needs_review  boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT false,
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz,
  CHECK ((assignee_id IS NOT NULL) <> (members IS NOT NULL))
);

-- Sprint of the week (Mon–Sun, tied to the council): 1–3 goals; their tasks are ordinary tasks.
CREATE TABLE IF NOT EXISTS sprint_goal (
  id              uuid PRIMARY KEY,
  week_start      date NOT NULL,
  title           text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  source_task_id  uuid REFERENCES council_task(id),
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);
CREATE INDEX IF NOT EXISTS sprint_goal_week ON sprint_goal (week_start) WHERE archived_at IS NULL;

-- A task for one day. Title, decline reason and rework note are ciphertext under the task's own key.
CREATE TABLE IF NOT EXISTS task (
  id              uuid PRIMARY KEY,
  plan_date       date NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('chore', 'rotation', 'sprint', 'oneoff')),
  origin          text NOT NULL CHECK (origin IN ('template', 'rotation', 'sprint', 'carry', 'adhoc', 'council')),
  council_date    date,                                      -- a council decision (bus 85: one model — decisions are tasks)
  template_id     uuid REFERENCES task_template(id),
  sprint_goal_id  uuid REFERENCES sprint_goal(id),
  carried_from    uuid REFERENCES task(id),
  assignee_id     uuid NOT NULL REFERENCES person(id),
  co_ids          uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(co_ids) <= 3 AND NOT (assignee_id = ANY (co_ids))),  -- joint task (bus 83 §4)
  accountable_id  uuid REFERENCES person(id),                -- reviews needs_review tasks (bus 84); default: the approving parent
  wrapped_key     text NOT NULL,
  title_ct        text NOT NULL,
  due_time        text CHECK (due_time IS NULL OR due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  when_slot       text CHECK (when_slot IS NULL OR when_slot IN ('morning', 'after_school', 'after_dinner', 'evening')),
  estimate_min    integer CHECK (estimate_min IS NULL OR estimate_min BETWEEN 1 AND 600),
  needs_review    boolean NOT NULL DEFAULT false,
  state           text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'approved', 'accepted', 'in_progress', 'done', 'reviewed', 'declined', 'declined_by_adult', 'carried_over', 'cancelled')),
  decline_code    text CHECK (decline_code IS NULL OR decline_code IN ('lessons', 'away', 'unwell', 'other')),
  decline_ct      text,
  rework_ct       text,
  approved_by     text,
  approved_at     timestamptz,
  accepted_at     timestamptz,
  started_at      timestamptz,
  done_at         timestamptz,
  reviewed_at     timestamptz,
  reviewed_by     text,
  declined_at     timestamptz,
  continued_at    timestamptz,                               -- «Продолжаю» on the quiet nudge
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_day ON task (plan_date, assignee_id);
CREATE INDEX IF NOT EXISTS task_council ON task (council_date) WHERE council_date IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS task_template_day ON task (template_id, plan_date) WHERE template_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS task_carried_once ON task (carried_from) WHERE carried_from IS NOT NULL;
-- At most one task in progress per person (bus 82 §4) — enforced by the database too.
CREATE UNIQUE INDEX IF NOT EXISTS task_one_in_progress ON task (assignee_id) WHERE state = 'in_progress';
-- …and for joint tasks: no participant may be in two in-progress tasks (serialised, so two starts cannot race).
CREATE OR REPLACE FUNCTION task_one_in_progress_joint() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = 'in_progress' THEN
    PERFORM pg_advisory_xact_lock(hashtext('task_in_progress'));
    IF EXISTS (SELECT 1 FROM task t WHERE t.id <> NEW.id AND t.state = 'in_progress'
               AND (ARRAY[t.assignee_id] || t.co_ids) && (ARRAY[NEW.assignee_id] || NEW.co_ids)) THEN
      RAISE EXCEPTION 'one task in progress per person' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS task_one_in_progress_joint ON task;
CREATE TRIGGER task_one_in_progress_joint BEFORE INSERT OR UPDATE OF state, assignee_id, co_ids ON task FOR EACH ROW EXECUTE FUNCTION task_one_in_progress_joint();

-- A task's history (drawer timeline, bus 84) reads its events by ref.
CREATE INDEX IF NOT EXISTS event_ref ON event (ref) WHERE ref IS NOT NULL;

-- The plan of a day was approved: by a parent, or automatically at 07:00 (template set only).
CREATE TABLE IF NOT EXISTS plan_approval (
  plan_date    date PRIMARY KEY,
  approved_by  text NOT NULL,
  auto         boolean NOT NULL,
  at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO rule (id, enabled) VALUES ('board_new_tasks', false), ('plan_ready', false), ('needs_decision', false) ON CONFLICT DO NOTHING;

-- ---- Stage 3d: values without AI (bus 86; plan «Наставник · Кодекс» §3, §6.1; R0 18.11.2026) -------------
-- Кодекс: versions are append-only; the newest row is the current text. v1 is seeded at start (server.mjs,
-- ensureKodeks) as approved on 18.11.2026. The text is the family's own agreement — no personal data.
CREATE TABLE IF NOT EXISTS kodeks_version (
  version      integer PRIMARY KEY CHECK (version >= 1),
  body         jsonb NOT NULL,
  status       text NOT NULL CHECK (status IN ('approved', 'draft')),
  approved_on  date,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'approved') = (approved_on IS NOT NULL))
);
DROP TRIGGER IF EXISTS kodeks_no_update ON kodeks_version;
CREATE TRIGGER kodeks_no_update BEFORE UPDATE OR DELETE ON kodeks_version FOR EACH ROW EXECUTE FUNCTION append_only();

-- Принцип недели: a parent's pick for a week (Monday). No row = round-robin.
CREATE TABLE IF NOT EXISTS principle_week (
  week_start   date PRIMARY KEY CHECK (extract(isodow FROM week_start) = 1),
  idx          smallint NOT NULL CHECK (idx BETWEEN 0 AND 7),
  set_by       text NOT NULL,
  set_at       timestamptz NOT NULL DEFAULT now()
);

-- Признание: the text is ciphertext under its own data key. No counters anywhere (bus 86 §3).
CREATE TABLE IF NOT EXISTS recognition (
  id           uuid PRIMARY KEY,
  from_id      uuid NOT NULL REFERENCES person(id),
  to_id        uuid NOT NULL REFERENCES person(id),
  idx          smallint NOT NULL CHECK (idx BETWEEN 0 AND 7),
  wrapped_key  text NOT NULL,
  text_ct      text NOT NULL,
  on_date      date NOT NULL,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (from_id <> to_id)
);
CREATE INDEX IF NOT EXISTS recognition_week ON recognition (on_date);
CREATE INDEX IF NOT EXISTS recognition_sender_day ON recognition (from_id, on_date);

-- «После чего?» on a routine: free text or another routine of the same person (checked in server.mjs).
ALTER TABLE routine ADD COLUMN IF NOT EXISTS anchor_text text CHECK (anchor_text IS NULL OR length(anchor_text) BETWEEN 1 AND 60);
ALTER TABLE routine ADD COLUMN IF NOT EXISTS anchor_routine_id uuid REFERENCES routine(id);
ALTER TABLE routine DROP CONSTRAINT IF EXISTS routine_one_anchor;
ALTER TABLE routine ADD CONSTRAINT routine_one_anchor CHECK (anchor_text IS NULL OR anchor_routine_id IS NULL);
-- WOOP on a goal: one ciphertext (JSON) under the goal's own key; owner-only.
ALTER TABLE goal ADD COLUMN IF NOT EXISTS woop_ct text;
-- Бережный счёт: an adult may choose the streak; a child always sees the weekly count (enforced in code).
ALTER TABLE notification_pref ADD COLUMN IF NOT EXISTS count_mode text NOT NULL DEFAULT 'week' CHECK (count_mode IN ('week', 'streak'));

-- ================= Stage 3d-2 (bus 84/97) =================
-- «Кто уже с нами» (owner): the first and last sign-in DATE per address — no times, no IPs, no devices.
-- Keyed by the lowercased email (the session subject), so the owner, who may not be a person row, counts too.
CREATE TABLE IF NOT EXISTS signin_seen (
  email     text PRIMARY KEY CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  first_on  date NOT NULL,
  last_on   date NOT NULL
);
-- «Отправить ссылку ещё раз»: an owner's request, sent by the runner through the relay (the service holds no
-- relay secret). One per person per day; the row records when it went out.
CREATE TABLE IF NOT EXISTS invite_request (
  id            bigserial PRIMARY KEY,
  person_id     uuid NOT NULL REFERENCES person(id),
  on_date       date NOT NULL,
  requested_by  text NOT NULL,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  UNIQUE (person_id, on_date)
);
-- Optional review photo (bus 84/97 item 4): bytes live sealed in the files dir as photo-<id>; this row has
-- no image data. One active photo per task. delete_after = upload + 7 days; the runner deletes the file and
-- sets deleted_at. Parents only (enforced in code).
CREATE TABLE IF NOT EXISTS task_photo (
  id            uuid PRIMARY KEY,
  task_id       uuid NOT NULL REFERENCES task(id),
  mime          text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/heic')),
  size          integer NOT NULL CHECK (size > 0),
  wrapped_key   text NOT NULL,
  uploaded_by   text NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  delete_after  timestamptz NOT NULL,
  deleted_at    timestamptz,
  CHECK (delete_after <= uploaded_at + interval '7 days')
);
CREATE UNIQUE INDEX IF NOT EXISTS task_photo_one_active ON task_photo (task_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS task_photo_due ON task_photo (delete_after) WHERE deleted_at IS NULL;

-- ================= Passkeys (bus 98 design; bus 100 security review: approved with C1–C4) =================
-- Public keys only. The email is the identity (the session subject), so rows are keyed by the lowercased email;
-- user_handle is random, never derived from it.
CREATE TABLE IF NOT EXISTS passkey_user (
  email        text PRIMARY KEY CHECK (email = lower(email)),
  user_handle  bytea NOT NULL UNIQUE CHECK (length(user_handle) = 32)
);
CREATE TABLE IF NOT EXISTS passkey (
  id             uuid PRIMARY KEY,
  email          text NOT NULL REFERENCES passkey_user(email),
  credential_id  bytea NOT NULL UNIQUE,
  public_key     bytea NOT NULL,
  counter        bigint NOT NULL DEFAULT 0 CHECK (counter >= 0),
  transports     text[] NOT NULL DEFAULT '{}',
  aaguid         text,
  device_kind    text NOT NULL CHECK (device_kind IN ('iphone', 'ipad', 'mac', 'android', 'windows', 'linux', 'key', 'other')),
  device_type    text NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up      boolean NOT NULL DEFAULT false,
  label          text NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  revoked_at     timestamptz,
  revoked_by     text,
  flagged_at     timestamptz
);
CREATE INDEX IF NOT EXISTS passkey_by_email ON passkey (email) WHERE revoked_at IS NULL;
-- Single-use challenges: taken with DELETE … RETURNING; expired ones purged.
CREATE TABLE IF NOT EXISTS passkey_challenge (
  id          uuid PRIMARY KEY,
  purpose     text NOT NULL CHECK (purpose IN ('register', 'auth')),
  email       text CHECK ((purpose = 'register') = (email IS NOT NULL)),
  challenge   text NOT NULL,
  expires_at  timestamptz NOT NULL
);
-- Rate counters (C3): register options and failures per person, failures per credential. Kept 2 days.
CREATE TABLE IF NOT EXISTS passkey_attempt (
  id    bigserial PRIMARY KEY,
  key   text NOT NULL,
  kind  text NOT NULL CHECK (kind IN ('reg_options', 'reg_fail', 'auth_fail')),
  at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passkey_attempt_recent ON passkey_attempt (key, kind, at);
-- Security notices (C1): written in the request, sent by the runner through the relay. No credential ids.
CREATE TABLE IF NOT EXISTS security_notice (
  id           bigserial PRIMARY KEY,
  kind         text NOT NULL CHECK (kind IN ('new_key', 'revoked', 'flagged')),
  email        text NOT NULL,
  device_kind  text NOT NULL,
  on_date      date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);

-- Go-live bundle R1 (bus 100/105): «Завершить сеансы». The owner sets a cut-off per address, or for everyone
-- ('*'). A session issued before the cut-off is refused on the sensitive routes (document open/reveal, passkey
-- register, «Доступы» writes). Upsert only; never deleted by the app.
CREATE TABLE IF NOT EXISTS session_cutoff (
  email   text PRIMARY KEY,
  cut_at  timestamptz NOT NULL,
  cut_by  text NOT NULL
);

-- Stage 3e-1 «Здоровье-лайт» (bus 86/109): movement + sleep ticks (only the family's weekly total is ever shown to
-- others) and the evening question (sealed; only its author reads it). No weight or calorie columns here.
CREATE TABLE IF NOT EXISTS health_pref (
  person_id     uuid PRIMARY KEY REFERENCES person(id),
  ticks_on      boolean NOT NULL,
  evening_q_on  boolean NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS health_tick (
  person_id  uuid NOT NULL REFERENCES person(id),
  on_date    date NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('move', 'sleep')),
  done       boolean NOT NULL,
  PRIMARY KEY (person_id, on_date, kind)
);
CREATE TABLE IF NOT EXISTS evening_answer (
  id           uuid PRIMARY KEY,
  person_id    uuid NOT NULL REFERENCES person(id),
  on_date      date NOT NULL,
  wrapped_key  text NOT NULL,
  text_ct      text NOT NULL,
  UNIQUE (person_id, on_date)
);

-- Stage 3e-2 (R0 18.11.2026): an ADULT's own weight/calorie log and goal. Sealed per row; only the person reads it
-- (every read logged); never in an aggregate; never for anyone under 18 (the service refuses the routes).
CREATE TABLE IF NOT EXISTS body_pref (
  person_id  uuid PRIMARY KEY REFERENCES person(id),
  body_on    boolean NOT NULL
);
CREATE TABLE IF NOT EXISTS body_log (
  id           uuid PRIMARY KEY,
  person_id    uuid NOT NULL REFERENCES person(id),
  on_date      date NOT NULL,
  wrapped_key  text NOT NULL,
  value_ct     text NOT NULL,
  UNIQUE (person_id, on_date)
);
CREATE TABLE IF NOT EXISTS body_goal (
  person_id    uuid PRIMARY KEY REFERENCES person(id),
  wrapped_key  text NOT NULL,
  goal_ct      text NOT NULL
);
-- 3e-2: the person's own export and delete-all are logged too. The only definition of this CHECK:
-- schema.sql runs on every start, so it must always carry the full list (store.mjs LOG_ACTIONS).
ALTER TABLE access_log DROP CONSTRAINT IF EXISTS access_log_action_check;
ALTER TABLE access_log ADD CONSTRAINT access_log_action_check CHECK (action IN ('read', 'write', 'reveal', 'copy', 'export', 'delete'));
