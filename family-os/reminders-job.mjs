// Daily document-expiry reminder job (bus 66). Runs inside the family-os container from cron:
//   sed -n 's/^RELAY_SECRET=//p' /opt/kartel-mail-relay/relay.env | docker compose exec -T os node reminders-job.mjs
// The relay secret arrives on stdin (never in argv/env files of this service). Idempotent: each
// (document, milestone, recipient) is recorded in reminder_sent before sending; a failed send removes
// the record so the next run retries. Prints counts only.
import pg from "pg";
import { readFile } from "node:fs/promises";
import { planReminders, relayPayload } from "./reminders.mjs";
import { sign as relaySign } from "./relay-sign.mjs";

const RELAY_URL = process.env.RELAY_URL ?? "https://mail-relay.kartel.org.uk";
const secret = (await new Promise((r) => { let s = ""; process.stdin.on("data", (d) => (s += d)); process.stdin.on("end", () => r(s.trim())); }));
if (secret.length < 32) { console.error("[reminders] relay secret missing"); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
const today = new Date();
const until = new Date(Date.now() + 366 * 86400_000).toISOString().slice(0, 10);
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
const docs = (await pool.query("SELECT id, person_id, type, expiry_date FROM document WHERE NOT archive AND expiry_date IS NOT NULL AND expiry_date >= current_date AND expiry_date <= $1", [until])).rows.map((d) => ({ ...d, expiry_date: day(d.expiry_date) }));
const people = (await pool.query("SELECT id, email, name_en, name_ru, kind FROM person")).rows;
const grants = (await pool.query("SELECT * FROM guardian_grant WHERE revoked_at IS NULL")).rows;
const sent = new Set((await pool.query("SELECT document_id || ':' || milestone || ':' || recipient_id AS k FROM reminder_sent")).rows.map((r) => r.k));

const out = { documents_in_window: docs.length, due: 0, sent: 0, failed: 0 };
for (const item of planReminders(docs, people, grants, sent, today)) {
  out.due++;
  const ins = await pool.query("INSERT INTO reminder_sent (document_id, milestone, recipient_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1", [item.doc.id, item.milestone, item.recipient.id]);
  if (!ins.rowCount) continue; // another run got there first
  const body = JSON.stringify(relayPayload(item));
  const ts = String(Math.floor(Date.now() / 1000));
  let ok = false;
  try {
    const r = await fetch(`${RELAY_URL}/send-reminder`, { method: "POST", headers: { "content-type": "application/json", "x-kartel-ts": ts, "x-kartel-sig": relaySign(secret, ts, body) }, body, signal: AbortSignal.timeout(15000) });
    ok = r.status === 202;
  } catch { ok = false; }
  if (ok) out.sent++;
  else { out.failed++; await pool.query("DELETE FROM reminder_sent WHERE document_id = $1 AND milestone = $2 AND recipient_id = $3", [item.doc.id, item.milestone, item.recipient.id]); }
}
await pool.end();
console.log(`[reminders] ${JSON.stringify(out)}`);
