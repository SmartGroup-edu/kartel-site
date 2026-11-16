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
