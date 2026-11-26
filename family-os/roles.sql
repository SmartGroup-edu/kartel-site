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
-- Stage 3a: the event bus is append-only for kfo_app too; rules are switched by the admin (UPDATE only);
-- the send ledger is written by the runner (owner), read here for the admin's counts.
GRANT SELECT, INSERT ON event, rotation_check TO kfo_app;
GRANT SELECT, UPDATE ON rule TO kfo_app;
GRANT SELECT ON rule_run TO kfo_app;
GRANT SELECT, INSERT, UPDATE ON notification_pref, pause, rotation TO kfo_app;
GRANT USAGE ON SEQUENCE event_id_seq, rotation_check_id_seq TO kfo_app;
-- Stage 3b
GRANT SELECT, INSERT, UPDATE ON council_meeting, council_task, goal, goal_checkin, family_event, ics_token TO kfo_app;
GRANT USAGE ON SEQUENCE goal_checkin_id_seq TO kfo_app;
-- Stage 3c
GRANT SELECT, INSERT, UPDATE ON task_template, sprint_goal, task, plan_approval TO kfo_app;
-- Stage 3d: Кодекс versions are insert-only for kfo_app (append-only by privilege and by trigger).
GRANT SELECT, INSERT ON kodeks_version, recognition TO kfo_app;
GRANT SELECT, INSERT, UPDATE ON principle_week TO kfo_app;
-- 3d-2: sign-in dates (upsert) and invite requests (the runner marks sent_at). No DELETE on either.
GRANT SELECT, INSERT, UPDATE (last_on) ON signin_seen TO kfo_app;
GRANT SELECT, INSERT, UPDATE (sent_at) ON invite_request TO kfo_app;
GRANT USAGE ON SEQUENCE invite_request_id_seq TO kfo_app;
-- 3d-2 review photo: rows are never deleted by the app; the file is removed and deleted_at set.
GRANT SELECT, INSERT, UPDATE (deleted_at) ON task_photo TO kfo_app;
-- Passkeys (bus 98/100): rows are never deleted by the app (revocation sets revoked_at); challenges are single-use
-- and therefore deletable; attempts and notices are append-only for the app.
GRANT SELECT, INSERT ON passkey_user TO kfo_app;
GRANT SELECT, INSERT, UPDATE (counter, last_used_at, backed_up, label, revoked_at, revoked_by, flagged_at) ON passkey TO kfo_app;
GRANT SELECT, INSERT, DELETE ON passkey_challenge TO kfo_app;
GRANT SELECT, INSERT ON passkey_attempt TO kfo_app;
GRANT SELECT, INSERT, UPDATE (sent_at) ON security_notice TO kfo_app;
GRANT USAGE ON SEQUENCE passkey_attempt_id_seq, security_notice_id_seq TO kfo_app;
-- Go-live R1: session cut-offs are upserted, never deleted by the app.
GRANT SELECT, INSERT, UPDATE (cut_at, cut_by) ON session_cutoff TO kfo_app;
-- 3e-1: settings and ticks are upserted; an evening answer is the author's — they may delete it.
GRANT SELECT, INSERT, UPDATE (ticks_on, evening_q_on, updated_at) ON health_pref TO kfo_app;
GRANT SELECT, INSERT, UPDATE (done) ON health_tick TO kfo_app;
GRANT SELECT, INSERT, UPDATE (wrapped_key, text_ct), DELETE ON evening_answer TO kfo_app;
-- 3e-2: the person's own data — they may change and delete it at any time (export + delete by the owner of the data).
GRANT SELECT, INSERT, UPDATE (body_on), DELETE ON body_pref TO kfo_app;
GRANT SELECT, INSERT, UPDATE (wrapped_key, value_ct), DELETE ON body_log TO kfo_app;
GRANT SELECT, INSERT, UPDATE (wrapped_key, goal_ct), DELETE ON body_goal TO kfo_app;
-- QA-156 M3: the person key is created once and deleted with the data; never changed by the app.
GRANT SELECT, INSERT, DELETE ON body_key TO kfo_app;
-- bus 165: pending sign-ins are never deleted by the app (the runner purges expired rows as the owner).
GRANT SELECT, INSERT, UPDATE (attempts, superseded_at, consumed_at) ON signin_pending TO kfo_app;
