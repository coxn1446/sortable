-- Sortable database initial setup.
-- Idempotent: safe to re-run.
-- Run against the public schema for prod / local dev:
--   psql -d sortable -f scripts/init.sql
-- Run against the qa schema for QA:
--   psql -d sortable -c "CREATE SCHEMA IF NOT EXISTS qa;"
--   psql -d sortable -v "search_path=qa,public" -f scripts/init.sql
-- Keep this file in sync with documentation/DATABASE_SCHEMA.md.

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- users ----
CREATE TABLE IF NOT EXISTS users (
  user_id          SERIAL PRIMARY KEY,
  username         VARCHAR(64)  NOT NULL,
  email            VARCHAR(255) UNIQUE,
  google_email     VARCHAR(255),
  apple_email      VARCHAR(255),
  password         VARCHAR(255),
  google_id        VARCHAR(64)  UNIQUE,
  apple_id         VARCHAR(64)  UNIQUE,
  profile_picture           TEXT,
  privacy_policy_agreed     BOOLEAN NOT NULL DEFAULT TRUE,
  terms_agreed              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_at_least_one_credential
    CHECK (password IS NOT NULL OR google_id IS NOT NULL OR apple_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email_lower    ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_id      ON users (google_id)     WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_apple_id       ON users (apple_id)      WHERE apple_id IS NOT NULL;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- session (connect-pg-simple) ----
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR      NOT NULL COLLATE "default",
  sess   JSON         NOT NULL,
  expire TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);
-- PK must exist per session table: connect-pg-simple uses ON CONFLICT (sid). Do not test conname
-- globally — public.session's session_pkey would hide missing PK on qa.session.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.contype = 'p'
      AND t.oid = 'session'::regclass
  ) THEN
    ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);

-- ---- lists ----
CREATE TABLE IF NOT EXISTS lists (
  list_id               SERIAL PRIMARY KEY,
  owner_user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title                 VARCHAR(200) NOT NULL,
  description           TEXT,
  is_public             BOOLEAN NOT NULL DEFAULT FALSE,
  share_slug            VARCHAR(40) NOT NULL UNIQUE,
  exclude_choice_label  VARCHAR(50),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lists_owner ON lists (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lists_public ON lists (is_public) WHERE is_public = TRUE;
DROP TRIGGER IF EXISTS lists_set_updated_at ON lists;
CREATE TRIGGER lists_set_updated_at BEFORE UPDATE ON lists
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- list_items ----
CREATE TABLE IF NOT EXISTS list_items (
  item_id     SERIAL PRIMARY KEY,
  list_id     INTEGER NOT NULL REFERENCES lists(list_id) ON DELETE CASCADE,
  label       VARCHAR(200) NOT NULL,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items (list_id);

-- ---- list_contributors ----
CREATE TABLE IF NOT EXISTS list_contributors (
  list_id    INTEGER NOT NULL REFERENCES lists(list_id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role       VARCHAR(16) NOT NULL DEFAULT 'contributor',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, user_id),
  CONSTRAINT list_contributors_role_valid CHECK (role IN ('owner','contributor'))
);

-- ---- comparisons ----
CREATE TABLE IF NOT EXISTS comparisons (
  comparison_id   BIGSERIAL PRIMARY KEY,
  list_id         INTEGER NOT NULL REFERENCES lists(list_id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  winner_item_id  INTEGER NOT NULL REFERENCES list_items(item_id) ON DELETE CASCADE,
  loser_item_id   INTEGER NOT NULL REFERENCES list_items(item_id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comparisons_distinct_items CHECK (winner_item_id <> loser_item_id)
);
CREATE INDEX IF NOT EXISTS idx_comparisons_list_user ON comparisons (list_id, user_id, created_at DESC);

-- ---- user_list_item_exclusions (per-user opted-out options; not deleted from list) ----
CREATE TABLE IF NOT EXISTS user_list_item_exclusions (
  list_id    INTEGER NOT NULL REFERENCES lists(list_id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES list_items(item_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_user_list_item_exclusions_list_user
  ON user_list_item_exclusions (list_id, user_id);

-- ---- user_item_ranks ----
CREATE TABLE IF NOT EXISTS user_item_ranks (
  list_id      INTEGER NOT NULL REFERENCES lists(list_id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_id      INTEGER NOT NULL REFERENCES list_items(item_id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_user_item_ranks_list_user_position
  ON user_item_ranks (list_id, user_id, position);
DROP TRIGGER IF EXISTS user_item_ranks_set_updated_at ON user_item_ranks;
CREATE TRIGGER user_item_ranks_set_updated_at BEFORE UPDATE ON user_item_ranks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- user_sort_state ----
CREATE TABLE IF NOT EXISTS user_sort_state (
  list_id          INTEGER NOT NULL REFERENCES lists(list_id) ON DELETE CASCADE,
  user_id          INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  pending_item_id  INTEGER REFERENCES list_items(item_id) ON DELETE SET NULL,
  lo_position      INTEGER,
  hi_position      INTEGER,
  is_complete      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, user_id)
);
DROP TRIGGER IF EXISTS user_sort_state_set_updated_at ON user_sort_state;
CREATE TRIGGER user_sort_state_set_updated_at BEFORE UPDATE ON user_sort_state
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- item_aggregate (Elo) ----
CREATE TABLE IF NOT EXISTS item_aggregate (
  list_id      INTEGER NOT NULL REFERENCES lists(list_id) ON DELETE CASCADE,
  item_id      INTEGER NOT NULL REFERENCES list_items(item_id) ON DELETE CASCADE,
  elo_rating   NUMERIC(10,2) NOT NULL DEFAULT 1500,
  match_count  INTEGER NOT NULL DEFAULT 0,
  win_count    INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_item_aggregate_list_rating
  ON item_aggregate (list_id, elo_rating DESC);
DROP TRIGGER IF EXISTS item_aggregate_set_updated_at ON item_aggregate;
CREATE TRIGGER item_aggregate_set_updated_at BEFORE UPDATE ON item_aggregate
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
