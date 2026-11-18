import { randomUUID } from "node:crypto";
import { referencedMedia } from "./validate.mjs";

// Storage for the family editor. Two implementations with one contract: Postgres (production)
// and memory (tests). Content shape: { persons: { [nodeId]: {...} }, events: { [eventId]: {...} } }.

const empty = () => ({ persons: {}, events: {} });
/** The media ids one key's body uses (a person's portrait or an entry's photos). */
const keyMedia = (key, body) => { const [kind] = key.split(":"); return [...referencedMedia(kind === "person" ? { persons: { x: body ?? {} }, events: {} } : { persons: {}, events: { x: body ?? {} } })]; };
export { keyMedia };
const splitKey = (key) => { const i = key.indexOf(":"); return [key.slice(0, i), key.slice(i + 1)]; };
function assemble(rows) {
  const c = empty();
  for (const { key, body } of rows) {
    const [kind, id] = splitKey(key);
    (kind === "person" ? c.persons : c.events)[id] = body;
  }
  return c;
}

/** @param {import("pg").Pool} pool */
export function pgStore(pool) {
  const tx = async (fn) => {
    const c = await pool.connect();
    try { await c.query("BEGIN"); const r = await fn(c); await c.query("COMMIT"); return r; }
    catch (e) { await c.query("ROLLBACK"); throw e; }
    finally { c.release(); }
  };
  return {
    async getDraft() {
      return assemble((await pool.query("SELECT key, body FROM content_draft")).rows);
    },
    async getPublished() {
      const r = await pool.query("SELECT body, published_at, published_by FROM published ORDER BY id DESC LIMIT 1");
      return r.rows[0] ? { content: r.rows[0].body, at: r.rows[0].published_at } : { content: empty(), at: null };
    },
    async saveDraft(key, body, actor) {
      return tx(async (c) => {
        const prev = (await c.query("SELECT body FROM content_draft WHERE key = $1 FOR UPDATE", [key])).rows[0]?.body ?? null;
        await c.query(
          `INSERT INTO content_draft (key, body, updated_by) VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, updated_at = now(), updated_by = EXCLUDED.updated_by`,
          [key, body, actor],
        );
        await c.query("INSERT INTO audit (actor, action, key, before, after) VALUES ($1, 'draft.save', $2, $3, $4)", [actor, key, prev, body]);
      });
    },
    async undo(actor) {
      return tx(async (c) => {
        const last = (await c.query(
          "SELECT id, key, before, after FROM audit WHERE action = 'draft.save' AND undone_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE",
        )).rows[0];
        if (!last) return null;
        if (last.before === null) await c.query("DELETE FROM content_draft WHERE key = $1", [last.key]);
        else await c.query("UPDATE content_draft SET body = $2, updated_at = now(), updated_by = $3 WHERE key = $1", [last.key, last.before, actor]);
        await c.query("UPDATE audit SET undone_at = now() WHERE id = $1", [last.id]);
        await c.query("INSERT INTO audit (actor, action, key, before, after) VALUES ($1, 'draft.undo', $2, $3, $4)", [actor, last.key, last.after, last.before]);
        return last.key;
      });
    },
    async publish(actor) {
      return tx(async (c) => {
        const content = assemble((await c.query("SELECT key, body FROM content_draft")).rows);
        await c.query("INSERT INTO published (body, published_by) VALUES ($1, $2)", [content, actor]);
        await c.query("INSERT INTO audit (actor, action, after) VALUES ($1, 'publish', $2)", [actor, content]);
        return content;
      });
    },
    async addMedia(m, actor, pending = false) {
      await pool.query("INSERT INTO media (id, width, height, bytes, created_by, pending) VALUES ($1, $2, $3, $4, $5, $6)", [m.id, m.width, m.height, m.bytes, actor, pending]);
      await pool.query("INSERT INTO audit (actor, action, key) VALUES ($1, 'media.upload', $2)", [actor, `media:${m.id}`]);
    },
    async hasMedia(id) {
      return (await pool.query("SELECT 1 FROM media WHERE id = $1", [id])).rowCount === 1;
    },
    /** { id: [width, height] } of the largest variant, for layout before the image loads. */
    async mediaDims(ids) {
      if (!ids.length) return {};
      const r = await pool.query("SELECT id, width, height FROM media WHERE id = ANY($1::uuid[])", [ids]);
      return Object.fromEntries(r.rows.map((x) => [x.id, [x.width, x.height]]));
    },
    async audit(limit = 50) {
      // Who / when / what key — no bodies (they hold the text itself).
      return (await pool.query("SELECT id, at, actor, action, key, undone_at FROM audit ORDER BY id DESC LIMIT $1", [limit])).rows;
    },
    // ---- Bus 87: editor revisions
    async mediaInfo(id) { return (await pool.query("SELECT pending, created_by FROM media WHERE id = $1", [id])).rows[0] ?? null; },
    /** Create or update the author's open proposal for a key; `before` is the draft when it was first proposed. */
    async propose(key, body, author) {
      return tx(async (c) => {
        const cur = (await c.query("SELECT body FROM content_draft WHERE key = $1", [key])).rows[0]?.body ?? null;
        const open = (await c.query("SELECT id FROM revision WHERE key = $1 AND author = $2 AND state = 'pending' FOR UPDATE", [key, author])).rows[0];
        const id = open?.id ?? randomUUID();
        if (open) await c.query("UPDATE revision SET after = $2, updated_at = now() WHERE id = $1", [id, body]);
        else await c.query("INSERT INTO revision (id, key, author, before, after) VALUES ($1, $2, $3, $4, $5)", [id, key, author, cur, body]);
        await c.query("INSERT INTO audit (actor, action, key, before, after) VALUES ($1, 'review.propose', $2, $3, $4)", [author, key, cur, body]);
        return { id, updated: Boolean(open) };
      });
    },
    async revisions({ state = null, author = null, limit = 100 } = {}) {
      return (await pool.query(`SELECT id, key, author, created_at, updated_at, before, after, state, decided_by, decided_at, comment FROM revision
        WHERE ($1::text IS NULL OR state = $1) AND ($2::text IS NULL OR author = $2) ORDER BY created_at DESC LIMIT $3`, [state, author, limit])).rows;
    },
    async getRevision(id) { return (await pool.query("SELECT * FROM revision WHERE id = $1", [id])).rows[0] ?? null; },
    /** Approve: the proposal becomes the draft for its key; its uploads stop being hidden. The caller publishes. */
    async approve(id, owner) {
      return tx(async (c) => {
        const r = (await c.query("SELECT * FROM revision WHERE id = $1 AND state = 'pending' FOR UPDATE", [id])).rows[0];
        if (!r) return null;
        const prev = (await c.query("SELECT body FROM content_draft WHERE key = $1 FOR UPDATE", [r.key])).rows[0]?.body ?? null;
        await c.query(`INSERT INTO content_draft (key, body, updated_by) VALUES ($1, $2, $3)
                       ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, updated_at = now(), updated_by = EXCLUDED.updated_by`, [r.key, r.after, owner]);
        await c.query("INSERT INTO audit (actor, action, key, before, after) VALUES ($1, 'draft.save', $2, $3, $4)", [owner, r.key, prev, r.after]);
        const ids = keyMedia(r.key, r.after);
        if (ids.length) await c.query("UPDATE media SET pending = false, rejected_at = NULL WHERE id = ANY($1::uuid[])", [ids]);
        await c.query("UPDATE revision SET state = 'approved', decided_by = $2, decided_at = now() WHERE id = $1", [id, owner]);
        await c.query("INSERT INTO audit (actor, action, key) VALUES ($1, 'review.approve', $2)", [owner, `revision:${id}`]);
        return { key: r.key, stale: JSON.stringify(prev) !== JSON.stringify(r.before) };
      });
    },
    /** Reject: the draft is untouched; the author's hidden uploads used only here are marked for the 30-day purge. */
    async reject(id, owner, comment) {
      return tx(async (c) => {
        const r = (await c.query("SELECT * FROM revision WHERE id = $1 AND state = 'pending' FOR UPDATE", [id])).rows[0];
        if (!r) return null;
        await c.query("UPDATE revision SET state = 'rejected', decided_by = $2, decided_at = now(), comment = $3 WHERE id = $1", [id, owner, comment]);
        const others = (await c.query("SELECT key, after FROM revision WHERE state = 'pending' AND id <> $1", [id])).rows.flatMap((x) => keyMedia(x.key, x.after));
        const ids = keyMedia(r.key, r.after).filter((m) => !others.includes(m));
        if (ids.length) await c.query("UPDATE media SET rejected_at = now() WHERE pending AND created_by = $2 AND id = ANY($1::uuid[])", [ids, r.author]);
        await c.query("INSERT INTO audit (actor, action, key) VALUES ($1, 'review.reject', $2)", [owner, `revision:${id}`]);
        return { key: r.key };
      });
    },
    async withdraw(id, author) {
      const r = await pool.query("UPDATE revision SET state = 'withdrawn', decided_by = $2, decided_at = now() WHERE id = $1 AND author = $2 AND state = 'pending'", [id, author]);
      if (r.rowCount) await pool.query("INSERT INTO audit (actor, action, key) VALUES ($1, 'review.withdraw', $2)", [author, `revision:${id}`]);
      return r.rowCount === 1;
    },
    // ---- notices and the purge (review-notices-job.mjs)
    async noticeAt(kind) { return (await pool.query("SELECT last_at FROM notice WHERE kind = $1", [kind])).rows[0]?.last_at ?? null; },
    async setNotice(kind, at, actor = "system:notices") {
      await pool.query("INSERT INTO notice (kind, last_at) VALUES ($1, $2) ON CONFLICT (kind) DO UPDATE SET last_at = EXCLUDED.last_at", [kind, at]);
      await pool.query("INSERT INTO audit (actor, action, key) VALUES ($1, 'notice.sent', $2)", [actor, kind]);
    },
    async pendingStats(since) {
      const r = (await pool.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE $1::timestamptz IS NULL OR updated_at > $1)::int AS fresh FROM revision WHERE state = 'pending'", [since])).rows[0];
      return { pending: r.n, fresh: r.fresh };
    },
    async decidedUnnotified() { return (await pool.query("SELECT id, author, state FROM revision WHERE state IN ('approved', 'rejected') AND notified_at IS NULL")).rows; },
    async markNotified(ids) { if (ids.length) await pool.query("UPDATE revision SET notified_at = now() WHERE id = ANY($1::uuid[])", [ids]); },
    /** The owner's addresses for notices: whoever has published or decided (an editor can do neither). */
    async ownerEmails() { return (await pool.query("SELECT DISTINCT actor FROM audit WHERE action IN ('publish', 'review.approve', 'review.reject') AND actor LIKE '%@%'")).rows.map((r) => r.actor); },
    /** Hidden uploads rejected more than 30 days ago and used nowhere: delete the rows; returns the ids (the job deletes the files). */
    async purgeRejected(cutoff) {
      return tx(async (c) => {
        const cand = (await c.query("SELECT id FROM media WHERE pending AND rejected_at IS NOT NULL AND rejected_at < $1 FOR UPDATE", [cutoff])).rows.map((r) => r.id);
        if (!cand.length) return [];
        const draft = assemble((await c.query("SELECT key, body FROM content_draft")).rows), pub = (await c.query("SELECT body FROM published ORDER BY id DESC LIMIT 1")).rows[0]?.body ?? empty();
        const open = (await c.query("SELECT key, after FROM revision WHERE state = 'pending'")).rows.flatMap((x) => keyMedia(x.key, x.after));
        const used = new Set([...referencedMedia(draft), ...referencedMedia(pub), ...open]);
        const gone = cand.filter((id) => !used.has(id));
        if (gone.length) {
          await c.query("DELETE FROM media WHERE id = ANY($1::uuid[])", [gone]);
          await c.query("INSERT INTO audit (actor, action, key) VALUES ('system:purge', 'media.purge', $1)", [`media:${gone.length}`]);
        }
        return gone;
      });
    },
  };
}

