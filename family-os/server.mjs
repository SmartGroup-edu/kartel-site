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
import { parseActor, noteKindsFor, checkGrant, NOTE_KINDS, canReadDocuments, canAddDocuments, canSeeBirth, DOC_TYPES } from "./policy.mjs";
import { encryptNote, decryptNote, parseMasterKey, seal, open, sealBytes, openBytes, newDataKey, unwrapDataKey } from "./crypto.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { daysLeft, tier } from "./reminders.mjs";
import { join } from "node:path";

const MAX_SKEW_S = 60;
const MAX_JSON = 32 * 1024;
const MAX_FILE = 10 * 1024 * 1024;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REMIND_DAYS = 365; // documents expiring within 12 months (bus 66)
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

/** @param {{ store: any, secret: string, masterKey: Buffer, filesDir?: string }} deps */
export function createApp({ store, secret, masterKey, filesDir = "/data/docs" }) {
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

  const readBody = (req, max = MAX_JSON) => new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > max) { reject(Object.assign(new Error("too_large"), { status: 413 })); req.destroy(); } else chunks.push(c); });
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

    const isUpload = req.method === "POST" && /^\/documents\/[^/]+\/files$/.test(url.pathname);
    const body = await readBody(req, isUpload ? MAX_FILE + 1024 : MAX_JSON);
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


    // ================= Stage 2a: profiles and documents =================
    const grantsNow = () => store.listGrants();

    // GET /people/:id — profile: name, role, guardians; birth date + age only for self/guardians/admin
    const pm = path.match(/^\/people\/([^/]+)$/);
    if (pm && req.method === "GET") {
      if (!UUID_RE.test(pm[1])) return reply(res, 400, { error: "bad_id" });
      if (!me && !admin) return reply(res, 403, { error: "not_a_member" });
      const subject = await store.getPerson(pm[1]);
      if (!subject) return reply(res, 404, { error: "not_found" });
      const grants = await grantsNow();
      const birth = canSeeBirth(me, subject, grants, admin) ? (subject.birth_date ? String(subject.birth_date instanceof Date ? subject.birth_date.toISOString().slice(0, 10) : subject.birth_date) : null) : undefined;
      return reply(res, 200, {
        person: { id: subject.id, name_en: subject.name_en, name_ru: subject.name_ru, kind: subject.kind, ...(birth !== undefined ? { birth_date: birth } : {}) },
        guardians: grants.filter((g) => g.child_id === subject.id).map((g) => ({ guardian_id: g.guardian_id, relation: g.relation })),
        can: { documents: canReadDocuments(me, subject, grants), add_documents: canAddDocuments(me, subject, grants, admin) },
      });
    }
    // PATCH /people/:id (admin) — { birth_date }
    if (pm && req.method === "PATCH") {
      if (!admin) return reply(res, 403, { error: "admin_only" });
      const b = json(body);
      if (!UUID_RE.test(pm[1]) || !(b?.birth_date === null || DATE_RE.test(b?.birth_date ?? ""))) return reply(res, 400, { error: "bad_request" });
      return (await store.setBirthDate(pm[1], b.birth_date, who.email)) ? reply(res, 200, { ok: true }) : reply(res, 404, { error: "not_found" });
    }

    const docView = (d) => {
      const dek = unwrapDataKey(kek, d.wrapped_key, "doc", d.id);
      try {
        return { id: d.id, type: d.type, country: d.country, issue_date: d.issue_date ? String(d.issue_date instanceof Date ? d.issue_date.toISOString().slice(0, 10) : d.issue_date) : null,
          expiry_date: d.expiry_date ? String(d.expiry_date instanceof Date ? d.expiry_date.toISOString().slice(0, 10) : d.expiry_date) : null,
          number_hint: d.number_hint, has_number: Boolean(d.number_ct), has_pcode: Boolean(d.pcode_ct),
          fields: JSON.parse(open(dek, d.fields_ct, `fields:${d.id}`).toString("utf8")) };
      } finally { dek.fill(0); }
    };
    const filesView = async (d) => (await store.listFiles(d.id)).map((f) => {
      const k = unwrapDataKey(kek, f.wrapped_key, "file", f.id);
      try { return { id: f.id, mime: f.mime, size: f.size, name: open(k, f.name_ct, `name:${f.id}`).toString("utf8") }; } finally { k.fill(0); }
    });

    /** Build an encrypted document row from the request body. Residence documents: type + files only. */
    const buildDocument = (b, extra) => {
      const id = randomUUID();
      const type = b?.type;
      if (!DOC_TYPES.includes(type)) return { error: "bad_type" };
      const residence = type === "residence";
      const str = (v, max) => (typeof v === "string" && v.length <= max ? v.trim() : "");
      const date = (v) => (DATE_RE.test(v ?? "") ? v : null);
      const number = residence ? "" : str(b?.number, 60), pcode = residence ? "" : str(b?.personal_code, 60);
      const fields = residence ? {} : { authority: str(b?.authority, 120), holder: str(b?.holder, 200), birth_date: date(b?.birth_date), birth_place: str(b?.birth_place, 120), sex: str(b?.sex, 10), nationality: str(b?.nationality, 60) };
      const { dek, wrapped } = newDataKey(kek, "doc", id);
      try {
        return { row: { id, ...extra, type, country: residence ? str(b?.country, 60) || null : str(b?.country, 60) || null,
          issue_date: residence ? null : date(b?.issue_date), expiry_date: date(b?.expiry_date),
          number_hint: number ? number.slice(-3) : null, wrapped_key: wrapped,
          fields_ct: seal(dek, Buffer.from(JSON.stringify(fields)), `fields:${id}`),
          number_ct: number ? seal(dek, Buffer.from(number), `number:${id}`) : null,
          pcode_ct: pcode ? seal(dek, Buffer.from(pcode), `pcode:${id}`) : null } };
      } finally { dek.fill(0); }
    };

    // GET|POST /people/:id/documents
    const dm = path.match(/^\/people\/([^/]+)\/documents$/);
    if (dm && (req.method === "GET" || req.method === "POST")) {
      if (!UUID_RE.test(dm[1])) return reply(res, 400, { error: "bad_id" });
      const subject = await store.getPerson(dm[1]);
      if (!subject) return reply(res, 404, { error: "not_found" });
      const grants = await grantsNow();
      if (req.method === "GET") {
        if (!canReadDocuments(me, subject, grants)) return reply(res, 403, { error: "forbidden" });
        if (!(await logged(res, { actor: who.email, subject: subject.id, entity: "documents:list", action: "read" }))) return;
        const docs = await store.listDocuments(subject.id);
        return reply(res, 200, { documents: await Promise.all(docs.map(async (d) => ({ ...docView(d), files: await filesView(d) }))) });
      }
      if (!canAddDocuments(me, subject, grants, admin)) return reply(res, 403, { error: "forbidden" });
      const built = buildDocument(json(body), { person_id: subject.id, archive: false });
      if (built.error) return reply(res, 400, { error: built.error });
      if (!(await logged(res, { actor: who.email, subject: subject.id, entity: `document:${built.row.type}`, action: "write" }))) return;
      await store.createDocument(built.row, who.email);
      return reply(res, 201, { id: built.row.id });
    }

    // GET|POST /archive/documents — heritage archive records (not people): admin only
    if (path === "/archive/documents" && (req.method === "GET" || req.method === "POST")) {
      if (!admin) return reply(res, 403, { error: "admin_only" });
      if (req.method === "GET") {
        const docs = await store.listArchiveDocuments();
        return reply(res, 200, { documents: await Promise.all(docs.map(async (d) => ({ ...docView(d), files: await filesView(d) }))) });
      }
      const built = buildDocument(json(body), { person_id: null, archive: true });
      if (built.error) return reply(res, 400, { error: built.error });
      await store.createDocument(built.row, who.email);
      return reply(res, 201, { id: built.row.id });
    }

    /** Resolve a document and decide access: { doc, subject, read, add } */
    const docAccess = async (id) => {
      if (!UUID_RE.test(id)) return null;
      const doc = await store.getDocument(id);
      if (!doc) return null;
      if (doc.archive) return { doc, subject: null, read: admin, add: admin };
      const subject = await store.getPerson(doc.person_id), grants = await grantsNow();
      return { doc, subject, read: canReadDocuments(me, subject, grants), add: canAddDocuments(me, subject, grants, admin) };
    };

    // POST /documents/:id/files — raw bytes; x-file-name (base64url of the UTF-8 name)
    const fm = path.match(/^\/documents\/([^/]+)\/files$/);
    if (fm && req.method === "POST") {
      const a = await docAccess(fm[1]);
      if (!a) return reply(res, 404, { error: "not_found" });
      if (!a.add) return reply(res, 403, { error: "forbidden" });
      let bytes = body;
      if (bytes.length === 0 || bytes.length > MAX_FILE) return reply(res, 413, { error: "too_large" });
      const mime = sniffDoc(bytes);
      if (!mime) return reply(res, 415, { error: "unsupported_type" });
      if (mime === "image/jpeg" || mime === "image/png") bytes = await stripImage(bytes, mime); // no EXIF/GPS survives
      const name = Buffer.from(String(req.headers["x-file-name"] ?? ""), "base64url").toString("utf8").slice(0, 200) || "document";
      if (a.subject && !(await logged(res, { actor: who.email, subject: a.subject.id, entity: "document:file", action: "write" }))) return;
      const id = randomUUID(), { dek, wrapped } = newDataKey(kek, "file", id);
      try {
        await mkdir(filesDir, { recursive: true });
        await writeFile(join(filesDir, id), sealBytes(dek, bytes, `file:${id}`), { mode: 0o600 });
        await store.createFile({ id, document_id: a.doc.id, name_ct: seal(dek, Buffer.from(name), `name:${id}`), mime, size: bytes.length, wrapped_key: wrapped }, who.email);
      } finally { dek.fill(0); }
      return reply(res, 201, { id, mime });
    }

    // GET /documents/:id/files/:fid — decrypted bytes, only through the logged read path
    const ff = path.match(/^\/documents\/([^/]+)\/files\/([^/]+)$/);
    if (ff && req.method === "GET") {
      const a = await docAccess(ff[1]);
      if (!a || !UUID_RE.test(ff[2])) return reply(res, 404, { error: "not_found" });
      if (!a.read) return reply(res, 403, { error: "forbidden" });
      const f = await store.getFile(ff[2]);
      if (!f || f.document_id !== a.doc.id) return reply(res, 404, { error: "not_found" });
      if (a.subject && !(await logged(res, { actor: who.email, subject: a.subject.id, entity: "document:file", action: "read" }))) return;
      const k = unwrapDataKey(kek, f.wrapped_key, "file", f.id);
      try {
        const { readFile: rf } = await import("node:fs/promises");
        const plain = openBytes(k, await rf(join(filesDir, f.id)), `file:${f.id}`);
        res.writeHead(200, { "content-type": f.mime, "content-length": plain.length, "cache-control": "no-store", "x-content-type-options": "nosniff" });
        return res.end(plain);
      } finally { k.fill(0); }
    }

    // POST /documents/:id/reveal {field} · POST /documents/:id/copied {field} — both logged
    const rm = path.match(/^\/documents\/([^/]+)\/(reveal|copied)$/);
    if (rm && req.method === "POST") {
      const a = await docAccess(rm[1]);
      if (!a) return reply(res, 404, { error: "not_found" });
      if (!a.read) return reply(res, 403, { error: "forbidden" });
      const field = json(body)?.field;
      const col = field === "number" ? "number_ct" : field === "personal_code" ? "pcode_ct" : null;
      if (!col || !a.doc[col]) return reply(res, 400, { error: "bad_field" });
      const action = rm[2] === "reveal" ? "reveal" : "copy";
      if (a.subject && !(await logged(res, { actor: who.email, subject: a.subject.id, entity: `document:${field}`, action }))) return;
      if (action === "copy") return reply(res, 200, { ok: true });
      const dek = unwrapDataKey(kek, a.doc.wrapped_key, "doc", a.doc.id);
      try { return reply(res, 200, { value: open(dek, a.doc[col], `${field === "number" ? "number" : "pcode"}:${a.doc.id}`).toString("utf8") }); }
      finally { dek.fill(0); }
    }

    // GET /reminders — documents expiring within 12 months (or expired) for people I may read.
    // ?scope=family (admin): the whole family's upcoming expiries — type, person, date only.
    if (req.method === "GET" && path === "/reminders") {
      const family = url.searchParams.get("scope") === "family";
      if (family && !admin) return reply(res, 403, { error: "admin_only" });
      if (!me && !family) return reply(res, 200, { reminders: [] });
      const [people, grants] = await Promise.all([store.listPeople(), grantsNow()]);
      const readable = family ? people : people.filter((p) => canReadDocuments(me, p, grants));
      const until = new Date(Date.now() + REMIND_DAYS * 86400_000).toISOString().slice(0, 10);
      const rows = await store.listExpiring(readable.map((p) => p.id), until);
      for (const pid of [...new Set(rows.map((r) => r.person_id))]) {
        if (!(await logged(res, { actor: who.email, subject: pid, entity: family ? "documents:family-overview" : "documents:reminders", action: "read" }))) return;
      }
      const today = new Date();
      return reply(res, 200, { reminders: rows.map((r) => {
        const expiry = String(r.expiry_date instanceof Date ? r.expiry_date.toISOString().slice(0, 10) : r.expiry_date);
        const d = daysLeft(expiry, today);
        return { id: r.id, person_id: r.person_id, type: r.type, country: r.country, expiry_date: expiry, days_left: d, tier: tier(d) };
      }) });
    }
    return reply(res, 404, { error: "not_found" });
  }

  return (req, res) => handle(req, res).catch((e) => {
    console.error(`[os] error ${e?.status ?? 500}`);
    if (!res.headersSent) reply(res, e?.status ?? 500, { error: e?.status === 413 ? "too_large" : "server_error" });
  });
}


