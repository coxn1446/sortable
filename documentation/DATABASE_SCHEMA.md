# Sortable - Database Schema Documentation

> **IMPORTANT**: This file MUST be updated whenever ANY database changes are made. Keep it synchronized with the actual database schema.

## Last Updated
2026-05-09 (`users.google_email`, `users.apple_email` — IdP emails for Log in Settings UI; migration `archive/migrations/06_oauth_provider_emails.sql`)

## Overview

PostgreSQL database storing user accounts, list metadata, list items, individual user comparisons, per-user adaptive-sort state, and a global aggregate Elo rating per item.

The same DDL is applied to two schemas:

| Schema | Used by |
| --- | --- |
| `public` | local dev and `sortable.net` (production) |
| `qa`     | `qa.sortable.net` (QA) |

Schema selection is controlled by the `ENVIRONMENT` env var (**`qa`** selects the `qa` schema, comparison is **case-insensitive** after trim; any other value including unset uses `public`); see [server/utils/dbSchema.js](../server/utils/dbSchema.js).

## Tables

### users

- **Purpose**: Stores user account information for all auth providers.
- **Columns**:
  - `user_id` (SERIAL PRIMARY KEY)
  - `username` (VARCHAR(64) NOT NULL) - **unique on `LOWER(username)`** (one account per logical name, case-insensitive)
  - `email` (VARCHAR(255) UNIQUE) - optional profile / account email; may differ from OAuth addresses below
  - **`google_email`** (VARCHAR(255)) - last email Google reported for this linked account (Log in Settings); NULL until OAuth supplies one
  - **`apple_email`** (VARCHAR(255)) - last email Apple reported (may be private relay); NULL when Apple withheld it
  - `password` (VARCHAR(255)) - bcrypt hash; NULL for OAuth-only users
  - `google_id` (VARCHAR(64) UNIQUE) - Google account subject; NULL for non-Google users
  - `apple_id` (VARCHAR(64) UNIQUE) - Apple account subject; NULL for non-Apple users
  - `profile_picture` (TEXT) - URL to profile image
  - **`privacy_policy_agreed`** (`BOOLEAN NOT NULL DEFAULT TRUE`) - `FALSE` after ops invalidates Privacy Policy ⇒ user sees re-consent modal on next login until acknowledged via **`POST /api/users/me/accept-policies`**
  - **`terms_agreed`** (`BOOLEAN NOT NULL DEFAULT TRUE`) — same workflow for Terms & Conditions
  - `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
  - `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Primary Key**: `user_id`
- **Indexes**:
  - `idx_users_username_lower` **UNIQUE** on `LOWER(username)` - case-insensitive uniqueness and login lookup
  - `idx_users_email_lower` on `LOWER(email)` WHERE email IS NOT NULL - case-insensitive email lookup
  - `idx_users_google_id` on `google_id` WHERE google_id IS NOT NULL
  - `idx_users_apple_id` on `apple_id` WHERE apple_id IS NOT NULL
- **Unique Constraints**: **`LOWER(username)`** (via index `idx_users_username_lower`), `email`, `google_id`, `apple_id`
- **Check Constraints**: `users_at_least_one_credential` - at least one of `password`, `google_id`, or `apple_id` must be non-null
- **Triggers**: `users_set_updated_at` (BEFORE UPDATE) - bumps `updated_at`
- **Last Modified**: 2026-05-09

### session

- **Purpose**: Express session storage managed by `connect-pg-simple`. When the logical schema is `qa`, the store is configured with `schemaName: 'qa'` so reads/writes target **`qa.session`** explicitly (in addition to pool `search_path`).
- **Columns**:
  - `sid` (VARCHAR NOT NULL) - session ID
  - `sess` (JSON NOT NULL) - serialized session payload
  - `expire` (TIMESTAMP(6) NOT NULL) - expiration timestamp
- **Primary Key**: `sid` (**required** — the store upserts with `ON CONFLICT (sid)`; Postgres error `42P10` means this PK is missing on that schema’s `session` table).
- **Indexes**: `idx_session_expire` on `expire`
- **Last Modified**: 2026-05-08

### lists

- **Purpose**: A user-created list whose items get ranked via pairwise comparisons.
- **Columns**:
  - `list_id` (SERIAL PRIMARY KEY)
  - `owner_user_id` (INTEGER NOT NULL) -> users(user_id) ON DELETE CASCADE
  - `title` (VARCHAR(200) NOT NULL)
  - `description` (TEXT)
  - `is_public` (BOOLEAN NOT NULL DEFAULT FALSE)
  - `share_slug` (VARCHAR(40) NOT NULL UNIQUE) - stable opaque slug (legacy **`/l/:slug`** redirects to **`/list/:list_id`**; canonical share URL is **`/list/:id`**)
  - `exclude_choice_label` (VARCHAR(50)) - optional custom label for the per-user exclude button on Compare; **`NULL`/blank ⇒ clients show default “Remove”**
  - `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
  - `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Primary Key**: `list_id`
