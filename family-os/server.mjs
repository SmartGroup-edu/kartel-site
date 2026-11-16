// kartel-family-os — the Family OS service (plan v3, Stage 1): people, roles, guardian grants and
// encrypted care notes with an append-only read log. Same pattern as family-media: private network,
// reached only through a Cloudflare tunnel (+ Access), every request HMAC-signed by kartel-site.
//
// The actor header is "admin:<email>" or "member:<email>"; it is covered by the signature, so only the
// site can say who is asking. Logs carry method, route class, status — never emails, names or text.
import { createServer } from "node:http";
import { createHmac, createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseActor, noteKindsFor, checkGrant, NOTE_KINDS } from "./policy.mjs";
import { encryptNote, decryptNote, parseMasterKey } from "./crypto.mjs";

const MAX_SKEW_S = 60;
const MAX_JSON = 32 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;

export function sign(secret, ts, nonce, method, path, actor, bodySha) {
  return createHmac("sha256", secret).update(`${ts}.${nonce}.${method}.${path}.${actor}.${bodySha}`).digest("hex");
}
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function limiter() {
  const hits = new Map();
  return (key, max, windowMs) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr); return true;
  };
}

const text = (v, max) => (typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null);

/** @param {{ store: any, secret: string, masterKey: Buffer }} deps */
export function createApp({ store, secret, masterKey }) {
  if (!secret || secret.length < 32) throw new Error("FAMILY_OS_SECRET must be >= 32 chars");
  const kek = parseMasterKey(masterKey);
  const allow = limiter();
  const seen = new Map();
  setInterval(() => { const n = Date.now(); for (const [k, t] of seen) if (t < n) seen.delete(k); }, 30_000).unref();

  const reply = (res, code, obj) => {
    res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(JSON.stringify(obj));
  };

  function verify(req, body) {
    const ts = req.headers["x-kartel-ts"], sig = req.headers["x-kartel-sig"], nonce = req.headers["x-kartel-nonce"];
    const actor = String(req.headers["x-kartel-actor"] ?? "");
    if (!/^\d+$/.test(ts ?? "") || !/^[0-9a-f]{64}$/.test(sig ?? "") || !/^[0-9a-f]{32}$/.test(nonce ?? "")) return null;
    if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_S) return null;
    const want = Buffer.from(sign(secret, ts, nonce, req.method, req.url, actor, sha256(body)), "hex");
    if (!timingSafeEqual(want, Buffer.from(sig, "hex"))) return null;
    if (seen.has(sig)) return null;
    seen.set(sig, Date.now() + 2 * MAX_SKEW_S * 1000);
    return { actor };
  }

  const readBody = (req) => new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > MAX_JSON) { reject(Object.assign(new Error("too_large"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
  const json = (body) => { try { return JSON.parse(body.toString("utf8") || "{}"); } catch { return null; } };

  /** Write the read-log row first; if that fails, the read fails (plan v3 §6.2). */
  async function logged(res, entry) {
    try { await store.logAccess(entry); return true; } catch { console.error("[os] access log write failed"); reply(res, 503, { error: "log_unavailable" }); return false; }
  }

  async function handle(req, res) {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/healthz") return reply(res, 200, { ok: true });

    const body = await readBody(req);
    const auth = verify(req, body);
    if (!auth) { console.warn("[os] rejected: bad signature"); return reply(res, 401, { error: "unauthorized" }); }
    const who = parseActor(auth.actor);
    if (!who) return reply(res, 403, { error: "actor_required" });
    const writes = req.method !== "GET";
    if (!allow(`${writes ? "w" : "r"}:${who.email}`, writes ? 300 : 3000, 3600_000)) return reply(res, 429, { error: "rate_limited" });
    if (!allow("all", 20000, 3600_000)) return reply(res, 429, { error: "rate_limited" });
    const admin = who.role === "admin";
    const me = await store.findPersonByEmail(who.email);
    const path = url.pathname;

    // GET /me — who am I in Family OS (null = signed in to /family but not a Family OS member yet)
    if (req.method === "GET" && path === "/me") {
      return reply(res, 200, { me: me ? { id: me.id, name_en: me.name_en, name_ru: me.name_ru, kind: me.kind } : null, admin });
    }

    // GET /people — names, roles and guardian relations. Emails only for the admin.
    if (req.method === "GET" && path === "/people") {
      if (!me && !admin) return reply(res, 403, { error: "not_a_member" });
      const [people, grants] = await Promise.all([store.listPeople(), store.listGrants()]);
      return reply(res, 200, {
        people: people.map((p) => ({ id: p.id, name_en: p.name_en, name_ru: p.name_ru, kind: p.kind, ...(admin ? { email: p.email } : {}) })),
        grants: grants.map((g) => ({ id: g.id, guardian_id: g.guardian_id, child_id: g.child_id, relation: g.relation, scopes: g.scopes })),
      });
    }

    // POST /people (admin) — { email, name_en, name_ru, kind }
    if (req.method === "POST" && path === "/people") {
      if (!admin) return reply(res, 403, { error: "admin_only" });
      const b = json(body); const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
      const p = { email, name_en: text(b?.name_en, 200), name_ru: text(b?.name_ru, 200), kind: b?.kind };
      if (!EMAIL_RE.test(email) || !p.name_en || !p.name_ru || !["adult", "child"].includes(p.kind)) return reply(res, 400, { error: "bad_person" });
      try { return reply(res, 201, { id: await store.createPerson(p, who.email) }); }
      catch (e) { return e?.code === "23505" ? reply(res, 409, { error: "exists" }) : Promise.reject(e); }
    }

    // POST /grants (admin) — { guardian_id, child_id, relation, scopes }
    if (req.method === "POST" && path === "/grants") {
      if (!admin) return reply(res, 403, { error: "admin_only" });
      const b = json(body);
      if (!UUID_RE.test(b?.guardian_id ?? "") || !UUID_RE.test(b?.child_id ?? "")) return reply(res, 400, { error: "bad_grant" });
      const [guardian, child] = await Promise.all([store.getPerson(b.guardian_id), store.getPerson(b.child_id)]);
      const err = checkGrant({ guardian, child, relation: b.relation, scopes: b.scopes });
      if (err) return reply(res, 400, { error: err });
      try { return reply(res, 201, { id: await store.createGrant({ guardian_id: guardian.id, child_id: child.id, relation: b.relation, scopes: b.scopes }, who.email) }); }
      catch (e) { return e?.code === "23505" ? reply(res, 409, { error: "exists" }) : Promise.reject(e); }
    }

    // DELETE /grants/:id (admin) — takes effect on the next request (grants are read per request)
    const gm = path.match(/^\/grants\/([^/]+)$/);
    if (req.method === "DELETE" && gm) {
      if (!admin) return reply(res, 403, { error: "admin_only" });
      if (!UUID_RE.test(gm[1])) return reply(res, 400, { error: "bad_id" });
      return (await store.revokeGrant(gm[1], who.email)) ? reply(res, 200, { ok: true }) : reply(res, 404, { error: "not_found" });
    }

    // GET|POST /people/:id/notes — care notes (health/education), encrypted at rest, every access logged
    const nm = path.match(/^\/people\/([^/]+)\/notes$/);
    if (nm && (req.method === "GET" || req.method === "POST")) {
      if (!UUID_RE.test(nm[1])) return reply(res, 400, { error: "bad_id" });
      const subject = await store.getPerson(nm[1]);
      if (!subject) return reply(res, 404, { error: "not_found" });
      const kinds = noteKindsFor(me, subject, await store.listGrants());
      if (req.method === "GET") {
        if (kinds.length === 0) return reply(res, 403, { error: "forbidden" });
        if (!(await logged(res, { actor: who.email, subject: subject.id, entity: `notes:${kinds.join("+")}`, action: "read" }))) return;
        const rows = await store.listNotes(subject.id, kinds);
        return reply(res, 200, { kinds, notes: rows.map((r) => ({ id: r.id, kind: r.kind, updated_at: r.updated_at, ...decryptNote(kek, r) })) });
      }
      const b = json(body);
      const kind = b?.kind, title = text(b?.title, 200), noteBody = typeof b?.body === "string" && b.body.length <= 4000 ? b.body : null;
      if (!NOTE_KINDS.includes(kind) || !title || noteBody === null) return reply(res, 400, { error: "bad_note" });
      if (!kinds.includes(kind)) return reply(res, 403, { error: "forbidden" });
      if (!(await logged(res, { actor: who.email, subject: subject.id, entity: `notes:${kind}`, action: "write" }))) return;
      const id = randomUUID();
      await store.createNote({ id, person_id: subject.id, kind, ...encryptNote(kek, id, { title, body: noteBody }) }, who.email);
      return reply(res, 201, { id });
    }

    return reply(res, 404, { error: "not_found" });
  }

  return (req, res) => handle(req, res).catch((e) => {
    console.error(`[os] error ${e?.status ?? 500}`);
    if (!res.headersSent) reply(res, e?.status ?? 500, { error: e?.status === 413 ? "too_large" : "server_error" });
  });
}

/** "/people/<uuid>/notes" → "/people/:id/notes" — logs never carry ids, emails or text. */
export function routeClass(url = "") {
  const p = url.split("?")[0];
  if (p === "/healthz" || p === "/me" || p === "/people" || p === "/grants") return p;
  if (/^\/grants\/[^/]+$/.test(p)) return "/grants/:id";
  if (/^\/people\/[^/]+\/notes$/.test(p)) return "/people/:id/notes";
  return "/:other";
}

export const CANARY_TEXT = { title: "kartel-family-os drill canary", body: "no personal data" };

/** Create the encrypted drill canary once (restore drills decrypt it to prove the key still works). */
export async function ensureCanary(pool, kek) {
  if ((await pool.query("SELECT 1 FROM drill_canary LIMIT 1")).rowCount) return;
  const id = randomUUID(), c = encryptNote(kek, id, CANARY_TEXT);
  await pool.query("INSERT INTO drill_canary (id, wrapped_key, title_ct, body_ct, key_version) VALUES ($1, $2, $3, $4, $5)", [id, c.wrapped_key, c.title_ct, c.body_ct, c.key_version]);
}

async function main() {
  const { default: pg } = await import("pg");
  const { pgStore } = await import("./store.mjs");
  const masterKey = await readFile(process.env.FAMILY_OS_MASTER_KEY_FILE ?? "/run/secrets/master_key");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  await ensureCanary(pool, parseMasterKey(masterKey));
  const handler = createApp({ store: pgStore(pool), secret: process.env.FAMILY_OS_SECRET, masterKey });
  const port = Number(process.env.PORT ?? 8789);
  const logged = (req, res) => {
    const t0 = Date.now();
    res.on("finish", () => { const r = routeClass(req.url); if (r !== "/healthz") console.log(`[os] ${req.method} ${r} ${res.statusCode} ${Date.now() - t0}ms`); });
    return handler(req, res);
  };
  createServer(logged).listen(port, "0.0.0.0", () => console.log(`[os] listening on ${port}`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("[os] start failed", e?.message); process.exit(1); });
}
