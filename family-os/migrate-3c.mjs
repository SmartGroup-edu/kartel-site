// Run once at the 3c go-live, on app-01:  docker compose exec -T os node migrate-3c.mjs
// Prints counts only. Safe to rerun (idempotent).
import pg from "pg";
import { readFile } from "node:fs/promises";
import { pgStore } from "./store.mjs";
import { parseMasterKey } from "./crypto.mjs";
import { migrateToTaskModel } from "./migrate.mjs";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
try {
  const kek = parseMasterKey(await readFile(process.env.FAMILY_OS_MASTER_KEY_FILE ?? "/run/secrets/master_key"));
  console.log(`[migrate-3c] ${JSON.stringify(await migrateToTaskModel(pgStore(pool), kek))}`);
} finally { await pool.end(); }
