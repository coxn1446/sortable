-- Drop legacy collaboration mode on lists (uniform personal + aggregate rankings).
-- Idempotent: safe if constraint/column already removed.
--
-- Public schema (typical local / production):
--   psql -d sortable -v ON_ERROR_STOP=1 -f server/db/migrations/20260507_drop_lists_collab_mode.sql
--
-- QA schema (same DB, schema qa):
--   psql -d sortable -v ON_ERROR_STOP=1 -c "SET search_path TO qa, public;" -f server/db/migrations/20260507_drop_lists_collab_mode.sql

ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_collab_mode_valid;
ALTER TABLE lists DROP COLUMN IF EXISTS collab_mode;
