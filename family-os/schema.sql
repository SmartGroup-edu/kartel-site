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