export function memoryStore() {
  const draft = new Map();
  const published = [];
  const media = new Map();
  const log = [];
  const revs = new Map(); // id -> revision
  const meta = new Map(); // media id -> { pending, created_by, rejected_at }
  const notices = new Map();
  let seq = 0;
  const now = () => new Date().toISOString();
  return {
    async getDraft() { return assemble([...draft].map(([key, body]) => ({ key, body }))); },
    async getPublished() { const p = published.at(-1); return p ? { content: p.body, at: p.at } : { content: empty(), at: null }; },
    async saveDraft(key, body, actor) {
      log.push({ id: ++seq, at: now(), actor, action: "draft.save", key, before: draft.get(key) ?? null, after: body, undone_at: null });
      draft.set(key, body);
    },
    async undo(actor) {
      const last = [...log].reverse().find((r) => r.action === "draft.save" && !r.undone_at);
      if (!last) return null;
      if (last.before === null) draft.delete(last.key); else draft.set(last.key, last.before);
      last.undone_at = now();
      log.push({ id: ++seq, at: now(), actor, action: "draft.undo", key: last.key, before: last.after, after: last.before, undone_at: null });
      return last.key;
    },
    async publish(actor) {
      const content = await this.getDraft();
      published.push({ body: structuredClone(content), at: now(), by: actor });
      log.push({ id: ++seq, at: now(), actor, action: "publish", key: null, undone_at: null });
      return content;
    },
    async addMedia(m, actor, pending = false) { media.set(m.id, [m.width, m.height]); meta.set(m.id, { pending, created_by: actor, rejected_at: null }); log.push({ id: ++seq, at: now(), actor, action: "media.upload", key: `media:${m.id}`, undone_at: null }); },
    async hasMedia(id) { return media.has(id); },
    async mediaDims(ids) { return Object.fromEntries(ids.filter((id) => media.has(id)).map((id) => [id, media.get(id)])); },
    async audit(limit = 50) { return [...log].reverse().slice(0, limit).map((r) => ({ id: r.id, at: r.at, actor: r.actor, action: r.action, key: r.key, undone_at: r.undone_at })); },
    // ---- Bus 87
    async mediaInfo(id) { const m = meta.get(id); return m ? { pending: m.pending, created_by: m.created_by } : null; },
    async propose(key, body, author) {
      const cur = draft.get(key) ?? null;
      const open = [...revs.values()].find((r) => r.key === key && r.author === author && r.state === "pending");
      const id = open?.id ?? randomUUID();
      if (open) { open.after = structuredClone(body); open.updated_at = now(); }
      else revs.set(id, { id, key, author, created_at: now(), updated_at: now(), before: cur, after: structuredClone(body), state: "pending", decided_by: null, decided_at: null, comment: null, notified_at: null });
      log.push({ id: ++seq, at: now(), actor: author, action: "review.propose", key, before: cur, after: body, undone_at: null });
      return { id, updated: Boolean(open) };
    },
    async revisions({ state = null, author = null, limit = 100 } = {}) {
      return [...revs.values()].filter((r) => (!state || r.state === state) && (!author || r.author === author)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map((r) => ({ ...r }));
    },
    async getRevision(id) { const r = revs.get(id); return r ? { ...r } : null; },
    async approve(id, owner) {
      const r = revs.get(id); if (!r || r.state !== "pending") return null;
      const prev = draft.get(r.key) ?? null;
      log.push({ id: ++seq, at: now(), actor: owner, action: "draft.save", key: r.key, before: prev, after: r.after, undone_at: null });
      draft.set(r.key, structuredClone(r.after));
      for (const m of keyMedia(r.key, r.after)) { const x = meta.get(m); if (x) { x.pending = false; x.rejected_at = null; } }
      Object.assign(r, { state: "approved", decided_by: owner, decided_at: now() });
      log.push({ id: ++seq, at: now(), actor: owner, action: "review.approve", key: `revision:${id}`, undone_at: null });
      return { key: r.key, stale: JSON.stringify(prev) !== JSON.stringify(r.before) };
    },
    async reject(id, owner, comment) {
      const r = revs.get(id); if (!r || r.state !== "pending") return null;
      Object.assign(r, { state: "rejected", decided_by: owner, decided_at: now(), comment });
      const others = [...revs.values()].filter((x) => x.state === "pending" && x.id !== id).flatMap((x) => keyMedia(x.key, x.after));
      for (const m of keyMedia(r.key, r.after)) { const x = meta.get(m); if (x && x.pending && x.created_by === r.author && !others.includes(m)) x.rejected_at = now(); }
      log.push({ id: ++seq, at: now(), actor: owner, action: "review.reject", key: `revision:${id}`, undone_at: null });
      return { key: r.key };
    },
    async withdraw(id, author) {
      const r = revs.get(id); if (!r || r.author !== author || r.state !== "pending") return false;
      Object.assign(r, { state: "withdrawn", decided_by: author, decided_at: now() });
      log.push({ id: ++seq, at: now(), actor: author, action: "review.withdraw", key: `revision:${id}`, undone_at: null });
      return true;
    },
    async noticeAt(kind) { return notices.get(kind) ?? null; },
    async setNotice(kind, at, actor = "system:notices") { notices.set(kind, at); log.push({ id: ++seq, at: now(), actor, action: "notice.sent", key: kind, undone_at: null }); },
    async pendingStats(since) { const p = [...revs.values()].filter((r) => r.state === "pending"); return { pending: p.length, fresh: p.filter((r) => !since || r.updated_at > since).length }; },
    async decidedUnnotified() { return [...revs.values()].filter((r) => ["approved", "rejected"].includes(r.state) && !r.notified_at).map((r) => ({ id: r.id, author: r.author, state: r.state })); },
    async markNotified(ids) { for (const id of ids) { const r = revs.get(id); if (r) r.notified_at = now(); } },
    async ownerEmails() { return [...new Set(log.filter((r) => ["publish", "review.approve", "review.reject"].includes(r.action) && r.actor.includes("@")).map((r) => r.actor))]; },
    async purgeRejected(cutoff) {
      const used = new Set([...referencedMedia(await this.getDraft()), ...referencedMedia((await this.getPublished()).content), ...[...revs.values()].filter((r) => r.state === "pending").flatMap((r) => keyMedia(r.key, r.after))]);
      const gone = [...meta].filter(([id, x]) => x.pending && x.rejected_at && x.rejected_at < cutoff && !used.has(id)).map(([id]) => id);
      for (const id of gone) { meta.delete(id); media.delete(id); }
      if (gone.length) log.push({ id: ++seq, at: now(), actor: "system:purge", action: "media.purge", key: `media:${gone.length}`, undone_at: null });
      return gone;
    },
    _raw: { revs, meta, log },
  };
}
