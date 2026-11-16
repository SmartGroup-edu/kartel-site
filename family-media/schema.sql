-- kartel family media — schema. Idempotent: applied on every start.
-- Drafts are edited per key ("person:<nodeId>", "event:<eventId>"); publishing snapshots the whole
-- draft. Every write is in the audit log with its before/after, which is what "undo" replays.
CREATE TABLE IF NOT EXISTS media (
  id          uuid PRIMARY KEY,
  width       integer NOT NULL,
  height      integer NOT NULL,
  bytes       integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text NOT NULL
);
CREATE TABLE IF NOT EXISTS content_draft (
  key         text PRIMARY KEY CHECK (key ~ '^(person|event):[a-z0-9_-]{1,64}$'),
  body        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL
);
CREATE TABLE IF NOT EXISTS published (
  id            bigserial PRIMARY KEY,
  body          jsonb NOT NULL,
  published_at  timestamptz NOT NULL DEFAULT now(),
  published_by  text NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  actor      text NOT NULL,
  action     text NOT NULL CHECK (action IN ('draft.save', 'draft.undo', 'publish', 'media.upload')),
  key        text,
  before     jsonb,
  after      jsonb,
  undone_at  timestamptz
);
CREATE INDEX IF NOT EXISTS audit_at ON audit (at DESC);
