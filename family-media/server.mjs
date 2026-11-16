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
import { processImage, WIDTHS, FORMATS, MAX_BYTES } from "./images.mjs";

const MAX_SKEW_S = 60;
const MAX_JSON = 64 * 1024;
const VARIANT_RE = new RegExp(`^(${WIDTHS.join("|")})\\.(${FORMATS.join("|")})$`);
const TYPES = { webp: "image/webp", avif: "image/avif" };

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
    const { actor } = auth;
    const writes = req.method !== "GET";
    if (writes && !/^[^\s@]+@[^\s@]+$/.test(actor)) return reply(res, 403, { error: "actor_required" });
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
        return reply(res, 200, { content, published, dims: await dims(content, published.content) });
      }
      if (state === "published") { const pub = await store.getPublished(); return reply(res, 200, { ...pub, dims: await dims(pub.content) }); }
      return reply(res, 400, { error: "bad_state" });
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
      await store.addMedia({ id, width: out.width, height: out.height, bytes: body.length }, actor);
      return reply(res, 201, { id, width: out.width, height: out.height });
    }

    // GET /media/:id/:variant?scope=published|admin
    const mm = url.pathname.match(/^\/media\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && mm) {
      if (!UUID_RE.test(mm[1]) || !VARIANT_RE.test(mm[2])) return reply(res, 404, { error: "not_found" });
      const scope = url.searchParams.get("scope");
      if (scope !== "admin") {
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
  const known = ["healthz", "content", "draft", "undo", "publish", "audit", "media"];
  if (!known.includes(first)) return "/:other";
  if (first === "draft") return rest.length ? "/draft/:kind/:key" : "/draft";
  if (first === "media") return rest.length ? "/media/:id/:variant" : "/media";
  return `/${first}`;
}

// Start only when run directly (`node server.mjs`); importing it (tests) has no side effects.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("[media] start failed", e?.message); process.exit(1); });
}
