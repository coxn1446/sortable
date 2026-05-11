-- Policy acknowledgment flags — set FALSE in ops to prompt re-consent on next login.
-- Apply to both public and qa as needed:
--   psql -d sortable -v ON_ERROR_STOP=1 -f server/db/archive/migrations/05_user_policy_consent.sql
--   psql -d sortable -v ON_ERROR_STOP=1 -c "SET search_path TO qa, public;" -f server/db/archive/migrations/05_user_policy_consent.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_policy_agreed BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_agreed BOOLEAN NOT NULL DEFAULT TRUE;
