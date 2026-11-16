// Storage for the family editor. Two implementations with one contract: Postgres (production)
// and memory (tests). Content shape: { persons: { [nodeId]: {...} }, events: { [eventId]: {...} } }.

const empty = () => ({ persons: {}, events: {} });
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
    async addMedia(m, actor) {
      await pool.query("INSERT INTO media (id, width, height, bytes, created_by) VALUES ($1, $2, $3, $4, $5)", [m.id, m.width, m.height, m.bytes, actor]);
      await pool.query("INSERT INTO audit (actor, action, key) VALUES ($1, 'media.upload', $2)", [actor, `media:${m.id}`]);
    },
    async hasMedia(id) {
      return (await pool.query("SELECT 1 FROM media WHERE id = $1", [id])).rowCount === 1;
    },
    async audit(limit = 50) {
      // Who / when / what key — no bodies (they hold the text itself).
      return (await pool.query("SELECT id, at, actor, action, key, undone_at FROM audit ORDER BY id DESC LIMIT $1", [limit])).rows;
    },
  };
}

export function memoryStore() {
  const draft = new Map();
  const published = [];
  const media = new Set();
  const log = [];
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
    async addMedia(m, actor) { media.add(m.id); log.push({ id: ++seq, at: now(), actor, action: "media.upload", key: `media:${m.id}`, undone_at: null }); },
    async hasMedia(id) { return media.has(id); },
    async audit(limit = 50) { return [...log].reverse().slice(0, limit).map((r) => ({ id: r.id, at: r.at, actor: r.actor, action: r.action, key: r.key, undone_at: r.undone_at })); },
  };
}
