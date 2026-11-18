// Bus 87: review notices + the 30-day purge of rejected hidden uploads. Run by cron on app-01 every 15 min:
//   sed -n 's/^RELAY_SECRET=//p' /opt/kartel-mail-relay/relay.env | docker compose exec -T media node review-notices-job.mjs
// The relay secret arrives on stdin (never in this service's env). Logs counts only — no addresses, no titles.
import pg from "pg";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { pgStore } from "./store.mjs";
import { ownerDue, editorDigests, quiet, PURGE_AFTER_MS } from "./review.mjs";
import { createHmac } from "node:crypto";

const RELAY_URL = process.env.RELAY_URL ?? "https://mail-relay.kartel.org.uk";
const MEDIA_DIR = process.env.MEDIA_DIR ?? "/data/media";
const secret = await new Promise((r) => { let s = ""; process.stdin.on("data", (d) => (s += d)); process.stdin.on("end", () => r(s.trim())); });
if (secret.length < 32) { console.error("[review-notices] relay secret missing"); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const store = pgStore(pool), now = new Date();
const send = async (payload) => {
  const body = JSON.stringify(payload), ts = String(Math.floor(Date.now() / 1000));
  const r = await fetch(`${RELAY_URL}/send-review`, { method: "POST", headers: { "content-type": "application/json", "x-kartel-ts": ts, "x-kartel-sig": createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex") }, body, signal: AbortSignal.timeout(15000) });
  return r.status;
};
const out = { owner: 0, editors: 0, purged: 0, failed: 0 };
try {
  // 1. owner digest
  const lastAt = await store.noticeAt("owner_pending"), stats = await store.pendingStats(lastAt);
  if (ownerDue({ ...stats, lastAt, now })) {
    let ok = 0;
    for (const to of await store.ownerEmails()) { const st = await send({ to, kind: "pending", count: stats.pending, lang: "ru" }); if (st >= 200 && st < 300) ok++; else out.failed++; }
    if (ok) { await store.setNotice("owner_pending", now.toISOString()); out.owner = ok; }
  }
  // 2. editors: decided since the last notice (also outside quiet hours)
  if (!quiet(now)) for (const d of editorDigests(await store.decidedUnnotified())) {
    const st = await send({ to: d.to, kind: "decided", approved: d.approved, rejected: d.rejected, lang: "ru" });
    if (st >= 200 && st < 300) { await store.markNotified(d.ids); out.editors++; } else out.failed++;
  }
  // 3. purge rejected hidden uploads older than 30 days
  const gone = await store.purgeRejected(new Date(now.getTime() - PURGE_AFTER_MS).toISOString());
  for (const id of gone) await rm(join(MEDIA_DIR, id), { recursive: true, force: true });
  out.purged = gone.length;
} finally { await pool.end(); }
console.log(`[review-notices] owner=${out.owner} editors=${out.editors} purged=${out.purged} failed=${out.failed}`);