/** PDF / JPEG / PNG / HEIC by magic bytes; anything else is refused. */
export function sniffDoc(b) {
  if (!Buffer.isBuffer(b) || b.length < 12) return null;
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(4, 8).toString("latin1") === "ftyp" && ["heic", "heix", "mif1", "msf1"].includes(b.subarray(8, 12).toString("latin1"))) return "image/heic";
  return null;
}

/** Re-encode JPEG/PNG: EXIF orientation applied, every metadata block (EXIF/GPS/XMP/ICC) dropped. */
async function stripImage(buf, mime) {
  const { default: sharp } = await import("sharp");
  const img = sharp(buf, { limitInputPixels: 60_000_000, failOn: "error" }).rotate();
  return mime === "image/png" ? img.png().toBuffer() : img.jpeg({ quality: 92 }).toBuffer();
}

/** "/people/<uuid>/notes" → "/people/:id/notes" — logs never carry ids, emails or text. */
export function routeClass(url = "") {
  const p = url.split("?")[0];
  if (p === "/healthz" || p === "/me" || p === "/people" || p === "/grants") return p;
  if (/^\/grants\/[^/]+$/.test(p)) return "/grants/:id";
  if (/^\/people\/[^/]+\/notes$/.test(p)) return "/people/:id/notes";
  if (/^\/people\/[^/]+\/documents$/.test(p)) return "/people/:id/documents";
  if (/^\/people\/[^/]+$/.test(p)) return "/people/:id";
  if (/^\/documents\/[^/]+\/files(\/[^/]+)?$/.test(p)) return "/documents/:id/files";
  if (/^\/documents\/[^/]+\/(reveal|copied)$/.test(p)) return "/documents/:id/" + p.split("/").pop();
  if (p === "/reminders" || p === "/archive/documents") return p;
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
  const handler = createApp({ store: pgStore(pool), secret: process.env.FAMILY_OS_SECRET, masterKey, filesDir: process.env.FAMILY_OS_FILES_DIR ?? "/data/docs" });
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
