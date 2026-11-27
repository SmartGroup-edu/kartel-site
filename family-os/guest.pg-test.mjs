// bus 176 P4 on real Postgres: the guest tables survive a re-apply of schema.sql, one open grant per address (an
// expired one is closed first), revoke is audited, the log is append-only (no UPDATE by trigger, no DELETE for kfo_app),
// and the runner's 12-month purge removes old log rows and then the long-ended grant. Needs a disposable Postgres
// (drops the public schema):  FAMILY_OS_TEST_DATABASE_URL=postgres://… npm run test:pg
// Synthetic addresses only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { pgStore } from "./store.mjs";

const URL_ = process.env.FAMILY_OS_TEST_DATABASE_URL ?? process.env.npm_config_pg_url;
if (!URL_) throw new Error("FAMILY_OS_TEST_DATABASE_URL is required (a disposable Postgres)");
const pool = new pg.Pool({ connectionString: URL_, max: 4 });
let store, sql;
const A = "admin@example.test", EM = "accountant@example.test";
before(async () => {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(sql);
  await pool.query(sql); // runs on every start and runner tick
  store = pgStore(pool);
});
after(() => pool.end());

test("grant: one open per address; an expired one is closed before a new invite; revoke is audited", async () => {
  const g1 = randomUUID();
  await store.createGuest({ id: g1, email: EM, label: "Бухгалтер", sections: ["calendar", "review"], until: "2026-12-01" }, "2026-11-27", A);
  await assert.rejects(store.createGuest({ id: randomUUID(), email: EM, label: "x", sections: ["calendar"], until: "2026-12-10" }, "2026-11-27", A), (e) => e.code === "23505");
  assert.deepEqual(await store.guestById(g1).then((g) => [g.until, g.sections, g.revoked_at]), ["2026-12-01", ["calendar", "review"], null]);
  const g2 = randomUUID();
  await store.createGuest({ id: g2, email: EM, label: "Бухгалтер", sections: ["kodeks"], until: "2027-01-31" }, "2026-12-02", A);
  assert.equal((await pool.query("SELECT revoked_by FROM guest_grant WHERE id = $1", [g1])).rows[0].revoked_by, "system:expired");
  assert.equal((await store.guestByEmail(EM)).id, g2);
  assert.equal(await store.revokeGuest(g2, A), true);
  assert.equal(await store.revokeGuest(g2, A), false);
  assert.equal(await store.guestByEmail(EM), null);
  const acts = (await pool.query("SELECT action FROM audit WHERE entity LIKE 'guest:%' ORDER BY id")).rows.map((r) => r.action);
  assert.deepEqual(acts, ["guest.invite", "guest.invite", "guest.revoke"]);
  await assert.rejects(pool.query("INSERT INTO guest_grant (id, email, label, sections, until, created_by) VALUES ($1, 'x@y.test', 'x', ARRAY['people'], '2027-01-01', 'a')", [randomUUID()]), /check/i, "sections outside the allow-list are refused by the database too");
});

test("log: rows by section and route; append-only; listGuests counts them", async () => {
  const g = (await pool.query("SELECT id FROM guest_grant ORDER BY created_at LIMIT 1")).rows[0].id;
  await store.logGuest({ guest_id: g, action: "signin", section: null, route: "signin" });
  await store.logGuest({ guest_id: g, action: "read", section: "calendar", route: "/calendar" });
  assert.deepEqual((await store.guestLog(g)).map((x) => [x.action, x.section, x.route]), [["read", "calendar", "/calendar"], ["signin", null, "signin"]]);
  await assert.rejects(pool.query("UPDATE guest_access_log SET route = 'x'"), /append-only/);
  await assert.rejects(store.logGuest({ guest_id: g, action: "write", section: "calendar", route: "/calendar" }), /check/i);
  const row = (await store.listGuests()).find((x) => x.id === g);
  assert.equal(row.reads_30d, 1); assert.ok(row.last_signin instanceof Date);
});

test("privileges: kfo_app inserts grants and log rows, sets only revoked_*, and deletes neither", async () => {
  await pool.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kfo_app') THEN CREATE ROLE kfo_app; END IF; END $$");
  await pool.query(await readFile(new URL("./roles.sql", import.meta.url), "utf8"));
  const has = async (t, p) => (await pool.query("SELECT has_table_privilege('kfo_app', $1, $2) AS ok", [t, p])).rows[0].ok;
  const col = async (t, c) => (await pool.query("SELECT has_column_privilege('kfo_app', $1, $2, 'UPDATE') AS ok", [t, c])).rows[0].ok;
  for (const t of ["guest_grant", "guest_access_log"]) { assert.equal(await has(t, "INSERT"), true, t); assert.equal(await has(t, "DELETE"), false, t); }
  assert.equal(await col("guest_grant", "revoked_at"), true);
  assert.equal(await col("guest_grant", "sections"), false);
  assert.equal(await col("guest_grant", "until"), false);
  assert.equal(await has("guest_access_log", "UPDATE"), false);
});

test("runner purge (owner): log rows older than 12 months, then a grant that ended more than 12 months ago", async () => {
  const old = randomUUID();
  await pool.query("INSERT INTO guest_grant (id, email, label, sections, until, created_by, revoked_at, revoked_by) VALUES ($1, 'old@example.test', 'old', ARRAY['calendar'], '2025-06-01', $2, '2025-05-01', $2)", [old, A]);
  await pool.query("INSERT INTO guest_access_log (guest_id, action, section, route, at) VALUES ($1, 'read', 'calendar', '/calendar', now() - interval '13 months')", [old]);
  const runner = await readFile(new URL("./runner.mjs", import.meta.url), "utf8");
  const purge = [...runner.matchAll(/await pool\.query\((["`])(DELETE FROM guest_[\s\S]*?)\1\)/g)].map((m) => m[2]);
  assert.equal(purge.length, 2, "the runner carries both statements");
  for (const s of purge) await pool.query(s);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM guest_grant WHERE id = $1", [old])).rows[0].n, 0, "the long-ended grant went with its log");
  assert.ok((await pool.query("SELECT count(*)::int AS n FROM guest_access_log")).rows[0].n >= 2, "this year's rows stay");
  assert.ok((await pool.query("SELECT count(*)::int AS n FROM guest_grant")).rows[0].n >= 2, "recent grants stay");
});
