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

-- ---- Bus 87: the family editor role. An editor's change is a pending revision; nothing reaches the
-- draft (or the family) until the owner approves it. Uploads by an editor stay hidden (pending) until a
-- revision that uses them is approved; rejected ones are purged after 30 days.
ALTER TABLE media ADD COLUMN IF NOT EXISTS pending boolean NOT NULL DEFAULT false;
ALTER TABLE media ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
CREATE TABLE IF NOT EXISTS revision (
  id          uuid PRIMARY KEY,
  key         text NOT NULL CHECK (key ~ '^(person|event):[a-z0-9_-]{1,64}$'),
  author      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  before      jsonb,
  after       jsonb NOT NULL,
  state       text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'rejected', 'withdrawn')),
  decided_by  text,
  decided_at  timestamptz,
  comment     text CHECK (comment IS NULL OR length(comment) <= 500),
  notified_at timestamptz
);
-- One open proposal per key and author: a later save updates it in place.
CREATE UNIQUE INDEX IF NOT EXISTS revision_one_pending ON revision (key, author) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS revision_state ON revision (state, created_at);
-- When each notice last went out (owner digest of pending changes: at most one per 2 hours).
CREATE TABLE IF NOT EXISTS notice (
  kind     text PRIMARY KEY CHECK (kind ~ '^[a-z_]{1,40}$'),
  last_at  timestamptz NOT NULL
);
ALTER TABLE audit DROP CONSTRAINT IF EXISTS audit_action_check;
ALTER TABLE audit ADD CONSTRAINT audit_action_check CHECK (action IN ('draft.save', 'draft.undo', 'publish', 'media.upload',
  'review.propose', 'review.approve', 'review.reject', 'review.withdraw', 'media.purge', 'notice.sent'));