- **Indexes**:
  - `idx_lists_owner` on `owner_user_id`
  - `idx_lists_public` on `is_public` WHERE is_public = TRUE
  - (`share_slug` is already UNIQUE)
- **Triggers**: `lists_set_updated_at` (BEFORE UPDATE)
- **Last Modified**: 2026-05-07

### user_list_item_exclusions

- **Purpose**: Tracks list items each user opted out of ranking for (“never seen”), without removing the row from `list_items`. Pairwise progression and caches are rebuilt for that user excluding these items (see comparisons replay + aggregates).
- **Columns**:
  - `list_id` (INTEGER NOT NULL) -> lists(list_id) ON DELETE CASCADE
  - `user_id` (INTEGER NOT NULL) -> users(user_id) ON DELETE CASCADE
  - `item_id` (INTEGER NOT NULL) -> list_items(item_id) ON DELETE CASCADE
  - `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Primary Key**: `(list_id, user_id, item_id)`
- **Indexes**: `idx_user_list_item_exclusions_list_user` on `(list_id, user_id)`
- **Last Modified**: 2026-05-07

### list_items

- **Purpose**: An item belonging to a list. Has no fixed ordering; rank is derived per-user / per-aggregate.
- **Columns**:
  - `item_id` (SERIAL PRIMARY KEY)
  - `list_id` (INTEGER NOT NULL) -> lists(list_id) ON DELETE CASCADE
  - `label` (VARCHAR(200) NOT NULL)
  - `image_url` (TEXT) - optional absolute URL for the option’s photo on pairwise **Choose** cards (`ChoiceCard`); cleared when **`NULL`**
  - `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Primary Key**: `item_id`
- **Indexes**: `idx_list_items_list` on `list_id`
- **Last Modified**: 2026-05-07

### list_contributors

- **Purpose**: Tracks who has contributed comparisons to a list. Owner is auto-inserted.
- **Columns**:
  - `list_id` (INTEGER NOT NULL) -> lists(list_id) ON DELETE CASCADE
  - `user_id` (INTEGER NOT NULL) -> users(user_id) ON DELETE CASCADE
  - `role` (VARCHAR(16) NOT NULL DEFAULT 'contributor') - `'owner' | 'contributor'`
  - `joined_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Primary Key**: `(list_id, user_id)`
- **Check Constraints**: `list_contributors_role_valid` - `role IN ('owner','contributor')`
- **Last Modified**: 2026-05-06

### comparisons

- **Purpose**: One row per pairwise pick the user made.
- **Columns**:
  - `comparison_id` (BIGSERIAL PRIMARY KEY)
  - `list_id` (INTEGER NOT NULL) -> lists(list_id) ON DELETE CASCADE
  - `user_id` (INTEGER NOT NULL) -> users(user_id) ON DELETE CASCADE
  - `winner_item_id` (INTEGER NOT NULL) -> list_items(item_id) ON DELETE CASCADE
  - `loser_item_id` (INTEGER NOT NULL) -> list_items(item_id) ON DELETE CASCADE
  - `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Primary Key**: `comparison_id`
- **Indexes**:
  - `idx_comparisons_list_user` on `(list_id, user_id, created_at DESC)`
- **Check Constraints**: `comparisons_distinct_items` - `winner_item_id <> loser_item_id`
- **Last Modified**: 2026-05-06

### user_item_ranks

- **Purpose**: Per-user personal ranking state. The adaptive insertion-sort engine writes here as items get placed.
- **Columns**:
  - `list_id` (INTEGER NOT NULL) -> lists(list_id) ON DELETE CASCADE
  - `user_id` (INTEGER NOT NULL) -> users(user_id) ON DELETE CASCADE
  - `item_id` (INTEGER NOT NULL) -> list_items(item_id) ON DELETE CASCADE
  - `position` (INTEGER NOT NULL) - 1-indexed rank within this user's list
  - `is_finalized` (BOOLEAN NOT NULL DEFAULT FALSE)
  - `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Primary Key**: `(list_id, user_id, item_id)`
- **Indexes**:
  - `idx_user_item_ranks_list_user_position` on `(list_id, user_id, position)`
- **Last Modified**: 2026-05-06

### user_sort_state

- **Purpose**: Tracks the in-flight binary-search insertion of the user's current pending item.
- **Columns**:
  - `list_id` (INTEGER NOT NULL) -> lists(list_id) ON DELETE CASCADE
  - `user_id` (INTEGER NOT NULL) -> users(user_id) ON DELETE CASCADE
  - `pending_item_id` (INTEGER) -> list_items(item_id) ON DELETE SET NULL
  - `lo_position` (INTEGER) - lower bound (inclusive) of where the pending item could land
  - `hi_position` (INTEGER) - upper bound (inclusive) of where the pending item could land
  - `is_complete` (BOOLEAN NOT NULL DEFAULT FALSE) - true when every item has been placed
  - `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Primary Key**: `(list_id, user_id)`
