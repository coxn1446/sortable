-- Case-insensitive unique usernames (one account per logical name).
-- Apply per schema, e.g.:
--   psql -d sortable -v ON_ERROR_STOP=1 -f server/db/migrations/20260507_users_username_unique_lower.sql
--   psql -d sortable -v ON_ERROR_STOP=1 -c "SET search_path TO qa, public;" -f server/db/migrations/20260507_users_username_unique_lower.sql
--
-- If this fails due to existing LOWER(username) duplicates, resolve duplicates manually first.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

DROP INDEX IF EXISTS idx_users_username_lower;

CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username));
