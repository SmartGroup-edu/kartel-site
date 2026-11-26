// bus 165: pending sign-ins on real Postgres — the attempt reservation is atomic (parallel guesses never compare
// more than CODE_ATTEMPTS times), a newer request supersedes, consume is single-use, and schema.sql re-applies.
// Needs a disposable Postgres (the test drops the public schema):
//   FAMILY_OS_TEST_DATABASE_URL=postgres://… npm run test:pg
// Synthetic hashes only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";
import { pgStore } from "./store.mjs";
import { CODE_ATTEMPTS, addPending, checkCode, consumePending, pendingStatus } from "./signin.mjs";

const URL_ = process.env.FAMILY_OS_TEST_DATABASE_URL ?? process.env.npm_config_pg_url;
if (!URL_) throw new Error("FAMILY_OS_TEST_DATABASE_URL is required (a disposable Postgres)");
const pool = new pg.Pool({ connectionString: URL_, max: 10 });
const h = (s) => createHash("sha256").update(s).digest("hex");
let store;
before(async () => {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(sql);
  await pool.query(sql); // re-applies cleanly
  store = pgStore(pool);
});
after(() => pool.end());

const add = (n, key, code, now = new Date()) => addPending({ store, now, b: { nonce_hash: h(n), email_key: h(key), email: "member@example.test", code_hash: h(code), ttl_s: 600 } });
const guess = (n, code, now = new Date()) => checkCode({ store, now, b: { nonce_hash: h(n), code_hash: h(code) } });

test("parallel wrong guesses: exactly five comparisons, then locked", async () => {
  assert.equal((await add("p", "kp", "right")).status, 201);
  const rs = await Promise.all(Array.from({ length: 40 }, () => guess("p", "wrong")));
  assert.equal(rs.filter((r) => r.body.state === "wrong").length, CODE_ATTEMPTS - 1);
  assert.equal(rs.filter((r) => r.body.state === "locked").length, 40 - (CODE_ATTEMPTS - 1));
  assert.equal((await store.signinGet(h("p"))).attempts, CODE_ATTEMPTS);
  assert.equal((await guess("p", "right")).body.state, "locked");
});

test("supersede, single use, expiry", async () => {
  const t0 = new Date();
  await add("s1", "ks", "one", t0);
  await add("s2", "ks", "two", new Date(t0.getTime() + 1000));
  assert.equal((await pendingStatus({ store, now: new Date(), b: { nonce_hash: h("s1") } })).body.state, "superseded");
  assert.equal((await guess("s2", "one")).body.state, "superseded");
  const parallel = await Promise.all([guess("s2", "two"), consumePending({ store, now: new Date(), b: { nonce_hash: h("s2") } })]);
  assert.equal(parallel.filter((r) => r.body.state === "ok").length, 1, "the code and the link race: exactly one wins");
  await add("e", "ke", "x", new Date(Date.now() - 700_000));
  assert.equal((await guess("e", "x")).body.state, "expired");
  const audit = (await pool.query("SELECT actor, action, entity FROM audit WHERE actor = 'auth:signin'")).rows;
  assert.ok(audit.length >= 2);
  assert.doesNotMatch(JSON.stringify(audit), /member@|one|two/);
});
