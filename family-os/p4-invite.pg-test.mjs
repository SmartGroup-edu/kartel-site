// bus 172 P4 on real Postgres: cancel and re-open an invitation (the ON CONFLICT … WHERE upsert), the runner's queue
// skips a cancelled one, the onboarding mark is set once, the one-time backfill marks only earlier sign-ins, and
// kfo_app holds exactly the column privileges these need. Needs a disposable Postgres (drops the public schema):
//   FAMILY_OS_TEST_DATABASE_URL=postgres://… npm run test:pg
// Synthetic people only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { pgStore } from "./store.mjs";

const URL_ = process.env.FAMILY_OS_TEST_DATABASE_URL ?? process.env.npm_config_pg_url;
if (!URL_) throw new Error("FAMILY_OS_TEST_DATABASE_URL is required (a disposable Postgres)");
const pool = new pg.Pool({ connectionString: URL_, max: 4 });
let store, sql, P;
before(async () => {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(sql);
  store = pgStore(pool);
  P = await store.createPerson({ email: "anna@example.test", name_en: "Anna QA", name_ru: "Анна QA", kind: "adult" }, "admin@example.test");
});
after(() => pool.end());

test("backfill: the first apply marked nobody (no sign-ins yet); a re-apply never marks a later sign-in", async () => {
  await store.noteSignIn("anna@example.test", "2026-11-26");
  await pool.query(sql); // runs on every start and runner tick
  assert.deepEqual(await store.onboardedOn("anna@example.test"), { on: null }, "the backfill ran once, before this row existed");
  assert.equal(await store.onboardedOn("nobody@example.test"), null);
  assert.equal(await store.markOnboarded("anna@example.test", "2026-11-26"), true);
  assert.equal(await store.markOnboarded("anna@example.test", "2026-11-27"), false, "set once");
  assert.deepEqual(await store.onboardedOn("anna@example.test"), { on: "2026-11-26" });
  assert.equal(await store.markOnboarded("late@example.test", "2026-11-26"), true, "no sign-in row yet: the mark creates it");
  await store.noteSignIn("late@example.test", "2026-11-26");
  assert.deepEqual(await store.onboardedOn("late@example.test"), { on: "2026-11-26" }, "the late sign-in note keeps the mark");
  const a = (await pool.query("SELECT action, entity FROM audit WHERE action = 'onboarding.done'")).rows;
  assert.deepEqual(a, [{ action: "onboarding.done", entity: "signin:self" }, { action: "onboarding.done", entity: "signin:self" }]);
});

test("invite: request → cancel → the queue is empty → re-request the same day re-opens it without a second letter; audited", async () => {
  assert.equal(await store.requestInvite(P, "2026-11-26", "admin@example.test"), true);
  assert.equal(await store.requestInvite(P, "2026-11-26", "admin@example.test"), false, "one a day");
  await pool.query("UPDATE invite_request SET sent_at = now() WHERE person_id = $1", [P]);
  assert.equal(await store.cancelInvite(P, "admin@example.test"), true);
  assert.equal(await store.cancelInvite(P, "admin@example.test"), false);
  assert.equal((await store.pendingInvites("2026-11-20")).length, 0);
  assert.equal((await store.lastInvites())[0].cancelled_at instanceof Date, true);
  assert.equal(await store.requestInvite(P, "2026-11-26", "admin@example.test"), true, "re-opened");
  const row = (await pool.query("SELECT sent_at IS NOT NULL AS sent, cancelled_at FROM invite_request WHERE person_id = $1", [P])).rows;
  assert.deepEqual(row, [{ sent: true, cancelled_at: null }], "the letter that already went today stays sent");
  assert.equal((await store.pendingInvites("2026-11-20")).length, 0, "cancel → invite never sends a second letter the same day");
  assert.equal(await store.invitesRequestedBy("admin@example.test", "2026-11-26"), 1);
  const acts = (await pool.query("SELECT action FROM audit WHERE entity = $1 AND action LIKE 'invite.%' ORDER BY id", [`person:${P}`])).rows.map((r) => r.action);
  assert.deepEqual(acts, ["invite.request", "invite.cancel", "invite.request"]);
});

test("privileges: kfo_app may write exactly the new columns, and still delete neither table", async () => {
  await pool.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kfo_app') THEN CREATE ROLE kfo_app; END IF; END $$");
  await pool.query(await readFile(new URL("./roles.sql", import.meta.url), "utf8"));
  const col = async (t, c) => (await pool.query("SELECT has_column_privilege('kfo_app', $1, $2, 'UPDATE') AS ok", [t, c])).rows[0].ok;
  for (const c of ["sent_at", "cancelled_at", "cancelled_by", "requested_by", "requested_at"]) assert.equal(await col("invite_request", c), true, c);
  assert.equal(await col("invite_request", "person_id"), false);
  assert.equal(await col("signin_seen", "onboarded_on"), true);
  assert.equal(await col("signin_seen", "first_on"), false);
  for (const t of ["invite_request", "signin_seen"]) assert.equal((await pool.query("SELECT has_table_privilege('kfo_app', $1, 'DELETE') AS ok", [t])).rows[0].ok, false, t);
});
