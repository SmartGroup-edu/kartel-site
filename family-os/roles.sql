-- Least-privilege role for request handling (bus 72 carry-over). Applied by the OWNER connection on
-- every start, after schema.sql. The owner runs migrations; requests run as kfo_app, which:
--   · may only SELECT and INSERT on access_log and audit (append-only by privilege, not just by trigger);
--   · has no DELETE and no TRUNCATE anywhere; drill_canary and schema_migration are read-only;
--   · gets nothing on a table added later until it is listed here (fails closed).
-- The role and its password are created in server.mjs (the password comes from the environment).
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO kfo_app', current_database()); END $$;
GRANT USAGE ON SCHEMA public TO kfo_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM kfo_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM kfo_app;
GRANT SELECT, INSERT, UPDATE ON person, guardian_grant, care_note, document, document_file, routine TO kfo_app;
GRANT SELECT, INSERT ON access_log, audit, routine_check TO kfo_app;
GRANT SELECT ON drill_canary, schema_migration TO kfo_app;
GRANT USAGE ON SEQUENCE access_log_id_seq, audit_id_seq, routine_check_id_seq TO kfo_app;
