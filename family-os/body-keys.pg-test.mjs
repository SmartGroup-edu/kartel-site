// QA-156 M3 on a real Postgres: legacy /body rows (row keys wrapped by the master key) are re-wrapped under a
// per-person key by the start-up migration, still decrypt to the same values, and the "down" direction restores
// master-key wrapping. Idempotent. The kfo_app role may create and delete a person key, never change it.
// Needs a disposable Postgres (drops the public schema): npm run test:pg --pg-url=postgres://…  Synthetic rows only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { seal, open, newDataKey } from "./crypto.mjs";
import { rewrapBodyRows, rowKey, openBodyKey, PK_PREFIX } from "./body-keys.mjs";

const URL_ = process.env.FAMILY_OS_TEST_DATABASE_URL ?? process.env.npm_config_pg_url;
if (!URL_) throw new Error("FAMILY_OS_TEST_DATABASE_URL is required (a disposable Postgres)");
const pool = new pg.Pool({ connectionString: URL_, max: 2 });
const KEK = randomBytes(32), person = randomUUID(), rowId = randomUUID();
const sealLegacy = (scope, id, obj) => { const { dek, wrapped } = newDataKey(KEK, scope, id); return { wrapped, ct: seal(dek, Buffer.from(JSON.stringify(obj)), `${scope}:${id}`) }; };
const read = async () => {
  const r = (await pool.query("SELECT id, wrapped_key, value_ct FROM body_log WHERE id = $1", [rowId])).rows[0];
  const w = (await pool.query("SELECT wrapped_key FROM body_key WHERE person_id = $1", [person])).rows[0]?.wrapped_key;
  const pk = w ? openBodyKey(KEK, w, person) : null;
  return { wrapped: r.wrapped_key, value: JSON.parse(open(rowKey(KEK, pk, r.wrapped_key, "body", r.id), r.value_ct, `body:${r.id}`).toString()) };
};

before(async () => {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  await pool.query("INSERT INTO person (id, email, name_en, name_ru, kind, created_by) VALUES ($1, 'qa@example.test', 'QA', 'QA', 'adult', 'admin:qa@example.test')", [person]);
  const l = sealLegacy("body", rowId, { weight_kg: 71.4 }), g = sealLegacy("body-goal", person, { weight_kg: 70 });
  await pool.query("INSERT INTO body_log (id, person_id, on_date, wrapped_key, value_ct) VALUES ($1, $2, '2026-11-24', $3, $4)", [rowId, person, l.wrapped, l.ct]);
  await pool.query("INSERT INTO body_goal (person_id, wrapped_key, goal_ct) VALUES ($1, $2, $3)", [person, g.wrapped, g.ct]);
});
after(() => pool.end());

test("up: legacy rows move under a new person key, values unchanged; a second run does nothing", async () => {
  assert.ok(!(await read()).wrapped.startsWith(PK_PREFIX));
  const c = await pool.connect();
  try {
    assert.deepEqual(await rewrapBodyRows(c, KEK, "up"), { rows: 2, keys: 1 });
    assert.deepEqual(await rewrapBodyRows(c, KEK, "up"), { rows: 0, keys: 0 }, "idempotent");
  } finally { c.release(); }
  const r = await read();
  assert.ok(r.wrapped.startsWith(PK_PREFIX)); assert.deepEqual(r.value, { weight_kg: 71.4 });
  assert.throws(() => rowKey(KEK, null, r.wrapped, "body", rowId), /body key destroyed/, "without the person key the row is shut");
});

test("down: back under the master key (reversible), values unchanged", async () => {
  const c = await pool.connect();
  try { assert.deepEqual(await rewrapBodyRows(c, KEK, "down"), { rows: 2, keys: 0 }); } finally { c.release(); }
  const r = await read();
  assert.ok(!r.wrapped.startsWith(PK_PREFIX)); assert.deepEqual(r.value, { weight_kg: 71.4 });
  const c2 = await pool.connect();
  try { await rewrapBodyRows(c2, KEK, "up"); } finally { c2.release(); }
});

test("privileges: kfo_app creates and deletes a person key, never rewrites one", async () => {
  await pool.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kfo_app') THEN CREATE ROLE kfo_app; END IF; END $$");
  await pool.query(await readFile(new URL("./roles.sql", import.meta.url), "utf8"));
  const has = async (p) => (await pool.query("SELECT has_table_privilege('kfo_app', 'body_key', $1) AS ok", [p])).rows[0].ok;
  assert.equal(await has("SELECT"), true); assert.equal(await has("INSERT"), true); assert.equal(await has("DELETE"), true);
  assert.equal(await has("UPDATE"), false);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'person' AND column_name = 'adult_confirmed_at'")).rows[0].n, 1, "M2 column");
});
