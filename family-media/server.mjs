// kartel-family-media — private photos and chronicle stories for the gated family area.
//
// Reached only from kartel-site's server (Vercel) through the Cloudflare tunnel, with a signed
// request: hex HMAC-SHA256(secret, `${ts}.${nonce}.${METHOD}.${path?query}.${actor}.${sha256(body)}`),
// 60 s window, each signature usable once (the random nonce keeps identical requests distinct). Nothing here is public: files are served only to a
// signed caller, and to viewers (scope=published) only when the published content references them.
// No personal data is ever written to the log — status codes and ids only.
//
// Node 22. Dependencies: pg, sharp. Storage: Postgres (same compose network) + a files volume.

import { createServer } from "node:http";
import { createHmac, createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { KEY_RE, UUID_RE, validatePerson, validateEvent, referencedMedia } from "./validate.mjs";
import { keyMedia } from "./store.mjs";
import { processImage, WIDTHS, FORMATS, MAX_BYTES } from "./images.mjs";

const MAX_SKEW_S = 60;
const MAX_JSON = 64 * 1024;
const VARIANT_RE = new RegExp(`^(${WIDTHS.join("|")})\\.(${FORMATS.join("|")})$`);
const TYPES = { webp: "image/webp", avif: "image/avif" };
const EMAIL = /^[^\s@:]+@[^\s@]+$/;
/**
 * The signed actor says who is asking and in which role (bus 87): "<email>" is the owner (FAMILY_ADMIN_EMAILS
 * on the site), "editor:<email>" an editor whose every change waits for the owner. Only kartel-site holds the
 * signing secret, so the role cannot be forged by a browser. Reads by family viewers carry their email too.
 */
export function parseActor(raw = "") {
  if (raw.startsWith("editor:")) { const email = raw.slice(7); return EMAIL.test(email) ? { role: "editor", email } : null; }
  return EMAIL.test(raw) ? { role: "owner", email: raw } : raw === "" ? { role: "viewer", email: "" } : null;
}

export function sign(secret, ts, nonce, method, path, actor, bodySha) {
  return createHmac("sha256", secret).update(`${ts}.${nonce}.${method}.${path}.${actor}.${bodySha}`).digest("hex");
}
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Small fixed-window limiter (single process). */
function limiter() {
  const hits = new Map();
  return (key, max, windowMs) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr); return true;
  };
}

/**
 * @param {{ store: ReturnType<import("./store.mjs").memoryStore>, mediaDir: string, secret: string }} deps
 */
