-- Proxy performs an optimistic role/status lookup through PostgREST using the
-- server-only service role. Keep access limited to the two required tables.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO service_role';
    EXECUTE 'GRANT SELECT ON TABLE public."User", public."Organization" TO service_role';
  END IF;
END $$;
