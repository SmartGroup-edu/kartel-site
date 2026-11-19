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
ALTER TABLE access_log DROP CONSTRAINT IF EXISTS access_log_action_check;
ALTER TABLE access_log ADD CONSTRAINT access_log_action_check CHECK (action IN ('read', 'write', 'reveal', 'copy'));

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
