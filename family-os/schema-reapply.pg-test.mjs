// QA-156 C1: schema.sql runs on every start (server.mjs main, runner.mjs). Re-applying it to a table that
// already holds every access_log action must succeed, and the runner tick after it must exit 0.
// Needs a disposable Postgres (the test drops the public schema):
//   FAMILY_OS_TEST_DATABASE_URL=postgres://… npm run test:pg   or   npm run test:pg --pg-url=postgres://…
// Synthetic rows only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { LOG_ACTIONS } from "./store.mjs";

const URL_ = process.env.FAMILY_OS_TEST_DATABASE_URL ?? process.env.npm_config_pg_url;
if (!URL_) throw new Error("FAMILY_OS_TEST_DATABASE_URL is required (a disposable Postgres)");
const pool = new pg.Pool({ connectionString: URL_, max: 2 });
const schemaSql = () => readFile(new URL("./schema.sql", import.meta.url), "utf8");
let dir;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "kfo-pg-"));
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
});
after(async () => { await pool.end(); await rm(dir, { recursive: true, force: true }); });

test("schema applies, takes one access_log row per action, and applies again", async () => {
  await pool.query(await schemaSql());
  const subject = randomUUID();
  for (const action of LOG_ACTIONS)
    await pool.query("INSERT INTO access_log (actor, subject_person_id, entity, action) VALUES ($1, $2, $3, $4)", ["member:qa@example.test", subject, "body:own", action]);
  await pool.query(await schemaSql());
  const { rows } = await pool.query("SELECT DISTINCT action FROM access_log ORDER BY 1");
  assert.deepEqual(rows.map((r) => r.action), [...LOG_ACTIONS].sort());
  const def = (await pool.query("SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'access_log_action_check'")).rows;
  assert.equal(def.length, 1);
  for (const a of LOG_ACTIONS) assert.match(def[0].d, new RegExp(`'${a}'`));
});

test("a runner tick after it exits 0 (it re-applies the schema too)", async () => {
  const keyFile = join(dir, "master.key");
  await writeFile(keyFile, randomBytes(32), { mode: 0o400 });
  const out = await new Promise((resolve) => {
    const p = spawn(process.execPath, [fileURLToPath(new URL("./runner.mjs", import.meta.url))], {
      env: { ...process.env, DATABASE_URL: URL_, FAMILY_OS_MASTER_KEY_FILE: keyFile, RELAY_URL: "http://127.0.0.1:9", RUNNER_NOW: "2026-11-25T09:00:00Z", RUNNER_VERBOSE: "1" },
    });
    let log = ""; p.stdout.on("data", (d) => (log += d)); p.stderr.on("data", (d) => (log += d));
    p.on("close", (code) => resolve({ code, log }));
    p.stdin.end("x".repeat(40));
  });
  assert.equal(out.code, 0, out.log);
  assert.match(out.log, /\[runner\] \{/);
  assert.doesNotMatch(out.log, /violated|error/i);
});