- **Last Modified**: 2026-05-06

### item_aggregate

- **Purpose**: Global Elo rating per item per list. Updated on every comparison for the community aggregate ranking view.
- **Columns**:
  - `list_id` (INTEGER NOT NULL) -> lists(list_id) ON DELETE CASCADE
  - `item_id` (INTEGER NOT NULL) -> list_items(item_id) ON DELETE CASCADE
  - `elo_rating` (NUMERIC(10,2) NOT NULL DEFAULT 1500)
  - `match_count` (INTEGER NOT NULL DEFAULT 0)
  - `win_count` (INTEGER NOT NULL DEFAULT 0)
  - `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Primary Key**: `(list_id, item_id)`
- **Indexes**:
  - `idx_item_aggregate_list_rating` on `(list_id, elo_rating DESC)`
- **Last Modified**: 2026-05-06

---

## Functions

### update_updated_at_column()
- **Purpose**: Generic trigger function that sets `NEW.updated_at = NOW()`.
- **Returns**: TRIGGER
- **Last Modified**: 2026-05-06

---

## Triggers

| Trigger | Table | Event | Timing | Function |
| --- | --- | --- | --- | --- |
| `users_set_updated_at` | users | UPDATE | BEFORE | update_updated_at_column |
| `lists_set_updated_at` | lists | UPDATE | BEFORE | update_updated_at_column |
| `user_item_ranks_set_updated_at` | user_item_ranks | UPDATE | BEFORE | update_updated_at_column |
| `user_sort_state_set_updated_at` | user_sort_state | UPDATE | BEFORE | update_updated_at_column |
| `item_aggregate_set_updated_at` | item_aggregate | UPDATE | BEFORE | update_updated_at_column |

---

## Migration History

### 2026-05-08 - `session` PRIMARY KEY per schema (QA login / register)

- **Description**: Older **Initial Setup SQL** checked `pg_constraint` by **`conname = 'session_pkey'` only**, so after **`public.session`** already had a primary key, applying the same script to **`qa`** skipped adding **`qa.session`**’s PK. **`connect-pg-simple`** then failed with *there is no unique or exclusion constraint matching the ON CONFLICT specification* (`42P10`) on login/register when saving the session.
- **Tables altered**: `session` — add **`PRIMARY KEY (sid)`** when missing (per schema).
- **SQL**: [server/db/migrations/04_session_primary_key_fix.sql](../server/db/migrations/04_session_primary_key_fix.sql) — run with `search_path` targeting each affected schema (at minimum **`qa`**).
- **Breaking Changes**: None.

### 2026-05-07 - Option photo URLs (API; schema unchanged)

- **Description**: Owners set or clear **`list_items.image_url`** via **`PATCH /api/lists/:id/items/:itemId`** (optional **`label`**, optional **`image_url`** — trimmed string; **`null`** or blank clears). Pairwise **Choose** reads **`image_url`** when rendering **`ChoiceCard`**. No DDL change to **`list_items`** beyond what shipped with [2026-05-06 lists migration](#2026-05-06---lists-items-comparisons-rankings).
- **Breaking Changes**: None.

### 2026-05-07 - Exclude-from-ranking (list label + per-user exclusions)

- **Description**: Optional **`lists.exclude_choice_label`** (≤50 chars) shown on pairwise Compare instead of default “Remove”. **`user_list_item_exclusions`** stores each viewer’s opted-out **`item_id`**s; excluding deletes that user’s comparisons involving the item and replays adaptive state on eligible items only; **`item_aggregate`** for the whole list is rebuilt once so aggregate Elo matches remaining comparisons globally.
- **Tables altered**: `lists` — add nullable `exclude_choice_label VARCHAR(50)`.
- **Tables created**: **`user_list_item_exclusions`** (PK `(list_id, user_id, item_id)`), index **`idx_user_list_item_exclusions_list_user`** on `(list_id, user_id)`.
- **SQL**: [server/db/migrations/03_exclude_choice_ranking.sql](../server/db/migrations/03_exclude_choice_ranking.sql) — apply to each logical schema (`public`, `qa`, etc.).
- **Breaking Changes**: None; absent column ⇒ `NULL`; new API `POST /api/lists/:id/my-ranking/exclude` is additive.

### 2026-05-07 - Case-insensitive unique usernames
- **Description**: Enforce at most one user per username ignoring case (`Ada` and `ada` cannot both exist). Replaces the column `UNIQUE` on `username` with a **unique index** on `LOWER(username)`.
- **Tables altered**: `users` — drop `users_username_key` if present; replace non-unique `idx_users_username_lower` with **unique** `idx_users_username_lower` on `LOWER(username)`.
- **SQL**: [server/db/migrations/20260507_users_username_unique_lower.sql](../server/db/migrations/20260507_users_username_unique_lower.sql) — run against each schema (`public`, `qa`, etc.).
- **Breaking Changes**: None for API shape; registration and profile updates return **409** when a username collides case-insensitively with another account.
- **Rollback** (only if no reliance on case-insensitive uniqueness):
  ```sql
  DROP INDEX IF EXISTS idx_users_username_lower;
  CREATE INDEX idx_users_username_lower ON users (LOWER(username));
  ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  ```

### 2026-05-07 - Drop list collaboration mode column
- **Description**: Remove `collab_mode`; all lists use per-user adaptive rankings plus a shared aggregate Elo table. Visibility is controlled only by `is_public` (Discover vs link-only sharing).
- **Tables altered**: `lists` — drop check constraint `lists_collab_mode_valid`, drop column `collab_mode`.
- **SQL**: [server/db/migrations/20260507_drop_lists_collab_mode.sql](../server/db/migrations/20260507_drop_lists_collab_mode.sql) — run against each schema (`public`, `qa`, etc.); see file header for example `psql` invocations.
- **Breaking Changes**: API responses and list rows no longer include `collab_mode`; `POST /api/lists` and `PATCH /api/lists/:id` no longer accept `collab_mode`.
- **Rollback** (only if no code expecting the absence of the column — restore column then backfill):
  ```sql
  ALTER TABLE lists ADD COLUMN collab_mode VARCHAR(16) NOT NULL DEFAULT 'aggregate';
  ALTER TABLE lists ADD CONSTRAINT lists_collab_mode_valid CHECK (collab_mode IN ('aggregate','shared'));
  ```

### 2026-05-06 - Lists, items, comparisons, rankings
- **Description**: Add the data model for the pairwise-ranking product.
- **Tables Created**: `lists`, `list_items`, `list_contributors`, `comparisons`, `user_item_ranks`, `user_sort_state`, `item_aggregate`
- **Triggers Created**: `lists_set_updated_at`, `user_item_ranks_set_updated_at`, `user_sort_state_set_updated_at`, `item_aggregate_set_updated_at`
- **Indexes Created**: `idx_lists_owner`, `idx_lists_public`, `idx_list_items_list`, `idx_comparisons_list_user`, `idx_user_item_ranks_list_user_position`, `idx_item_aggregate_list_rating`
- **Breaking Changes**: None.
- **Rollback**:
  ```sql
  DROP TABLE item_aggregate, user_sort_state, user_item_ranks, comparisons,
             list_contributors, list_items, lists CASCADE;
  ```

### 2026-05-06 - Initial schema
- **Description**: Initial users + session tables shipped with the app shell.
- **Tables Created**: `users`, `session`
- **Functions Created**: `update_updated_at_column`
- **Triggers Created**: `users_set_updated_at`
- **Indexes Created**: `idx_users_username_lower`, `idx_users_email_lower`, `idx_users_google_id`, `idx_users_apple_id`, `idx_session_expire`
- **Rollback**: `DROP TABLE users CASCADE; DROP TABLE session CASCADE; DROP FUNCTION update_updated_at_column();`

---

## Notes

- We do not run automated migration runners; schema changes are applied manually. Use `psql -f scripts/init.sql` for fresh databases. Incremental changes live under [server/db/migrations/](../server/db/migrations/) and are applied with `psql -f` per file (see each migration’s header comments).
- **`GET /api/lists/me`** returns list rows augmented with **`my_rank_complete`** (derived from `user_sort_state.is_complete` for the current user and each list—not a persisted column).
- Production runs against the `public` schema; QA runs against the `qa` schema; the same DDL applies to both.
- Aggregate Elo (`item_aggregate`) is kept up-to-date on every recorded comparison so the aggregate ranking view stays cheap to compute.
- A user's `comparisons` rows are the source of truth; `user_item_ranks` and `user_sort_state` are derived caches that can be rebuilt by replaying the comparisons.

---

## Initial Setup SQL

The canonical setup SQL lives in [scripts/init.sql](../scripts/init.sql). Run it twice to seed both schemas:

```bash
# Local dev (public schema)
psql -d sortable -f scripts/init.sql

# QA schema (run this in addition to the public seed)
psql -d sortable -c "CREATE SCHEMA IF NOT EXISTS qa;"
psql -d sortable -c "SET search_path TO qa, public;" -f scripts/init.sql
```

The contents of `scripts/init.sql` are reproduced below for reference; they MUST stay in sync with this document.

```sql
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
  profile_picture  TEXT,
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

-- ---- user_list_item_exclusions ----
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
```
