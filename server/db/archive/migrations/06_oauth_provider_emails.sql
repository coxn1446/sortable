-- Store IdP emails for UI (Log in Settings) separately from profile `email`.
-- Idempotent; run per schema (public, qa, …).

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_email VARCHAR(255);
