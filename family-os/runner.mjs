// Family OS engine runner (Stage 3a, bus 77). Runs inside the family-os container every 5 minutes:
//   sed -n 's/^RELAY_SECRET=//p' /opt/kartel-mail-relay/relay.env | docker compose exec -T os node runner.mjs
// The relay secret arrives on stdin. Plans with engine.mjs; every send is recorded in rule_run BEFORE it
// goes out (idempotency key per rule + family day + person), dry-run rules only record. A failed send
// removes its row so the next tick retries. Prints counts only — never names, titles or addresses.
import pg from "pg";
import { readFile } from "node:fs/promises";
import { planSends, planInvites, localParts, DOC_DIGEST_DAYS } from "./engine.mjs";
import { sign as relaySign } from "./relay-sign.mjs";
import { pgStore } from "./store.mjs";
import { parseMasterKey } from "./crypto.mjs";
import { boardTick } from "./board-jobs.mjs";
import { isParent } from "./board.mjs";
import { purgePhotos } from "./photo.mjs";
import { planSecurityNotices } from "./security-notices.mjs";

const RELAY_URL = process.env.RELAY_URL ?? "https://mail-relay.kartel.org.uk";
const SITE = process.env.FAMILY_SITE_ORIGIN ?? "https://kartel.org.uk";
const secret = await new Promise((r) => { let s = ""; process.stdin.on("data", (d) => (s += d)); process.stdin.on("end", () => r(s.trim())); });
if (secret.length < 32) { console.error("[runner] relay secret missing"); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const q = (sql, args) => pool.query(sql, args).then((r) => r.rows);
await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
const now = process.env.RUNNER_NOW ? new Date(process.env.RUNNER_NOW) : new Date(); // RUNNER_NOW: local QA only
const { date } = localParts(now);
const D = "'YYYY-MM-DD'";

// Board (bus 82): 20:30 builds tomorrow's plan, 07:00 auto-approves today's template set if no parent did.
const kek = parseMasterKey(await readFile(process.env.FAMILY_OS_MASTER_KEY_FILE ?? "/run/secrets/master_key"));
const board = await boardTick(now, pgStore(pool), kek);
// Review photos (bus 97 item 4): deleted 7 days after upload — the sealed file, then the row is marked.
const photosDeleted = await purgePhotos({ store: pgStore(pool), filesDir: process.env.FAMILY_OS_FILES_DIR ?? "/data/docs", now });
const boardCounts = { tomorrow: (await q("SELECT count(*)::int AS n FROM task WHERE plan_date = $1::date + 1 AND state = 'proposed'", [date]))[0].n,
  tomorrowApproved: (await q("SELECT 1 FROM plan_approval WHERE plan_date = $1::date + 1", [date])).length > 0,
  // «Нужно решение» (bus 83 §2): declined, or a child's task of today still not accepted (the 19:00 note is past 12:00).
  declined: (await q(`SELECT count(*)::int AS n FROM task t JOIN person p ON p.id = t.assignee_id
                      WHERE (t.plan_date <= $1 AND t.state = 'declined') OR (t.plan_date = $1 AND t.state = 'approved' AND p.kind = 'child')`, [date]))[0].n,
  // a joint task is new for every participant
  newByPerson: new Map((await q("SELECT pid, count(*)::int AS n FROM task, unnest(ARRAY[assignee_id] || co_ids) AS pid WHERE plan_date = $1 AND state = 'approved' GROUP BY pid", [date])).map((r) => [r.pid, r.n])) };
const [people, grants, routines, rotations, pauses, checks, rotationChecks, documents, prefRows, ruleRows, ledgerRows, sentRows] = await Promise.all([
  q("SELECT id, email, name_en, name_ru, kind FROM person"),
  q("SELECT guardian_id, child_id, relation, scopes, revoked_at FROM guardian_grant WHERE revoked_at IS NULL"),
  q(`SELECT id, person_id, title, rrule, to_char(dtstart, ${D}) AS dtstart, at_time FROM routine WHERE archived_at IS NULL`),
  q(`SELECT id, title, rrule, to_char(dtstart, ${D}) AS dtstart, at_time, members, archived_at FROM rotation WHERE archived_at IS NULL`),
  q(`SELECT person_id, to_char(from_date, ${D}) AS from_date, to_char(to_date, ${D}) AS to_date, cancelled_at FROM pause WHERE cancelled_at IS NULL AND to_date >= $1::date - 31`, [date]),
  q(`SELECT DISTINCT ON (routine_id, on_date) routine_id, to_char(on_date, ${D}) AS on_date, done FROM routine_check WHERE on_date >= $1::date - 31 ORDER BY routine_id, on_date, id DESC`, [date]),
  q(`SELECT DISTINCT ON (rotation_id, on_date) rotation_id, to_char(on_date, ${D}) AS on_date, done FROM rotation_check WHERE on_date >= $1::date - 2 ORDER BY rotation_id, on_date, id DESC`, [date]),
  q(`SELECT id, person_id, type, to_char(expiry_date, ${D}) AS expiry_date FROM document WHERE NOT archive AND expiry_date IS NOT NULL AND expiry_date <= $1::date + ${DOC_DIGEST_DAYS}`, [date]),
  q("SELECT person_id, email_on, digest_time, evening_on, evening_time, lang FROM notification_pref"),
  q("SELECT id, enabled, dry_run FROM rule"),
  q("SELECT rule_id || '|' || key || '|' || person_id AS k FROM rule_run WHERE family_date >= $1::date - 1", [date]),
  q("SELECT person_id, count(*)::int AS n FROM rule_run WHERE family_date = $1 AND outcome = 'sent' GROUP BY person_id", [date]),
]);

const plan = planSends(now, {
  people, grants, routines, rotations, pauses, checks, rotationChecks, documents,
  prefs: new Map(prefRows.map(({ person_id, ...p }) => [person_id, p])),
  rules: new Map(ruleRows.map((r) => [r.id, r])),
  ledger: new Set(ledgerRows.map((r) => r.k)),
  sentToday: new Map(sentRows.map((r) => [r.person_id, r.n])),
  board: { ...boardCounts, isParent: (p) => isParent(p, grants) },
});

const out = { due: plan.length, sent: 0, dry_run: 0, skipped: 0, failed: 0 };
for (const s of plan) {
  const outcome = s.skip ?? (s.dry_run ? "dry_run" : "sent");
  const ins = await pool.query("INSERT INTO rule_run (rule_id, key, person_id, family_date, outcome) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING 1", [s.rule, s.key, s.person.id, date, outcome]);
  if (!ins.rowCount) continue; // another tick got there first
  if (outcome !== "sent") { s.skip ? out.skipped++ : out.dry_run++; await event(`notify.${outcome}`, s.person.id, s.rule); continue; }
  const lang = s.payload.lang === "en" ? "en" : "ru";
  const body = JSON.stringify({ to: s.person.email, kind: s.payload.kind, lang, firstName: s.payload.firstName, date: s.payload.date,
    items: s.payload.items ?? [], docs: s.payload.docs ?? [], notes: s.payload.notes ?? [], link: `${SITE}/${lang}/family/os${s.payload.kind === "plan" || s.payload.kind === "decision" ? "/board" : ""}`,
    ...(s.payload.tasks_new ? { tasks_new: s.payload.tasks_new } : {}), ...(s.payload.count ? { count: s.payload.count } : {}),
    settingsLink: `${SITE}/${lang}/family/os/people/${s.person.id}#letters` }); // bus 78: straight to their «Письма и паузы»
  const ts = String(Math.floor(Date.now() / 1000));
  let ok = false;
  try {
    const r = await fetch(`${RELAY_URL}/send-family`, { method: "POST", headers: { "content-type": "application/json", "x-kartel-ts": ts, "x-kartel-sig": relaySign(secret, ts, body) }, body, signal: AbortSignal.timeout(15000) });
    ok = r.status === 202;
  } catch { ok = false; }
  if (ok) { out.sent++; await event("notify.sent", s.person.id, s.rule); }
  else { out.failed++; await pool.query("DELETE FROM rule_run WHERE rule_id = $1 AND key = $2 AND person_id = $3", [s.rule, s.key, s.person.id]); }
}
// «Отправить ссылку ещё раз» (bus 84/97 item 3): the owner's queued invites. Marked sent only on a 202.
const invitesDue = planInvites(await q("SELECT id, person_id, to_char(on_date, 'YYYY-MM-DD') AS on_date, sent_at FROM invite_request WHERE sent_at IS NULL AND on_date >= $1::date - 2", [date]),
  people, new Map(prefRows.map((p) => [p.person_id, p])), now);
out.invites = 0;
for (const i of invitesDue) {
  const body = JSON.stringify({ to: i.person.email, kind: "invite", lang: i.lang, firstName: i.firstName, date: i.date, items: [], docs: [], notes: [],
    link: `${SITE}/${i.lang}/family/os`, settingsLink: `${SITE}/${i.lang}/family/os/people/${i.person.id}#letters` });
  const ts = String(Math.floor(Date.now() / 1000));
  let ok = false;
  try { ok = (await fetch(`${RELAY_URL}/send-family`, { method: "POST", headers: { "content-type": "application/json", "x-kartel-ts": ts, "x-kartel-sig": relaySign(secret, ts, body) }, body, signal: AbortSignal.timeout(15000) })).status === 202; } catch { ok = false; }
  if (ok) { await pool.query("UPDATE invite_request SET sent_at = now() WHERE id = $1 AND sent_at IS NULL", [i.id]); out.invites++; await event("invite.sent", i.person.id, null); }
  else out.failed++;
}
// Passkey security notices (bus 100 C1). Marked sent only when every copy got a 202; a partial failure is retried
// (a recipient may then get the same notice twice — preferred over a missed security letter).
const secDue = planSecurityNotices(await q("SELECT id, kind, email, device_kind, to_char(on_date, 'YYYY-MM-DD') AS on_date, sent_at FROM security_notice WHERE sent_at IS NULL AND created_at > now() - interval '3 days'"),
  people, grants, new Map(prefRows.map((p) => [p.person_id, p])), now);
out.security = 0;
for (const n of secDue) {
  let all = true;
  for (const m of n.sends) {
    const lang = m.lang === "en" ? "en" : "ru";
    const body = JSON.stringify({ ...m, link: `${SITE}/${lang}/family/os` });
    const ts = String(Math.floor(Date.now() / 1000));
    try { all = (await fetch(`${RELAY_URL}/send-security`, { method: "POST", headers: { "content-type": "application/json", "x-kartel-ts": ts, "x-kartel-sig": relaySign(secret, ts, body) }, body, signal: AbortSignal.timeout(15000) })).status === 202 && all; } catch { all = false; }
  }
  if (all) { await pool.query("UPDATE security_notice SET sent_at = now() WHERE id = $1 AND sent_at IS NULL", [n.id]); out.security += n.sends.length; }
  else out.failed++;
}
// Passkey housekeeping: expired challenges, old rate counters, revoked keys after 90 days (owner connection).
await pool.query("DELETE FROM passkey_challenge WHERE expires_at <= now()");
await pool.query("DELETE FROM passkey_attempt WHERE at < now() - interval '2 days'");
await pool.query("DELETE FROM passkey WHERE revoked_at < now() - interval '90 days'");
async function event(type, subject, ref) {
  await pool.query("INSERT INTO event (type, actor, subject_person_id, ref) VALUES ($1, 'system:runner', $2, $3)", [type.replace(/[^a-z_.]/g, "_"), subject, ref]);
}
await pool.end();
if (out.due || out.invites || out.security || photosDeleted || Object.keys(board).length || process.env.RUNNER_VERBOSE) console.log(`[runner] ${JSON.stringify({ ...out, photos_deleted: photosDeleted, date, board })}`);
