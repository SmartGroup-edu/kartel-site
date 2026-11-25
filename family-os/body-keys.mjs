// QA-156 M3 (R0 25.11): crypto-shredding for «Вес и питание». Each person has one /body key (32 random bytes) in
// its own table, body_key, wrapped by the master key. Every body_log / body_goal row's data key is wrapped by that
// person key, not by the master key; such a wrapped key carries the "pk1:" prefix. «Удалить все записи» deletes the
// person key with the rows, so a copy of a row left in WAL, a dead tuple or a dump no longer decrypts once the key
// is gone from them too. The key itself is still in backups until they expire (30 days: backup.sh local retention,
// mirrored off-site with rsync --delete) — recorded in the README, not hidden.
//
// Migration (additive, reversible): rewrapBodyRows(..., "up") re-wraps legacy master-wrapped row keys under the
// person key; "down" puts them back under the master key (body_key rows are kept, unused). Value ciphertexts never
// change — only the small wrapped data key does.
import { seal, open, newDataKey, unwrapDataKey } from "./crypto.mjs";

export const PK_PREFIX = "pk1:";

/** A fresh person key, wrapped for storage. */
export function newBodyKey(kek, personId) {
  const { dek, wrapped } = newDataKey(kek, "body-key", personId);
  return { key: dek, wrapped };
}
export const openBodyKey = (kek, wrapped, personId) => unwrapDataKey(kek, wrapped, "body-key", personId);

/** Wrap a row's data key under the person key. */
export const wrapUnder = (personKey, dek, scope, id) => PK_PREFIX + seal(personKey, dek, `${scope}:${id}`);

/** A row's data key: "pk1:" rows need the person key; legacy rows open with the master key. */
export function rowKey(kek, personKey, wrapped, scope, id) {
  if (wrapped.startsWith(PK_PREFIX)) {
    if (!personKey) throw new Error("body key destroyed");
    return open(personKey, wrapped.slice(PK_PREFIX.length), `${scope}:${id}`);
  }
  return unwrapDataKey(kek, wrapped, scope, id);
}

/**
 * Re-wrap every body row's data key (owner connection, one transaction).
 * @param {import("pg").PoolClient} c @param {Buffer} kek @param {"up" | "down"} dir
 * @returns {Promise<{ rows: number, keys: number }>}
 */
export async function rewrapBodyRows(c, kek, dir = "up") {
  let rows = 0, keys = 0;
  await c.query("BEGIN");
  try {
    const legacy = dir === "up" ? "NOT LIKE 'pk1:%'" : "LIKE 'pk1:%'";
    const logs = (await c.query(`SELECT id, person_id, wrapped_key FROM body_log WHERE wrapped_key ${legacy} FOR UPDATE`)).rows;
    const goals = (await c.query(`SELECT person_id, wrapped_key FROM body_goal WHERE wrapped_key ${legacy} FOR UPDATE`)).rows;
    const people = [...new Set([...logs, ...goals].map((r) => r.person_id))];
    const pkeys = new Map();
    for (const pid of people) {
      let w = (await c.query("SELECT wrapped_key FROM body_key WHERE person_id = $1", [pid])).rows[0]?.wrapped_key;
      if (!w && dir === "up") { const n = newBodyKey(kek, pid); n.key.fill(0); w = n.wrapped; await c.query("INSERT INTO body_key (person_id, wrapped_key) VALUES ($1, $2)", [pid, w]); keys++; }
      if (!w) throw new Error("body key missing for a pk1 row");
      pkeys.set(pid, openBodyKey(kek, w, pid));
    }
    const move = (pid, wrapped, scope, id) => {
      const pk = pkeys.get(pid), dek = rowKey(kek, pk, wrapped, scope, id);
      try { return dir === "up" ? wrapUnder(pk, dek, scope, id) : seal(kek, dek, `${scope}:${id}`); } finally { dek.fill(0); }
    };
    for (const r of logs) { await c.query("UPDATE body_log SET wrapped_key = $2 WHERE id = $1", [r.id, move(r.person_id, r.wrapped_key, "body", r.id)]); rows++; }
    for (const r of goals) { await c.query("UPDATE body_goal SET wrapped_key = $2 WHERE person_id = $1", [r.person_id, move(r.person_id, r.wrapped_key, "body-goal", r.person_id)]); rows++; }
    for (const k of pkeys.values()) k.fill(0);
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; }
  return { rows, keys };
}