export function createApp({ store, mediaDir, secret }) {
  if (!secret || secret.length < 32) throw new Error("FAMILY_MEDIA_SECRET must be >= 32 chars");
  const allow = limiter();
  const seen = new Map(); // signature -> expiry (replay guard)
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

  const readBody = (req, max) => new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > max) { reject(Object.assign(new Error("too_large"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

  async function handle(req, res) {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/healthz") return reply(res, 200, { ok: true });

    const isUpload = req.method === "POST" && url.pathname === "/media";
    const body = await readBody(req, isUpload ? MAX_BYTES + 1024 : MAX_JSON);
    const auth = verify(req, body);
    if (!auth) { console.warn("[media] rejected: bad signature"); return reply(res, 401, { error: "unauthorized" }); }
    const who = parseActor(auth.actor);
    const writes = req.method !== "GET";
    if (!who || (writes && !who.email)) return reply(res, 403, { error: "actor_required" });
    const actor = who.email, editor = who.role === "editor";
    if (writes && !allow(`w:${actor}`, isUpload ? 120 : 600, 3600_000)) return reply(res, 429, { error: "rate_limited" });
    // Reads are limited per viewer too, so one session cannot exhaust the shared budget.
    if (!writes && actor && !allow(`r:${actor}`, 3000, 3600_000)) return reply(res, 429, { error: "rate_limited" });
    if (!allow("all", 20000, 3600_000)) return reply(res, 429, { error: "rate_limited" });

    // GET /content?state=published|draft
    if (req.method === "GET" && url.pathname === "/content") {
      const state = url.searchParams.get("state");
      // dims: [width, height] per referenced file, so pages can lay photos out before they load.
      const dims = (...docs) => store.mediaDims([...new Set(docs.flatMap((d) => [...referencedMedia(d)]))]);
      if (state === "draft") {
        const content = await store.getDraft(), published = await store.getPublished();
        if (editor) {
          // The editor works on the draft with her own open proposals laid over it.
          const mine = { persons: {}, events: {} };
          for (const r of await store.revisions({ state: "pending", author: actor })) { const [k, id] = r.key.split(":"); (k === "person" ? mine.persons : mine.events)[id] = r.after; }
          return reply(res, 200, { content, published, mine, dims: await dims(content, published.content, mine) });
        }
        return reply(res, 200, { content, published, pending: (await store.pendingStats(null)).pending, dims: await dims(content, published.content) });
      }
      if (state === "published") { const pub = await store.getPublished(); return reply(res, 200, { ...pub, dims: await dims(pub.content) }); }
      return reply(res, 400, { error: "bad_state" });
    }

    // The owner's own paths. An editor never writes the draft, publishes, undoes or reads the audit (who did what).
    const ownerOnly = (req.method === "PUT" && url.pathname.startsWith("/draft/")) || (req.method === "POST" && ["/undo", "/publish"].includes(url.pathname))
      || url.pathname === "/audit" || /^\/revisions\/([^/]+\/(approve|reject)|approve-all)$/.test(url.pathname) || (req.method === "GET" && url.pathname === "/revisions" && url.searchParams.get("scope") === "pending");
    if (editor && ownerOnly) return reply(res, 403, { error: "owner_only" });

    // POST /revisions/:kind/:key — an editor proposes a key's new body (a later save updates the same proposal)
    const pr = url.pathname.match(/^\/revisions\/(person|event)\/([^/]+)$/);
    if (req.method === "POST" && pr) {
      if (!editor) return reply(res, 403, { error: "owner_edits_directly" });
      if (!KEY_RE.test(pr[2])) return reply(res, 400, { error: "bad_key" });
      let parsed; try { parsed = JSON.parse(body.toString("utf8")); } catch { return reply(res, 400, { error: "bad_json" }); }
      let clean; try { clean = pr[1] === "person" ? validatePerson(parsed) : validateEvent(parsed); } catch (e) { return reply(res, 422, { error: "invalid", detail: String(e.message) }); }
      for (const id of keyMedia(`${pr[1]}:${pr[2]}`, clean)) {
        const info = await store.mediaInfo(id);
        // an editor may use published/approved files and her own hidden uploads — never another editor's
        if (!info || (info.pending && info.created_by !== actor)) return reply(res, 422, { error: "invalid", detail: "unknown media id" });
      }
      return reply(res, 200, { ok: true, ...(await store.propose(`${pr[1]}:${pr[2]}`, clean, actor)), saved: clean });
    }
    // GET /revisions?scope=mine (editor: her own, every state) | scope=pending (owner: everything waiting)
    if (req.method === "GET" && url.pathname === "/revisions") {
      const scope = url.searchParams.get("scope");
      if (scope === "mine" && editor) return reply(res, 200, { revisions: (await store.revisions({ author: actor, limit: 50 })).map(({ author, decided_by, ...r }) => r) });
      if (scope === "pending" && !editor) {
        const rows = (await store.revisions({ state: "pending" })).reverse(), draft = await store.getDraft();
        const cur = (key) => { const [k, id] = key.split(":"); return (k === "person" ? draft.persons : draft.events)[id] ?? null; };
        return reply(res, 200, { revisions: rows.map((r) => ({ ...r, stale: JSON.stringify(cur(r.key)) !== JSON.stringify(r.before) })),
          dims: await store.mediaDims([...new Set(rows.flatMap((r) => [...keyMedia(r.key, r.after), ...keyMedia(r.key, r.before)]))]) });
      }
      return reply(res, 400, { error: "bad_scope" });
    }
    // POST /revisions/:id/approve | reject {comment} | withdraw · POST /revisions/approve-all
    const rv = url.pathname.match(/^\/revisions\/([^/]+)\/(approve|reject|withdraw)$/);
    if (req.method === "POST" && rv) {
      if (!UUID_RE.test(rv[1])) return reply(res, 404, { error: "not_found" });
      if (rv[2] === "withdraw") return (editor && (await store.withdraw(rv[1], actor))) ? reply(res, 200, { ok: true }) : reply(res, editor ? 404 : 403, { error: editor ? "not_found" : "editor_only" });
      const rev = await store.getRevision(rv[1]);
      if (!rev || rev.state !== "pending") return reply(res, 404, { error: "not_found" });
      if (rev.author === actor) return reply(res, 403, { error: "not_own_approval" }); // never one's own change
      if (rv[2] === "reject") {
        let c = ""; try { c = String(JSON.parse(body.toString("utf8") || "{}").comment ?? "").trim(); } catch { return reply(res, 400, { error: "bad_json" }); }
        if (c.length > 500) return reply(res, 400, { error: "bad_comment" });
        await store.reject(rv[1], actor, c || null);
        return reply(res, 200, { ok: true });
      }
      const out = await store.approve(rv[1], actor);
      if (!out) return reply(res, 404, { error: "not_found" });
      await store.publish(actor); // approval runs the normal publish path
      return reply(res, 200, { ok: true, stale: out.stale });
    }
    if (req.method === "POST" && url.pathname === "/revisions/approve-all") {
      const rows = (await store.revisions({ state: "pending" })).reverse().filter((r) => r.author !== actor);
      let n = 0; for (const r of rows) if (await store.approve(r.id, actor)) n++;
      if (n) await store.publish(actor);
      return reply(res, 200, { ok: true, approved: n });
    }

    // PUT /draft/person/:id | /draft/event/:id
    const m = url.pathname.match(/^\/draft\/(person|event)\/([^/]+)$/);
    if (req.method === "PUT" && m) {
      if (!KEY_RE.test(m[2])) return reply(res, 400, { error: "bad_key" });
      let parsed;
      try { parsed = JSON.parse(body.toString("utf8")); } catch { return reply(res, 400, { error: "bad_json" }); }
      let clean;
      try { clean = m[1] === "person" ? validatePerson(parsed) : validateEvent(parsed); }
      catch (e) { return reply(res, 422, { error: "invalid", detail: String(e.message) }); }
      for (const id of referencedMedia({ persons: { x: m[1] === "person" ? clean : {} }, events: { x: m[1] === "event" ? clean : {} } })) {
        if (!(await store.hasMedia(id))) return reply(res, 422, { error: "invalid", detail: "unknown media id" });
      }
      await store.saveDraft(`${m[1]}:${m[2]}`, clean, actor);
      return reply(res, 200, { ok: true, saved: clean });
    }

    if (req.method === "POST" && url.pathname === "/undo") return reply(res, 200, { ok: true, undone: await store.undo(actor) });
    if (req.method === "POST" && url.pathname === "/publish") { await store.publish(actor); return reply(res, 200, { ok: true }); }
    if (req.method === "GET" && url.pathname === "/audit") return reply(res, 200, { entries: await store.audit(50) });

    // POST /media  (raw image bytes)
    if (isUpload) {
      let out;
      try { out = await processImage(body); }
      catch (e) { return reply(res, e.status ?? 422, { error: e.status ? e.message : "unreadable" }); }
      const id = randomUUID();
      const dir = join(mediaDir, id);
      await mkdir(dir, { recursive: true, mode: 0o700 });
      for (const [name, buf] of Object.entries(out.variants)) await writeFile(join(dir, name), buf, { mode: 0o600 });
      await store.addMedia({ id, width: out.width, height: out.height, bytes: body.length }, actor, editor); // an editor's upload stays hidden
      return reply(res, 201, { id, width: out.width, height: out.height });
    }

    // GET /media/:id/:variant?scope=published|admin
    const mm = url.pathname.match(/^\/media\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && mm) {
      if (!UUID_RE.test(mm[1]) || !VARIANT_RE.test(mm[2])) return reply(res, 404, { error: "not_found" });
      const scope = url.searchParams.get("scope");
      if (scope === "admin" && editor) {
        // An editor previews published/approved files and her own hidden uploads only.
        const info = await store.mediaInfo(mm[1]);
        if (!info || (info.pending && info.created_by !== actor)) return reply(res, 404, { error: "not_found" });
      } else if (scope !== "admin") {
        const pub = await store.getPublished();
        if (!referencedMedia(pub.content).has(mm[1])) return reply(res, 404, { error: "not_found" });
      }
      let buf;
      try { buf = await readFile(join(mediaDir, mm[1], mm[2])); } catch { return reply(res, 404, { error: "not_found" }); }
      res.writeHead(200, { "content-type": TYPES[mm[2].split(".")[1]], "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-length": buf.length });
      return res.end(buf);
    }

    return reply(res, 404, { error: "not_found" });
  }

  return (req, res) => handle(req, res).catch((e) => {
    console.error(`[media] error ${e?.status ?? 500}`);
    if (!res.headersSent) reply(res, e?.status ?? 500, { error: e?.status === 413 ? "too_large" : "server_error" });
  });
}

async function main() {
  const { default: pg } = await import("pg");
  const { pgStore } = await import("./store.mjs");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  const handler = createApp({ store: pgStore(pool), mediaDir: process.env.MEDIA_DIR ?? "/data/media", secret: process.env.FAMILY_MEDIA_SECRET });
  const port = Number(process.env.PORT ?? 8788);
  // One line per request: method, route class, status, duration. Never ids, keys, actors or bodies —
  // person keys can be given names, so every path segment after the route name is dropped.
  const logged = (req, res) => {
    const t0 = Date.now();
    // The container health check hits /healthz every 30 s; leave it out so real traffic stays readable.
    res.on("finish", () => { const r = routeClass(req.url); if (r !== "/healthz") console.log(`[media] ${req.method} ${r} ${res.statusCode} ${Date.now() - t0}ms`); });
    return handler(req, res);
  };
  createServer(logged).listen(port, "0.0.0.0", () => console.log(`[media] listening on ${port}`));
}

/** "/draft/person/<key>?x" → "/draft/:kind/:key"; "/media/<id>/640.webp" → "/media/:id/:variant". */
export function routeClass(url = "") {
  const [first, ...rest] = url.split("?")[0].split("/").filter(Boolean);
  if (!first) return "/";
  const known = ["healthz", "content", "draft", "undo", "publish", "audit", "media", "revisions"];
  if (!known.includes(first)) return "/:other";
  if (first === "draft") return rest.length ? "/draft/:kind/:key" : "/draft";
  if (first === "media") return rest.length ? "/media/:id/:variant" : "/media";
  if (first === "revisions") return rest[0] === "approve-all" ? "/revisions/approve-all" : rest.length === 2 && ["approve", "reject", "withdraw"].includes(rest[1]) ? `/revisions/:id/${rest[1]}` : rest.length === 2 ? "/revisions/:kind/:key" : "/revisions";
  return `/${first}`;
}

// Start only when run directly (`node server.mjs`); importing it (tests) has no side effects.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("[media] start failed", e?.message); process.exit(1); });
}
