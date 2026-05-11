-- Ensure session.sid has a PRIMARY KEY (required by connect-pg-simple INSERT ... ON CONFLICT (sid)).
--
-- If qa.session was created after public.session, older init.sql skipped ADD CONSTRAINT because it
-- looked up pg_constraint by conname only (public already had session_pkey).
--
-- Apply per schema, e.g. QA only:
--   psql -d sortable -v ON_ERROR_STOP=1 -c "SET search_path TO qa, public;" -f server/db/migrations/04_session_primary_key_fix.sql
--
-- Idempotent: no-op when this schema's session table already has a primary key.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.contype = 'p'
      AND t.oid = 'session'::regclass
  ) THEN
    ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
  END IF;
END $$;
