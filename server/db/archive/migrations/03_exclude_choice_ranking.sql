-- List-level exclude button label + per-user item exclusions from personal ranking.
-- Apply per schema, e.g.:
--   psql -d sortable -v ON_ERROR_STOP=1 -f server/db/migrations/03_exclude_choice_ranking.sql
--   psql -d sortable -v ON_ERROR_STOP=1 -c "SET search_path TO qa, public;" -f server/db/migrations/03_exclude_choice_ranking.sql

ALTER TABLE lists ADD COLUMN IF NOT EXISTS exclude_choice_label VARCHAR(50);

CREATE TABLE IF NOT EXISTS user_list_item_exclusions (
  list_id    INTEGER NOT NULL REFERENCES lists(list_id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES list_items(item_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_list_item_exclusions_list_user
  ON user_list_item_exclusions (list_id, user_id);
