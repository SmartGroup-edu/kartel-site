// kartel-family-os — the Family OS service (plan v3, Stage 1): people, roles, guardian grants and
// encrypted care notes with an append-only read log. Same pattern as family-media: private network,
// reached only through a Cloudflare tunnel (+ Access), every request HMAC-signed by kartel-site.
//
// The actor header is "admin:<email>" or "member:<email>"; it is covered by the signature, so only the
// site can say who is asking. Logs carry method, route class, status — never emails, names or text.
import { createServer } from "node:http";
import { createHmac, createHash, timingSafeEqual, randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseActor, noteKindsFor, checkGrant, NOTE_KINDS, SCOPES, canReadDocuments, canAddDocuments, canSeeBirth, DOC_TYPES, routineAccess, canSeeGuardians, ROUTINE_KINDS, canEditPrefs,
  canReadCouncil, canWriteCouncil, canTickTask, GOAL_SPHERES, goalVisibilities, canReadGoal, canWriteGoal, canWriteEvent, canSeeBirthday, canSeeBirthdayDayMonth } from "./policy.mjs";
import { councilDate, weekStart, buildAgenda, calendarItems, buildIcs, councilStatus } from "./council.mjs";
import { canMove, allowedActions, nextState, isParent, progress, sprintProgress, validMask, participants, needsDecision, nudgeDue, sortMinute, DECLINE_CODES, WHEN_SLOTS, MAX_PARTICIPANTS, CARRY_TIME, PLAN_TIME } from "./board.mjs";
import { buildDayPlan } from "./board-jobs.mjs";
import { rotationAssignee, pausedOn, DEFAULT_PREFS, localParts } from "./engine.mjs";
import { parseRule, occursOn, occurrences, streak, localDate, addDays } from "./recur.mjs";
import { stripHeifMetadata } from "./heif.mjs";
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
export function createApp({ store, secret, masterKey, filesDir = "/data/docs", clock = () => new Date() }) {
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

  /**
   * Birthdays a viewer may see (bus 81): every living member's day + month for any member; the year only
   * where the full birth-date rule allows. `person` holds living family members only — the heritage
   * (deceased) people live in the heritage store, never here.
   */
  const birthdayRows = (viewer, people, grants) => (canSeeBirthdayDayMonth(viewer) ? people : [])
    .filter((p) => p && p.birth_date)
    .map((p) => { const b = String(p.birth_date instanceof Date ? p.birth_date.toISOString().slice(0, 10) : p.birth_date);
      return { id: p.id, name_ru: p.name_ru, name_en: p.name_en, md: b.slice(5), year: canSeeBirthday(viewer, p, grants) ? Number(b.slice(0, 4)) : null }; });

  /** The person's own feed: their routines and turns, the council, family events, birthdays they may see. */
  async function serveIcs(res, person) {
    const today = localDate(clock());
    const [routines, rotations, events, people, grants] = await Promise.all([store.listRoutines(person.id), store.listRotations(), store.listEvents(today, addDays(today, 365)), store.listPeople(), store.listGrants()]);
    const full = await Promise.all(people.map((p) => store.getPerson(p.id)));
    const birthdayPeople = birthdayRows(person, full, grants).map((b) => ({ ...b, year: null })); // the feed never carries a year
    const stamp = new Date(clock()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = buildIcs({ today, stamp, calName: "KARTEL · Семья", routines, rotations: rotations.filter((x) => x.members.includes(person.id)), personId: person.id, events, birthdayPeople, nameOf: (p) => p.name_ru, labels: { council: "Семейный совет", birthday: "День рождения" } });
    res.writeHead(200, { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    return res.end(ics);
  }

  async function handle(req, res) {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/healthz") return reply(res, 200, { ok: true });

    const isUpload = req.method === "POST" && /^\/documents\/[^/]+\/files$/.test(url.pathname);
    const body = await readBody(req, isUpload ? MAX_FILE + 1024 : MAX_JSON);
    const auth = verify(req, body);
    if (!auth) { console.warn("[os] rejected: bad signature"); return reply(res, 401, { error: "unauthorized" }); }
    // GET /ics/:token — the personal calendar feed. Only the site may ask (actor "system:ics", signed);
    // the token itself is the person's credential, stored here only as its SHA-256.
    const icsM = req.method === "GET" && url.pathname.match(/^\/ics\/([A-Za-z0-9_-]{43})$/);
    if (icsM) {
      if (auth.actor !== "system:ics") return reply(res, 403, { error: "forbidden" });
      if (!allow("ics", 600, 3600_000)) return reply(res, 429, { error: "rate_limited" });
      const person = await store.personByIcs(sha256(icsM[1]));
      if (!person) return reply(res, 404, { error: "not_found" });
      return serveIcs(res, person);
    }
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
    // PATCH /grants/:id (admin) — { scopes }
    const gm = path.match(/^\/grants\/([^/]+)$/);
    if (req.method === "PATCH" && gm) {
      if (!admin) return reply(res, 403, { error: "admin_only" });
      const scopes = json(body)?.scopes;
      if (!UUID_RE.test(gm[1])) return reply(res, 400, { error: "bad_id" });
      if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some((x) => !SCOPES.includes(x)) || new Set(scopes).size !== scopes.length) return reply(res, 400, { error: "bad_scopes" });
      return (await store.setGrantScopes(gm[1], scopes, who.email)) ? reply(res, 200, { ok: true }) : reply(res, 404, { error: "not_found" });
    }
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
        guardians: canSeeGuardians(me, subject, grants, admin) ? grants.filter((g) => g.child_id === subject.id).map((g) => ({ guardian_id: g.guardian_id, relation: g.relation, scopes: g.scopes })) : [],
        can: { documents: canReadDocuments(me, subject, grants), add_documents: canAddDocuments(me, subject, grants, admin), retype_documents: canAddDocuments(me, subject, grants, admin),
          routines: routineAccess(me, subject, grants), prefs: canEditPrefs(me, subject, grants),
          notes: noteKindsFor(me, subject, grants), goals: canWriteGoal(me, subject), ics: Boolean(me && me.id === subject.id) },
      });
    }
    // PATCH /people/:id (admin) — any of { birth_date, name_en, name_ru, kind }
    if (pm && req.method === "PATCH") {
      if (!admin) return reply(res, 403, { error: "admin_only" });
      const b = json(body);
      if (!UUID_RE.test(pm[1]) || !b || typeof b !== "object") return reply(res, 400, { error: "bad_request" });
      const hasBirth = "birth_date" in b, names = { name_en: text(b.name_en, 200), name_ru: text(b.name_ru, 200), kind: b.kind };
      if (hasBirth && !(b.birth_date === null || DATE_RE.test(b.birth_date ?? ""))) return reply(res, 400, { error: "bad_request" });
      if (("name_en" in b && !names.name_en) || ("name_ru" in b && !names.name_ru) || ("kind" in b && !["adult", "child"].includes(b.kind))) return reply(res, 400, { error: "bad_person" });
      if (!hasBirth && !("name_en" in b) && !("name_ru" in b) && !("kind" in b)) return reply(res, 400, { error: "bad_request" });
      if (!(await store.getPerson(pm[1]))) return reply(res, 404, { error: "not_found" });
      if (hasBirth) await store.setBirthDate(pm[1], b.birth_date, who.email);
      if ("name_en" in b || "name_ru" in b || "kind" in b) await store.updatePerson(pm[1], { name_en: names.name_en, name_ru: names.name_ru, kind: "kind" in b ? b.kind : null }, who.email);
      return reply(res, 200, { ok: true });
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
      if (mime === "image/heic") { // cannot be re-encoded here: zero the Exif/XMP items instead (heif.mjs)
        try { bytes = stripHeifMetadata(bytes).bytes; } catch { return reply(res, 415, { error: "unsupported_type" }); }
      }
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

    // PATCH /documents/:id { type } — fix a document's type (e.g. after import). Same rule as adding.
    const tm = path.match(/^\/documents\/([^/]+)$/);
    if (tm && req.method === "PATCH") {
      const a = await docAccess(tm[1]);
      if (!a) return reply(res, 404, { error: "not_found" });
      if (!a.add) return reply(res, 403, { error: "forbidden" });
      const type = json(body)?.type;
      if (!DOC_TYPES.includes(type)) return reply(res, 400, { error: "bad_type" });
      if (a.subject && !(await logged(res, { actor: who.email, subject: a.subject.id, entity: `document:retype:${type}`, action: "write" }))) return;
      await store.retypeDocument(a.doc.id, type, who.email);
      return reply(res, 200, { ok: true });
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

    // ================= Stage 2: routines and chores =================
    const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
    /** A routine as the screen needs it: due today? done today? gentle streak, next dates. */
    const routineView = (r, checks, today, days, paused = () => false) => {
      const rule = parseRule(r.rrule);
      const done = new Set(checks.filter((c) => c.routine_id === r.id && c.done).map((c) => c.on_date));
      return { id: r.id, kind: r.kind, title: r.title, rrule: r.rrule, dtstart: r.dtstart, at_time: r.at_time,
        due_today: occursOn(rule, r.dtstart, today) && !paused(today), done_today: done.has(today),
        done_recent: [...done].filter((d) => d >= addDays(today, -2)).sort(),
        streak: streak(rule, r.dtstart, done, today, 400, paused), next: occurrences(rule, r.dtstart, addDays(today, 1), addDays(today, days), 10).filter((d) => !paused(d)) };
    };
    /** A rotation as seen by one member: their turns (today + next days). kind "rotation". */
    const rotationView = (x, personId, rchecks, today, days, paused = () => false) => {
      const mine = (d) => rotationAssignee(x, d) === personId && !paused(d);
      const nextDays = Array.from({ length: days }, (_, i) => addDays(today, i + 1)).filter(mine);
      const doneToday = rchecks.some((c) => c.rotation_id === x.id && c.on_date === today && c.done);
      return { id: x.id, kind: "rotation", title: x.title, rrule: x.rrule, dtstart: x.dtstart, at_time: x.at_time, members: x.members.length,
        due_today: mine(today), done_today: doneToday, done_recent: [], streak: 0, next: nextDays };
    };
    /** Best-effort event (the bus feeds Stage 3 rules); a write never fails because of it. */
    const emit = async (type, subject, ref) => { try { await store.emit(type, who.email, subject, ref); } catch { console.error("[os] event emit failed"); } };

    // GET|POST /people/:id/routines — GET ?days=1..14 (upcoming window, default 7)
    const rtm = path.match(/^\/people\/([^/]+)\/routines$/);
    if (rtm && (req.method === "GET" || req.method === "POST")) {
      if (!UUID_RE.test(rtm[1])) return reply(res, 400, { error: "bad_id" });
      const subject = await store.getPerson(rtm[1]);
      if (!subject) return reply(res, 404, { error: "not_found" });
      const can = routineAccess(me, subject, await grantsNow());
      const other = me && me.id !== subject.id; // reads/writes of someone else's routines are logged
      const today = localDate(clock());
      if (req.method === "GET") {
        if (!can.read) return reply(res, 403, { error: "forbidden", reason: can.reason });
        const days = Math.min(14, Math.max(1, Number(url.searchParams.get("days") ?? 7) || 7));
        if (other && !(await logged(res, { actor: who.email, subject: subject.id, entity: "routines:list", action: "read" }))) return;
        const [rows, pauses, rots] = await Promise.all([store.listRoutines(subject.id), store.listPauses(subject.id), store.listRotations()]);
        const checks = await store.listChecks(rows.map((r) => r.id), addDays(today, -400));
        const myRots = rots.filter((x) => x.members.includes(subject.id));
        const rchecks = await store.listRotationChecks(myRots.map((x) => x.id), addDays(today, -2));
        const paused = (d) => pausedOn(pauses, subject.id, d);
        return reply(res, 200, { today, can, paused_today: paused(today),
          routines: [...rows.map((r) => routineView(r, checks, today, days, paused)), ...myRots.map((x) => rotationView(x, subject.id, rchecks, today, days, paused))] });
      }
      if (!can.manage) return reply(res, 403, { error: "forbidden", reason: can.reason ?? "child_cannot_manage" });
      const b = json(body);
      const r = { id: randomUUID(), person_id: subject.id, kind: b?.kind, title: text(b?.title, 120), rrule: typeof b?.rrule === "string" ? b.rrule : "",
        dtstart: b?.dtstart ?? today, at_time: b?.at_time ? String(b.at_time) : null };
      // bus 85: one model — routines are personal habits; anything assigned is a task (templates on the board)
      if (r.kind === "chore") return reply(res, 400, { error: "use_templates" });
      if (!ROUTINE_KINDS.includes(r.kind) || !r.title || !parseRule(r.rrule) || !DATE_RE.test(r.dtstart) || (r.at_time && !TIME_RE.test(r.at_time))) return reply(res, 400, { error: "bad_routine" });
      if (other && !(await logged(res, { actor: who.email, subject: subject.id, entity: `routine:${r.kind}`, action: "write" }))) return;
      await store.createRoutine(r, who.email);
      await emit("routine.created", subject.id, r.id);
      return reply(res, 201, { id: r.id });
    }

    /** Resolve a routine and the caller's rights on its person. */
    const routineFor = async (id) => {
      if (!UUID_RE.test(id)) return null;
      const r = await store.getRoutine(id);
      if (!r || r.archived_at) return null;
      const subject = await store.getPerson(r.person_id);
      return { r, subject, can: routineAccess(me, subject, await grantsNow()), other: Boolean(me && me.id !== subject.id) };
    };

    // PATCH /routines/:id — { title?, rrule?, at_time?, archived? }
    const rpm = path.match(/^\/routines\/([^/]+)$/);
    if (rpm && req.method === "PATCH") {
      const x = await routineFor(rpm[1]);
      if (!x) return reply(res, 404, { error: "not_found" });
      if (!x.can.manage) return reply(res, 403, { error: "forbidden", reason: x.can.reason ?? "child_cannot_manage" });
      const b = json(body) ?? {};
      const patch = {};
      if ("title" in b) { patch.title = text(b.title, 120); if (!patch.title) return reply(res, 400, { error: "bad_routine" }); }
      if ("rrule" in b) { if (!parseRule(b.rrule)) return reply(res, 400, { error: "bad_routine" }); patch.rrule = b.rrule; }
      if ("at_time" in b) { if (b.at_time !== null && !TIME_RE.test(String(b.at_time))) return reply(res, 400, { error: "bad_routine" }); patch.at_time = b.at_time; }
      if (b.archived === true) patch.archived = true;
      if (!Object.keys(patch).length) return reply(res, 400, { error: "bad_routine" });
      if (x.other && !(await logged(res, { actor: who.email, subject: x.subject.id, entity: patch.archived ? "routine:archive" : "routine:update", action: "write" }))) return;
      if (!(await store.updateRoutine(x.r.id, patch, who.email))) return reply(res, 404, { error: "not_found" });
      await emit(patch.archived ? "routine.archived" : "routine.updated", x.subject.id, x.r.id);
      return reply(res, 200, { ok: true });
    }

    // POST /routines/:id/check — { date, done } for today or the two days before (late ticks happen)
    const rcm = path.match(/^\/routines\/([^/]+)\/check$/);
    if (rcm && req.method === "POST") {
      const x = await routineFor(rcm[1]);
      if (!x) return reply(res, 404, { error: "not_found" });
      if (!x.can.check) return reply(res, 403, { error: "forbidden", reason: x.can.reason });
      const b = json(body), today = localDate(clock());
      const date = b?.date ?? today;
      if (!DATE_RE.test(date) || date > today || date < addDays(today, -2) || typeof b?.done !== "boolean") return reply(res, 400, { error: "bad_check" });
      if (!occursOn(parseRule(x.r.rrule), x.r.dtstart, date)) return reply(res, 400, { error: "not_scheduled" });
      if (x.other && !(await logged(res, { actor: who.email, subject: x.subject.id, entity: "routine:check", action: "write" }))) return;
      await store.addCheck(x.r.id, date, b.done, who.email);
      await emit(b.done ? "routine.checked" : "routine.unchecked", x.subject.id, x.r.id);
      return reply(res, 200, { ok: true });
    }

    // ================= Stage 3a: settings, pauses, rotations, rules =================
    const personFor = async (id) => (UUID_RE.test(id) ? store.getPerson(id) : null);

    // GET|PUT /people/:id/prefs — email on/off, digest time, evening check-in, language
    const pfm = path.match(/^\/people\/([^/]+)\/prefs$/);
    if (pfm && (req.method === "GET" || req.method === "PUT")) {
      const subject = await personFor(pfm[1]);
      if (!subject) return reply(res, 404, { error: "not_found" });
      if (!canEditPrefs(me, subject, await grantsNow())) return reply(res, 403, { error: "forbidden" });
      if (req.method === "GET") return reply(res, 200, { prefs: { ...DEFAULT_PREFS, ...((await store.getPrefs(subject.id)) ?? {}) } });
      const b = json(body) ?? {}, T = /^(0[7-9]|1\d|20):[0-5]\d$/;
      const p = { email_on: b.email_on, digest_time: b.digest_time, evening_on: b.evening_on, evening_time: b.evening_time, lang: b.lang };
      if (typeof p.email_on !== "boolean" || typeof p.evening_on !== "boolean" || !T.test(p.digest_time ?? "") || !T.test(p.evening_time ?? "") || !["ru", "en"].includes(p.lang)) return reply(res, 400, { error: "bad_prefs" });
      await store.setPrefs(subject.id, p, who.email);
      await emit("prefs.updated", subject.id, null);
      return reply(res, 200, { ok: true });
    }

    // GET|POST /people/:id/pauses — «день без ритма» (from–to, at most 61 days); PATCH /pauses/:id { cancel }
    const pam = path.match(/^\/people\/([^/]+)\/pauses$/);
    if (pam && (req.method === "GET" || req.method === "POST")) {
      const subject = await personFor(pam[1]);
      if (!subject) return reply(res, 404, { error: "not_found" });
      if (!canEditPrefs(me, subject, await grantsNow())) return reply(res, 403, { error: "forbidden" });
      if (req.method === "GET") return reply(res, 200, { pauses: await store.listPauses(subject.id) });
      const b = json(body), today = localDate(clock());
      const from = b?.from_date, to = b?.to_date;
      if (!DATE_RE.test(from ?? "") || !DATE_RE.test(to ?? "") || to < from || from < today || addDays(from, 60) < to) return reply(res, 400, { error: "bad_pause" });
      const id = randomUUID();
      await store.createPause({ id, person_id: subject.id, from_date: from, to_date: to }, who.email);
      await emit("pause.created", subject.id, id);
      return reply(res, 201, { id });
    }
    const pcm = path.match(/^\/pauses\/([^/]+)$/);
    if (pcm && req.method === "PATCH") {
      const p = UUID_RE.test(pcm[1]) ? await store.getPause(pcm[1]) : null;
      if (!p || p.cancelled_at) return reply(res, 404, { error: "not_found" });
      if (!canEditPrefs(me, await store.getPerson(p.person_id), await grantsNow())) return reply(res, 403, { error: "forbidden" });
      if (json(body)?.cancel !== true) return reply(res, 400, { error: "bad_request" });
      await store.cancelPause(p.id);
      await emit("pause.cancelled", p.person_id, p.id);
      return reply(res, 200, { ok: true });
    }

    // POST /rotations — a chore that goes round 2–8 members. The caller must manage every member.
    // bus 85: a chore in turns is a task template with members now; no new rotations
    if (path === "/rotations" && req.method === "POST") return reply(res, 410, { error: "use_templates" });
    if (path === "/rotations" && req.method === "POST") {
      const b = json(body), grants = await grantsNow(), today = localDate(clock());
      const members = Array.isArray(b?.members) ? b.members : [];
      const x = { id: randomUUID(), title: text(b?.title, 120), rrule: typeof b?.rrule === "string" ? b.rrule : "", dtstart: b?.dtstart ?? today, at_time: b?.at_time ? String(b.at_time) : null, members };
      if (!x.title || !parseRule(x.rrule) || !DATE_RE.test(x.dtstart) || (x.at_time && !TIME_RE.test(x.at_time)) || members.length < 2 || members.length > 8
        || new Set(members).size !== members.length || members.some((m) => !UUID_RE.test(m))) return reply(res, 400, { error: "bad_rotation" });
      const people = await Promise.all(members.map((m) => store.getPerson(m)));
      if (people.some((p) => !p)) return reply(res, 400, { error: "bad_rotation" });
      if (people.some((p) => !routineAccess(me, p, grants).manage)) return reply(res, 403, { error: "forbidden", reason: "not_all_members" });
      for (const p of people) if (me && me.id !== p.id && !(await logged(res, { actor: who.email, subject: p.id, entity: "rotation", action: "write" }))) return;
      await store.createRotation(x, who.email);
      await emit("rotation.created", null, x.id);
      return reply(res, 201, { id: x.id });
    }
    const rom = path.match(/^\/rotations\/([^/]+)(\/check)?$/);
    if (rom && (req.method === "PATCH" || (req.method === "POST" && rom[2]))) {
      const x = UUID_RE.test(rom[1]) ? await store.getRotation(rom[1]) : null;
      if (!x || x.archived_at) return reply(res, 404, { error: "not_found" });
      const grants = await grantsNow();
      if (req.method === "PATCH") {
        const people = await Promise.all(x.members.map((m) => store.getPerson(m)));
        if (people.some((p) => !p || !routineAccess(me, p, grants).manage)) return reply(res, 403, { error: "forbidden", reason: "not_all_members" });
        if (json(body)?.archived !== true) return reply(res, 400, { error: "bad_request" });
        await store.archiveRotation(x.id, who.email);
        await emit("rotation.archived", null, x.id);
        return reply(res, 200, { ok: true });
      }
      // POST /rotations/:id/check { date, done } — on the assignee's turn, by them or their guardian
      const b = json(body), today = localDate(clock()), date = b?.date ?? today;
      if (!DATE_RE.test(date) || date > today || date < addDays(today, -2) || typeof b?.done !== "boolean") return reply(res, 400, { error: "bad_check" });
      const assignee = rotationAssignee(x, date);
      if (!assignee) return reply(res, 400, { error: "not_scheduled" });
      const subject = await store.getPerson(assignee);
      const can = routineAccess(me, subject, grants);
      if (!can.check) return reply(res, 403, { error: "forbidden", reason: can.reason });
      if (me && me.id !== subject.id && !(await logged(res, { actor: who.email, subject: subject.id, entity: "rotation:check", action: "write" }))) return;
      await store.addRotationCheck(x.id, date, subject.id, b.done, who.email);
      await emit(b.done ? "rotation.checked" : "rotation.unchecked", subject.id, x.id);
      return reply(res, 200, { ok: true });
    }

    // GET /rules (admin) — rules with on/off, dry-run and the last 7 days of outcomes (counts only)
    // PATCH /rules/:id (admin) — { enabled?, dry_run? }
    if (path === "/rules" && req.method === "GET") {
      if (!admin) return reply(res, 403, { error: "admin_only" });
      const [rules, counts] = await Promise.all([store.listRules(), store.ruleRunCounts(addDays(localDate(clock()), -7))]);
      return reply(res, 200, { rules: rules.map((r) => ({ id: r.id, enabled: r.enabled, dry_run: r.dry_run, last7: Object.fromEntries(counts.filter((c) => c.rule_id === r.id).map((c) => [c.outcome, c.n])) })) });
    }
    const rlm = path.match(/^\/rules\/([a-z_]+)$/);
    if (rlm && req.method === "PATCH") {
      if (!admin) return reply(res, 403, { error: "admin_only" });
      const b = json(body) ?? {};
      if ((b.enabled !== undefined && typeof b.enabled !== "boolean") || (b.dry_run !== undefined && typeof b.dry_run !== "boolean") || (b.enabled === undefined && b.dry_run === undefined)) return reply(res, 400, { error: "bad_rule" });
      if (!(await store.setRule(rlm[1], b, who.email))) return reply(res, 404, { error: "not_found" });
      await emit("rule.updated", null, rlm[1]);
      return reply(res, 200, { ok: true });
    }

    // Envelope helpers for task titles and notes (task scope) — used by the council (decisions are tasks) and the board.
    const sealTitle = (scope, id, title) => { const { dek, wrapped } = newDataKey(kek, scope, id); try { return { wrapped_key: wrapped, title_ct: seal(dek, Buffer.from(title), `${scope}:${id}`) }; } finally { dek.fill(0); } };
    const openWith = (scope, row, field, aad) => { if (!row[field]) return ""; const k = unwrapDataKey(kek, row.wrapped_key, scope, row.id); try { return open(k, row[field], aad).toString("utf8"); } finally { k.fill(0); } };
    // ================= Stage 3b: council, goals, calendar, ICS =================
    const nameOf = (p) => p.name_ru;
    const meetingKey = (m) => unwrapDataKey(kek, m.wrapped_key, "council", m.id);

    // GET /council?date= — the meeting for that Sunday (default: today if Sunday, else next Sunday),
    // its notes and decisions, open tasks from the previous meeting, and the week's aggregate.
    if (req.method === "GET" && path === "/council") {
      if (!canReadCouncil(me)) return reply(res, 403, { error: "not_a_member" });
      const today = localDate(clock());
      const q = url.searchParams.get("date");
      const date = q && DATE_RE.test(q) ? councilDate(q) : councilDate(today);
      const [m, prev, routines, rotations, pauses, people] = await Promise.all([store.getMeeting(date), store.prevMeeting(date), store.allRoutines(), store.listRotations(), store.allPauses(), store.listPeople()]);
      // Decisions are tasks (bus 85): this council's and the previous one's, from the task table.
      const [checks, rchecks, tasks, prevTasks] = await Promise.all([store.allChecks(addDays(date, -7)), store.allRotationChecks(addDays(date, -7)), store.councilTasks(date), prev ? store.councilTasks(prev.on_date) : []]);
      let notes = "";
      if (m?.notes_ct) { const k = meetingKey(m); try { notes = open(k, m.notes_ct, `council:${m.id}`).toString("utf8"); } finally { k.fill(0); } }
      const isDone = (t) => t.state === "done" || t.state === "reviewed";
      const live = (t) => !["cancelled", "carried_over", "declined_by_adult"].includes(t.state);
      const view = (t) => ({ id: t.id, title: openWith("task", t, "title_ct", `task:${t.id}`), owner_id: t.assignee_id, due_date: t.plan_date, done: isDone(t), state: t.state });
      const st = councilStatus(date, today, localParts(clock()).hhmm, Boolean(m?.held_at));
      return reply(res, 200, { date, today, held: Boolean(m?.held_at), status: st.status, days_until: st.days, notes, can: { write: canWriteCouncil(me), mark_held: canWriteCouncil(me) && st.canMarkHeld },
        tasks: tasks.filter(live).map(view), previous: prev ? { date: prev.on_date, tasks: prevTasks.filter(live).map(view) } : null,
        agenda: buildAgenda(date, today, { routines, rotations, checks, rotationChecks: rchecks, pauses, prevTasks: prevTasks.filter(live).map((t) => ({ done_at: isDone(t) ? t.done_at ?? true : null })) }) });
    }
    // PUT /council/:date { notes, held } — adults only
    const cm = path.match(/^\/council\/(\d{4}-\d{2}-\d{2})$/);
    if (cm && req.method === "PUT") {
      if (!canWriteCouncil(me)) return reply(res, 403, { error: "forbidden" });
      const b = json(body);
      if (councilDate(cm[1]) !== cm[1] || typeof b?.notes !== "string" || b.notes.length > 8000 || typeof b?.held !== "boolean") return reply(res, 400, { error: "bad_council" });
      // «Совет прошёл» only from its start (19:00 local on that Sunday), never in advance (bus 80 #1)
      if (b.held) { const lp = localParts(clock()); if (!councilStatus(cm[1], lp.date, lp.hhmm, false).canMarkHeld) return reply(res, 400, { error: "not_started" }); }
      const cur = await store.getMeeting(cm[1]);
      const id = cur?.id ?? randomUUID();
      let wrapped = cur?.wrapped_key, k;
      if (cur) k = meetingKey(cur); else { const nk = newDataKey(kek, "council", id); k = nk.dek; wrapped = nk.wrapped; }
      try { await store.saveMeeting({ id, on_date: cm[1], wrapped_key: wrapped, notes_ct: b.notes ? seal(k, Buffer.from(b.notes), `council:${id}`) : null, held: b.held }, who.email); }
      finally { k.fill(0); }
      await emit(b.held ? "council.held" : "council.saved", null, cm[1]);
      return reply(res, 200, { ok: true });
    }
    // POST /council/:date/tasks { title, owner_id, due_date } — a decision with an owner and a date
    const ctm = path.match(/^\/council\/(\d{4}-\d{2}-\d{2})\/tasks$/);
    if (ctm && req.method === "POST") {
      if (!canWriteCouncil(me)) return reply(res, 403, { error: "forbidden" });
      const b = json(body), title = text(b?.title, 160);
      const owner = UUID_RE.test(b?.owner_id ?? "") ? await store.getPerson(b.owner_id) : null;
      if (councilDate(ctm[1]) !== ctm[1] || !title || !owner || !DATE_RE.test(b?.due_date ?? "") || b.due_date < ctm[1]) return reply(res, 400, { error: "bad_task" });
      let m = await store.getMeeting(ctm[1]);
      if (!m) { const id = randomUUID(), nk = newDataKey(kek, "council", id); nk.dek.fill(0); await store.saveMeeting({ id, on_date: ctm[1], wrapped_key: nk.wrapped, notes_ct: null, held: false }, who.email); m = await store.getMeeting(ctm[1]); }
      // A decision taken at the council is a task: accepted there and then, due on its date, the deciding adult accountable.
      const id = randomUUID();
      await store.insertTask({ id, plan_date: b.due_date, kind: "oneoff", origin: "council", council_date: ctm[1], assignee_id: owner.id, ...sealTitle("task", id, title),
        accountable_id: me.id, state: "accepted", approved_by: who.email }, who.email);
      await emit("council.task_created", owner.id, id);
      return reply(res, 201, { id });
    }

    // GET|POST /people/:id/goals — only goals the viewer may see; only the owner creates
    const gom = path.match(/^\/people\/([^/]+)\/goals$/);
    if (gom && (req.method === "GET" || req.method === "POST")) {
      const owner = UUID_RE.test(gom[1]) ? await store.getPerson(gom[1]) : null;
      if (!owner) return reply(res, 404, { error: "not_found" });
      if (!me) return reply(res, 403, { error: "not_a_member" });
      const grants = await grantsNow(), other = me.id !== owner.id;
      if (req.method === "GET") {
        const visible = (await store.listGoals(owner.id)).filter((g) => canReadGoal(me, g, owner, grants));
        if (other && visible.length && !(await logged(res, { actor: who.email, subject: owner.id, entity: "goals:list", action: "read" }))) return;
        const checkins = await store.listCheckins(visible.map((g) => g.id));
        const thisWeek = weekStart(localDate(clock()));
        return reply(res, 200, { can: { write: canWriteGoal(me, owner), visibilities: goalVisibilities(owner) }, week: thisWeek, goals: visible.map((g) => {
          const k = unwrapDataKey(kek, g.wrapped_key, "goal", g.id);
          try {
            const cs = checkins.filter((c) => c.goal_id === g.id).slice(0, 8).map((c) => ({ week_start: c.week_start, mood: c.mood, note: c.note_ct ? open(k, c.note_ct, `checkin:${g.id}:${c.week_start}`).toString("utf8") : "" }));
            return { id: g.id, sphere: g.sphere, visibility: g.visibility, status: g.status, title: open(k, g.title_ct, `goal:${g.id}`).toString("utf8"), checkins: cs, checked_this_week: cs.some((c) => c.week_start === thisWeek) };
          } finally { k.fill(0); }
        }) });
      }
      if (!canWriteGoal(me, owner)) return reply(res, 403, { error: "forbidden", reason: "owner_only" });
      const b = json(body), title = text(b?.title, 160), vis = b?.visibility ?? "owner";
      if (!title || !GOAL_SPHERES.includes(b?.sphere) || !goalVisibilities(owner).includes(vis)) return reply(res, 400, { error: "bad_goal" });
      const id = randomUUID(), { dek, wrapped } = newDataKey(kek, "goal", id);
      try { await store.createGoal({ id, person_id: owner.id, sphere: b.sphere, visibility: vis, wrapped_key: wrapped, title_ct: seal(dek, Buffer.from(title), `goal:${id}`) }, who.email); }
      finally { dek.fill(0); }
      await emit("goal.created", owner.id, id);
      return reply(res, 201, { id });
    }
    // PATCH /goals/:id { status?, visibility? } · POST /goals/:id/checkins { mood, note } — owner only
    const glm = path.match(/^\/goals\/([^/]+)(\/checkins)?$/);
    if (glm && (req.method === "PATCH" || (req.method === "POST" && glm[2]))) {
      const g = UUID_RE.test(glm[1]) ? await store.getGoal(glm[1]) : null;
      if (!g || g.status === "archived") return reply(res, 404, { error: "not_found" });
      const owner = await store.getPerson(g.person_id);
      if (!canWriteGoal(me, owner)) return reply(res, 403, { error: "forbidden", reason: "owner_only" });
      const b = json(body) ?? {};
      if (req.method === "PATCH") {
        if ((b.status !== undefined && !["active", "done", "archived"].includes(b.status)) || (b.visibility !== undefined && !goalVisibilities(owner).includes(b.visibility)) || (b.status === undefined && b.visibility === undefined)) return reply(res, 400, { error: "bad_goal" });
        await store.updateGoal(g.id, { status: b.status, visibility: b.visibility });
        await emit("goal.updated", owner.id, g.id);
        return reply(res, 200, { ok: true });
      }
      const note = typeof b.note === "string" ? b.note.trim() : "";
      if (!["on_track", "slow", "paused"].includes(b.mood) || note.length > 500) return reply(res, 400, { error: "bad_checkin" });
      const week = weekStart(localDate(clock()));
      const k = unwrapDataKey(kek, g.wrapped_key, "goal", g.id);
      try { await store.saveCheckin({ goal_id: g.id, week_start: week, mood: b.mood, note_ct: note ? seal(k, Buffer.from(note), `checkin:${g.id}:${week}`) : null }, who.email); }
      finally { k.fill(0); }
      await emit("goal.checked_in", owner.id, g.id);
      return reply(res, 200, { ok: true, week_start: week });
    }

    // GET /calendar?days=1..92 — council, family events, birthdays this viewer may see
    if (req.method === "GET" && path === "/calendar") {
      if (!me) return reply(res, 403, { error: "not_a_member" });
      const today = localDate(clock()), days = Math.min(92, Math.max(1, Number(url.searchParams.get("days") ?? 60) || 60)), to = addDays(today, days - 1);
      const [people, grants, events] = await Promise.all([store.listPeople(), grantsNow(), store.listEvents(today, to)]);
      const full = await Promise.all(people.map((p) => store.getPerson(p.id)));
      const birthdayPeople = birthdayRows(me, full, grants);
      return reply(res, 200, { today, can: { write: canWriteEvent(me) }, items: calendarItems(today, to, { events, birthdayPeople, nameOf }).map(({ name, ...x }) => ({ ...x, ...(name ? { name_ru: name, name_en: birthdayPeople.find((p) => p.id === x.person_id)?.name_en } : {}) })) });
    }
    // POST /events { title, on_date, at_time } (adults) · PATCH /events/:id { archived } (adults)
    if (req.method === "POST" && path === "/events") {
      if (!canWriteEvent(me)) return reply(res, 403, { error: "forbidden" });
      const b = json(body), title = text(b?.title, 120), today = localDate(clock());
      if (!title || !DATE_RE.test(b?.on_date ?? "") || b.on_date < today || (b.at_time && !TIME_RE.test(String(b.at_time)))) return reply(res, 400, { error: "bad_event" });
      const id = randomUUID();
      await store.createEvent({ id, title, on_date: b.on_date, at_time: b.at_time || null }, who.email);
      await emit("event.created", null, id);
      return reply(res, 201, { id });
    }
    const evm = path.match(/^\/events\/([^/]+)$/);
    if (evm && req.method === "PATCH") {
      if (!canWriteEvent(me)) return reply(res, 403, { error: "forbidden" });
      if (json(body)?.archived !== true || !UUID_RE.test(evm[1])) return reply(res, 400, { error: "bad_request" });
      if (!(await store.archiveEvent(evm[1]))) return reply(res, 404, { error: "not_found" });
      await emit("event.archived", null, evm[1]);
      return reply(res, 200, { ok: true });
    }

    // ================= Stage 3c: family board (bus 82, amended by 83 and 84) =================
    const ageOf = (p) => { const b = p?.birth_date ? String(p.birth_date instanceof Date ? p.birth_date.toISOString().slice(0, 10) : p.birth_date) : null; if (!b) return null;
      const t = localDate(clock()); let a = Number(t.slice(0, 4)) - Number(b.slice(0, 4)); if (t.slice(5) < b.slice(5)) a--; return a; };
    /** Who did a step, as the board can show it: a member's id, never an email. */
    const actorRef = (people, actor) => (!actor ? null : actor === "auto" ? "auto" : String(actor).startsWith("system:") ? "system" : people.find((x) => x.email === actor)?.id ?? "admin");
    const hhmmOf = (at) => (at ? localParts(new Date(at)).hhmm : null);
    /** A task as the board shows it. Decline reasons: parents only. Rework notes: the participants only. */
    const taskView = (t, viewer, parent, people) => ({
      id: t.id, plan_date: t.plan_date, title: openWith("task", t, "title_ct", `task:${t.id}`), kind: t.kind, origin: t.origin, assignee_id: t.assignee_id, co_ids: t.co_ids ?? [], accountable_id: t.accountable_id ?? null,
      state: t.state, due_time: t.due_time, when_slot: t.when_slot ?? null, estimate_min: t.estimate_min ?? null, needs_review: t.needs_review, sprint_goal_id: t.sprint_goal_id,
      started_at: t.started_at ?? null, done_at: t.done_at ?? null, reviewed_by: t.reviewed_by ? actorRef(people, t.reviewed_by) : null,
      ...(parent && t.decline_code ? { decline_code: t.decline_code, decline_reason: t.decline_ct ? openWith("task", t, "decline_ct", `decline:${t.id}`) : "" } : {}),
      ...(viewer && participants(t).includes(viewer.id) && t.rework_ct ? { rework_note: openWith("task", t, "rework_ct", `rework:${t.id}`) } : {}),
    });
    const ON_BOARD = ["approved", "accepted", "in_progress", "done", "reviewed", "declined"];
    const byMinute = (a, b) => sortMinute(a) - sortMinute(b);
    /** Validated task input for ad-hoc, sprint and edits: one assignee, up to 3 people together, a time OR a slot, an optional estimate. */
    const taskInput = async (b) => {
      const title = text(b?.title, 160), who2 = UUID_RE.test(b?.assignee_id ?? "") ? await store.getPerson(b.assignee_id) : null;
      const co = Array.isArray(b?.co_ids) ? b.co_ids : [];
      if (!title || !who2 || co.length > MAX_PARTICIPANTS - 1 || new Set(co).size !== co.length || co.includes(who2.id) || !co.every((x) => UUID_RE.test(x))) return null;
      for (const c of co) if (!(await store.getPerson(c))) return null;
      if ((b?.due_time && !TIME_RE.test(String(b.due_time))) || (b?.when_slot && !(b.when_slot in WHEN_SLOTS))) return null;
      const est = b?.estimate_min === undefined || b?.estimate_min === null || b?.estimate_min === "" ? null : Number(b.estimate_min);
      if (est !== null && !(Number.isInteger(est) && est >= 1 && est <= 600)) return null;
      return { title, assignee_id: who2.id, co_ids: co, due_time: b.due_time || null, when_slot: b.due_time ? null : b.when_slot || null, estimate_min: est, needs_review: Boolean(b.needs_review) };
    };
    /** A child's routines today, as one count — for the child and guardians with "routines" only. */
    const routineSummary = async (subject, today) => {
      const [rows, pauses, rots] = await Promise.all([store.listRoutines(subject.id), store.listPauses(subject.id), store.listRotations()]);
      if (pausedOn(pauses, subject.id, today)) return { done: 0, total: 0 };
      const checks = await store.listChecks(rows.map((r) => r.id), addDays(today, -2));
      const myRots = rots.filter((x) => x.members.includes(subject.id)), rchecks = await store.listRotationChecks(myRots.map((x) => x.id), addDays(today, -2));
      const items = [...rows.map((r) => routineView(r, checks, today, 1)), ...myRots.map((x) => rotationView(x, subject.id, rchecks, today, 1))].filter((x) => x.due_today);
      return { done: items.filter((x) => x.done_today).length, total: items.length };
    };

    // GET /board?date= — every family task of the day (never routines, goals or notes), who is doing what, the day's
    // progress (a joint task counts once), the approval stamp; a child's routine count only to the child and their
    // routines guardians; for parents also «Нужно решение», tomorrow's plan status and (from 21:00) carry-over.
    if (req.method === "GET" && path === "/board") {
      if (!me) return reply(res, 403, { error: "not_a_member" });
      const lp = localParts(clock()), today = lp.date, q = url.searchParams.get("date"), date = q && DATE_RE.test(q) ? q : today;
      const grants = await grantsNow(), parent = isParent(me, grants), tomorrow = addDays(date, 1), week = weekStart(date);
      const [people, rows, goals, weekRows, approval, approvalToday, ahead] = await Promise.all([store.listPeople(), store.boardTasks(date, tomorrow), store.sprintGoals(week),
        store.boardTasks(week, addDays(week, 6)), store.planApproval(tomorrow), store.planApproval(date), store.boardTasks(tomorrow, addDays(date, 7))]);
      const personOf = (id) => people.find((x) => x.id === id);
      const day = rows.filter((t) => t.plan_date === date && ON_BOARD.includes(t.state)).sort(byMinute).map((t) => taskView(t, me, parent, people));
      const members = [];
      for (const p of people) {
        const mine = day.filter((t) => participants(t).includes(p.id)), cur = mine.find((t) => t.state === "in_progress");
        const m = { id: p.id, name_en: p.name_en, name_ru: p.name_ru, kind: p.kind, current: cur ? { id: cur.id, title: cur.title, started_at: cur.started_at, kind: cur.kind, co_ids: participants(cur).filter((x) => x !== p.id) } : null,
          waiting: mine.filter((t) => t.state === "approved").length, done: mine.filter((t) => t.state === "done" || t.state === "reviewed").length, total: mine.length };
        if (!m.total) {
          const nx = ahead.filter((t) => ["approved", "accepted"].includes(t.state) && t.plan_date > date && participants(t).includes(p.id)).sort((a, b) => a.plan_date.localeCompare(b.plan_date) || byMinute(a, b))[0];
          if (nx) m.next = { date: nx.plan_date, title: openWith("task", nx, "title_ct", `task:${nx.id}`), due_time: nx.due_time, when_slot: nx.when_slot ?? null };
        }
        if (p.kind === "child" && routineAccess(me, p, grants).read) {
          if (me.id !== p.id && !(await logged(res, { actor: who.email, subject: p.id, entity: "routines:summary", action: "read" }))) return;
          m.routines = await routineSummary(p, date);
        }
        members.push(m);
      }
      const proposedTomorrow = rows.filter((t) => t.plan_date === tomorrow && t.state === "proposed").length;
      const stamp = approvalToday ? { auto: Boolean(approvalToday.auto), by: approvalToday.auto ? "auto" : actorRef(people, approvalToday.approved_by), at: hhmmOf(approvalToday.at) } : null;
      return reply(res, 200, { date, today, now: lp.hhmm, members, tasks: day, progress: progress(day), approval: stamp, can: { approve: parent, sprint: canWriteCouncil(me) },
        sprint: { week_start: week, goals: sprintProgress(goals, weekRows) },
        ...(parent ? {
          needs_decision: rows.filter((t) => t.plan_date <= today && needsDecision(t, personOf(t.assignee_id), today, lp.hhmm))
            .map((t) => ({ ...taskView(t, me, true, people), why: t.state === "declined" ? "declined" : "not_accepted" })),
          plan: { date: tomorrow, proposed: proposedTomorrow, approved: Boolean(approval), auto: Boolean(approval?.auto), ready: lp.hhmm >= PLAN_TIME || proposedTomorrow > 0 },
          carry_offer: date === today && lp.hhmm >= CARRY_TIME ? day.filter((t) => ["approved", "accepted", "in_progress"].includes(t.state)) : [],
        } : {}) });
    }

    // GET /tasks/:id — the drawer: facts and the history, for anyone who can see the board.
    const tgm = path.match(/^\/tasks\/([^/]+)$/);
    if (tgm && req.method === "GET") {
      if (!me) return reply(res, 403, { error: "not_a_member" });
      const t = UUID_RE.test(tgm[1]) ? await store.boardTask(tgm[1]) : null;
      if (!t || !ON_BOARD.includes(t.state) && t.state !== "proposed") return reply(res, 404, { error: "not_found" });
      const grants = await grantsNow(), parent = isParent(me, grants);
      if (t.state === "proposed" && !parent) return reply(res, 404, { error: "not_found" });
      const [people, evs] = await Promise.all([store.listPeople(), store.taskEvents(t.id)]);
      const STEP = { "task.approved": "approved", "task.accepted": "accepted", "task.in_progress": "started", "task.done": "done", "task.reviewed": "reviewed", "task.declined": "declined",
        "task.paused": "paused", "task.edited": "edited", "task.carried_over": "carried_over", "task.cancelled": "cancelled", "task.continued": "continued" };
      const history = [{ step: "proposed", origin: t.origin, at: t.created_at, by: actorRef(people, t.created_by) }];
      if (t.approved_by === "auto" && t.approved_at) history.push({ step: "approved", at: t.approved_at, by: "auto" });
      for (const e of evs) if (STEP[e.type] && !(e.type === "task.approved" && t.approved_by === "auto")) history.push({ step: STEP[e.type], at: e.at, by: actorRef(people, e.actor) });
      history.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      const assignee = await store.getPerson(t.assignee_id);
      return reply(res, 200, { task: taskView(t, me, parent, people), can: allowedActions(me, t, assignee, grants, ageOf), history: history.map((h) => ({ ...h, at: h.at instanceof Date ? h.at.toISOString() : h.at })) });
    }

    // GET /my-tasks — today: «Новые задачи» (approved, waiting for me) and «Мои задачи»; the quiet nudge only here, only to participants
    if (req.method === "GET" && path === "/my-tasks") {
      if (!me) return reply(res, 200, { new: [], mine: [] });
      const today = localDate(clock()), [people, all, council] = await Promise.all([store.listPeople(), store.boardTasks(today, today), store.openCouncilTasksOf(me.id)]);
      // Today's tasks, plus open council decisions whatever their date («до <день>»; never «просрочено»).
      const seen = new Set(all.map((t) => t.id));
      const rows = [...all, ...council.filter((t) => !seen.has(t.id))].filter((t) => participants(t).includes(me.id)).sort(byMinute), nowMs = clock().getTime();
      const v = (t) => ({ ...taskView(t, me, false, people), ...(nudgeDue(t, nowMs) ? { nudge: true } : {}) });
      return reply(res, 200, { today, new: rows.filter((t) => t.state === "approved").map(v), mine: rows.filter((t) => ["accepted", "in_progress", "done", "reviewed", "declined"].includes(t.state)).map(v) });
    }
    // POST /tasks/accept-all — every approved task of today I take part in
    if (req.method === "POST" && path === "/tasks/accept-all") {
      if (!me) return reply(res, 403, { error: "not_a_member" });
      const today = localDate(clock()); let n = 0;
      for (const t of (await store.boardTasks(today, today)).filter((x) => participants(x).includes(me.id) && x.state === "approved"))
        if (await store.moveTask(t.id, "approved", "accepted")) { n++; await emit("task.accepted", t.assignee_id, t.id); }
      return reply(res, 200, { accepted: n });
    }

    // POST /tasks/:id/:action — accept · decline{code, text?} · start{pause_other} · done · continue · review · rework{note} · reassign{assignee_id} · cancel · carry
    const tam = path.match(/^\/tasks\/([^/]+)\/(accept|decline|start|pause|done|continue|review|rework|reassign|cancel|carry)$/);
    if (tam && req.method === "POST") {
      const t = UUID_RE.test(tam[1]) ? await store.boardTask(tam[1]) : null;
      if (!t) return reply(res, 404, { error: "not_found" });
      const action = tam[2], grants = await grantsNow(), assignee = await store.getPerson(t.assignee_id);
      const why = canMove(action, me, t, assignee, grants, ageOf);
      if (why) return reply(res, why === "bad_state" ? 409 : 403, { error: why === "bad_state" ? "bad_state" : "forbidden", reason: why });
      const b = json(body) ?? {}, patch = {};
      const sealNote = (field, aad, txt) => { const k = unwrapDataKey(kek, t.wrapped_key, "task", t.id); try { patch[field] = seal(k, Buffer.from(txt), aad); } finally { k.fill(0); } };
      if (action === "decline") {
        const code = DECLINE_CODES.includes(b.code) ? b.code : null, r = typeof b.text === "string" ? b.text.trim() : "";
        if (!code || (code === "other" && (!r || r.length > 140)) || (code !== "other" && r)) return reply(res, 400, { error: "bad_reason" });
        patch.decline_code = code; if (code === "other") sealNote("decline_ct", `decline:${t.id}`, r);
      }
      if (action === "rework") { const r = typeof b.note === "string" ? b.note.trim() : ""; if (r.length > 140) return reply(res, 400, { error: "bad_note" }); if (r) sealNote("rework_ct", `rework:${t.id}`, r); }
      if (action === "review") patch.reviewed_by = who.email;
      if (action === "continue") patch.continued_at = clock().toISOString();
      if (action === "reassign") {
        const to = UUID_RE.test(b.assignee_id ?? "") ? await store.getPerson(b.assignee_id) : null;
        if (!to) return reply(res, 400, { error: "bad_assignee" });
        patch.assignee_id = to.id; patch.co_ids = (t.co_ids ?? []).filter((x) => x !== to.id); patch.decline_ct = null; patch.decline_code = null;
      }
      if (action === "start") {
        // The person starting is me (a participant), or the child a parent starts for. Their running task may be paused;
        // another participant's running task is never touched — they finish or pause it themselves.
        const starter = participants(t).includes(me.id) ? me.id : t.assignee_id;
        for (const pid of participants(t)) {
          const cur = await store.inProgressOf(pid);
          if (!cur || cur.id === t.id) continue;
          if (pid !== starter) return reply(res, 409, { error: "participant_busy", person_id: pid });
          if (b.pause_other !== true) { const o = await store.boardTask(cur.id); return reply(res, 409, { error: "one_in_progress", task_id: cur.id, title: openWith("task", o, "title_ct", `task:${o.id}`) }); }
          await store.moveTask(cur.id, "in_progress", "accepted"); await emit("task.paused", pid, cur.id);
        }
      }
      if (action === "carry") {
        const id = randomUUID(), title = openWith("task", t, "title_ct", `task:${t.id}`);
        await store.insertTask({ id, plan_date: addDays(t.plan_date, 1), kind: t.kind, origin: "carry", sprint_goal_id: t.sprint_goal_id, carried_from: t.id, assignee_id: t.assignee_id, co_ids: t.co_ids ?? [],
          accountable_id: t.accountable_id ?? null, ...sealTitle("task", id, title), due_time: t.due_time, when_slot: t.when_slot ?? null, estimate_min: t.estimate_min ?? null, needs_review: t.needs_review, state: "proposed" }, who.email);
      }
      const to = nextState(action, t, assignee), subject = t.assignee_id;
      let moved;
      try { moved = await store.moveTask(t.id, t.state, to, patch); }
      catch (e) { if (e?.code === "23505") return reply(res, 409, { error: "one_in_progress" }); throw e; }
      if (!moved) return reply(res, 409, { error: "bad_state", reason: "changed" });
      await emit(action === "continue" ? "task.continued" : `task.${to}`, subject, t.id);
      return reply(res, 200, { ok: true, state: to });
    }

    // Plan (parents): GET /plan?date= · POST /plan/:date/build · PUT /plan/:date (approve; the first approval wins) ·
    // POST /plan/:date/tasks (add) · PATCH /plan/:date/tasks/:id («Изменить» after approval: logged, only the affected assignees are told)
    const pm2 = path.match(/^\/plan\/(\d{4}-\d{2}-\d{2})(\/build|\/tasks(?:\/([^/]+))?)?$/);
    if ((req.method === "GET" && path === "/plan") || pm2) {
      const grants = await grantsNow();
      if (!isParent(me, grants)) return reply(res, 403, { error: "forbidden", reason: "parent_only" });
      const today = localDate(clock());
      const date = pm2 ? pm2[1] : (DATE_RE.test(url.searchParams.get("date") ?? "") ? url.searchParams.get("date") : addDays(today, 1));
      if (date < today) return reply(res, 400, { error: "past" });
      const people = await store.listPeople();
      const stampOf = (a) => (a ? { auto: Boolean(a.auto), by: a.auto ? "auto" : actorRef(people, a.approved_by), at: hhmmOf(a.at) } : null);
      if (req.method === "GET") {
        const [rows, approval] = await Promise.all([store.boardTasks(date, date), store.planApproval(date)]);
        const states = approval ? ["proposed", "approved", "accepted"] : ["proposed"];
        return reply(res, 200, { date, approval: stampOf(approval), tasks: rows.filter((t) => states.includes(t.state)).sort(byMinute).map((t) => taskView(t, me, true, people)) });
      }
      if (req.method === "POST" && pm2[2] === "/build") return reply(res, 200, await buildDayPlan(store, kek, date, who.email));
      if (req.method === "POST" && pm2[2] === "/tasks") {
        const inp = await taskInput(json(body));
        if (!inp) return reply(res, 400, { error: "bad_task" });
        const id = randomUUID(), approved = Boolean(await store.planApproval(date));
        await store.insertTask({ id, plan_date: date, kind: "oneoff", origin: "adhoc", ...inp, accountable_id: me.id, ...sealTitle("task", id, inp.title),
          state: approved ? "approved" : "proposed", approved_by: approved ? who.email : null }, who.email);
        await emit("task.created", inp.assignee_id, id);
        return reply(res, 201, { id, state: approved ? "approved" : "proposed" });
      }
      if (req.method === "PATCH" && pm2[3]) {
        const t = UUID_RE.test(pm2[3]) ? await store.boardTask(pm2[3]) : null, b = json(body) ?? {};
        if (!t || t.plan_date !== date || !["proposed", "approved", "accepted"].includes(t.state)) return reply(res, 404, { error: "not_found" });
        if (b.include === false) { if (!(await store.moveTask(t.id, t.state, "cancelled"))) return reply(res, 409, { error: "bad_state" }); await emit("task.cancelled", t.assignee_id, t.id); return reply(res, 200, { ok: true, state: "cancelled" }); }
        const patch = {};
        if (b.assignee_id !== undefined && b.assignee_id !== t.assignee_id) { if (!UUID_RE.test(b.assignee_id) || !(await store.getPerson(b.assignee_id))) return reply(res, 400, { error: "bad_assignee" }); patch.assignee_id = b.assignee_id; patch.co_ids = (t.co_ids ?? []).filter((x) => x !== b.assignee_id); }
        if ("due_time" in b) { if (b.due_time && !TIME_RE.test(String(b.due_time))) return reply(res, 400, { error: "bad_time" }); patch.due_time = b.due_time || null; if (b.due_time) patch.when_slot = null; }
        // A new assignee has to accept again; a time change keeps the state.
        const to = patch.assignee_id && t.state === "accepted" ? "approved" : t.state, was = t.assignee_id;
        if (!(await store.moveTask(t.id, t.state, to, patch))) return reply(res, 409, { error: "bad_state" });
        for (const pid of new Set([was, patch.assignee_id].filter(Boolean))) await emit("task.edited", pid, t.id);
        return reply(res, 200, { ok: true, state: to });
      }
      if (req.method === "PUT" && !pm2[2]) {
        const items = Array.isArray(json(body)?.items) ? json(body).items : null;
        if (!items) return reply(res, 400, { error: "bad_plan" });
        // The first approval wins: claim the day before moving anything; the second parent gets the stamp back.
        if (!(await store.approvePlan(date, who.email, false))) return reply(res, 409, { error: "already_approved", approval: stampOf(await store.planApproval(date)) });
        let approved = 0, skipped = 0;
        for (const it of items) {
          const t = UUID_RE.test(it?.id ?? "") ? await store.boardTask(it.id) : null;
          if (!t || t.plan_date !== date || t.state !== "proposed") continue;
          if (it.include === false) { if (await store.moveTask(t.id, "proposed", "cancelled")) skipped++; continue; }
          const patch = { approved_by: who.email, accountable_id: me.id };
          if (it.assignee_id && it.assignee_id !== t.assignee_id && UUID_RE.test(it.assignee_id) && (await store.getPerson(it.assignee_id))) { patch.assignee_id = it.assignee_id; patch.co_ids = (t.co_ids ?? []).filter((x) => x !== it.assignee_id); }
          if ("due_time" in (it ?? {}) && (!it.due_time || TIME_RE.test(String(it.due_time)))) { patch.due_time = it.due_time || null; if (it.due_time) patch.when_slot = null; }
          if (await store.moveTask(t.id, "proposed", "approved", patch)) { approved++; await emit("task.approved", patch.assignee_id ?? t.assignee_id, t.id); }
        }
        await emit("plan.approved", null, date);
        return reply(res, 200, { approved, skipped });
      }
      return reply(res, 404, { error: "not_found" });
    }

    // Templates (parents): GET /templates · POST /templates · PATCH /templates/:id · POST /templates/activate { ids? }
    const tpm = path.match(/^\/templates(?:\/([^/]+))?$/);
    if (tpm) {
      const grants = await grantsNow();
      if (!isParent(me, grants)) return reply(res, 403, { error: "forbidden", reason: "parent_only" });
      if (req.method === "POST" && tpm[1] === "activate") {
        const ids = Array.isArray(json(body)?.ids) ? json(body).ids.filter((x) => UUID_RE.test(x)) : null;
        const n = await store.activateTemplates(ids, who.email); await emit("template.activated", null, String(n));
        return reply(res, 200, { activated: n });
      }
      if (req.method === "GET" && !tpm[1]) return reply(res, 200, { templates: (await store.listTemplates()).map((t) => ({ id: t.id, title: openWith("template", t, "title_ct", `template:${t.id}`), mask: t.mask, dtstart: t.dtstart, assignee_id: t.assignee_id, members: t.members, due_time: t.due_time, when_slot: t.when_slot ?? null, estimate_min: t.estimate_min ?? null, needs_review: t.needs_review, active: t.active })) });
      if (req.method === "POST" && !tpm[1]) {
        const b = json(body), title = text(b?.title, 160), members = Array.isArray(b?.members) ? b.members : null;
        const okWho = members ? members.length >= 2 && members.length <= 8 && new Set(members).size === members.length && members.every((m) => UUID_RE.test(m)) : UUID_RE.test(b?.assignee_id ?? "");
        const est = b?.estimate_min === undefined || b?.estimate_min === null || b?.estimate_min === "" ? null : Number(b.estimate_min);
        if (!title || !validMask(b?.mask) || !okWho || (b?.due_time && !TIME_RE.test(String(b.due_time))) || (b?.when_slot && !(b.when_slot in WHEN_SLOTS))
          || (est !== null && !(Number.isInteger(est) && est >= 1 && est <= 600))) return reply(res, 400, { error: "bad_template" });
        for (const pid of members ?? [b.assignee_id]) if (!(await store.getPerson(pid))) return reply(res, 400, { error: "bad_template" });
        const id = randomUUID();
        await store.insertTemplate({ id, ...sealTitle("template", id, title), mask: b.mask, dtstart: localDate(clock()), assignee_id: members ? null : b.assignee_id, members, due_time: b.due_time || null, when_slot: b.due_time ? null : b.when_slot || null, estimate_min: est, needs_review: Boolean(b.needs_review), active: b.active !== false }, who.email);
        await emit("template.created", null, id);
        return reply(res, 201, { id });
      }
      if (req.method === "PATCH" && tpm[1] && UUID_RE.test(tpm[1])) {
        const b = json(body) ?? {};
        if ((b.mask !== undefined && !validMask(b.mask)) || (b.due_time && !TIME_RE.test(String(b.due_time)))) return reply(res, 400, { error: "bad_template" });
        return (await store.updateTemplate(tpm[1], b, who.email)) ? reply(res, 200, { ok: true }) : reply(res, 404, { error: "not_found" });
      }
      return reply(res, 404, { error: "not_found" });
    }

    // Sprint: GET /sprint?week= · POST /sprint/goals { title, source_task_id? } · PATCH /sprint/goals/:id · POST /sprint/goals/:id/tasks
    const spm = path.match(/^\/sprint(?:\/goals(?:\/([^/]+)(\/tasks)?)?)?$/);
    if (spm) {
      if (!me) return reply(res, 403, { error: "not_a_member" });
      const today = localDate(clock()), qw = url.searchParams.get("week");
      const week = weekStart(qw && DATE_RE.test(qw) ? qw : today);
      if (req.method === "GET" && path === "/sprint") {
        const [goals, rows] = await Promise.all([store.sprintGoals(week), store.boardTasks(week, addDays(week, 6))]);
        return reply(res, 200, { week_start: week, can: { write: canWriteCouncil(me) }, goals: sprintProgress(goals, rows) });
      }
      if (!canWriteCouncil(me)) return reply(res, 403, { error: "forbidden" });
      if (req.method === "POST" && path === "/sprint/goals") {
        const b = json(body), title = text(b?.title, 160);
        const w = b?.week_start && DATE_RE.test(b.week_start) ? weekStart(b.week_start) : week;
        if (!title || w < weekStart(today)) return reply(res, 400, { error: "bad_goal" });
        if ((await store.sprintGoals(w)).length >= 3) return reply(res, 409, { error: "three_goals_max" });
        const src = UUID_RE.test(b?.source_task_id ?? "") ? b.source_task_id : null;
        const id = randomUUID(); await store.insertSprintGoal({ id, week_start: w, title, source_task_id: src }, who.email);
        await emit("sprint.goal_created", null, id);
        return reply(res, 201, { id, week_start: w });
      }
      const g = spm[1] && UUID_RE.test(spm[1]) ? await store.getSprintGoal(spm[1]) : null;
      if (!g || g.archived_at) return reply(res, 404, { error: "not_found" });
      if (req.method === "PATCH" && !spm[2]) {
        const b = json(body) ?? {}, title = b.title !== undefined ? text(b.title, 160) : undefined;
        if (title === null || (b.title === undefined && b.archived !== true)) return reply(res, 400, { error: "bad_goal" });
        await store.updateSprintGoal(g.id, { title, archived: b.archived === true }); await emit("sprint.goal_updated", null, g.id);
        return reply(res, 200, { ok: true });
      }
      if (req.method === "POST" && spm[2]) {
        const b = json(body), inp = await taskInput(b), date = b?.plan_date;
        if (!inp || !DATE_RE.test(date ?? "") || date < today || date > addDays(g.week_start, 6)) return reply(res, 400, { error: "bad_task" });
        const id = randomUUID(), approved = Boolean(await store.planApproval(date));
        await store.insertTask({ id, plan_date: date, kind: "sprint", origin: "sprint", sprint_goal_id: g.id, ...inp, accountable_id: me.id, ...sealTitle("task", id, inp.title),
          state: approved ? "approved" : "proposed", approved_by: approved ? who.email : null }, who.email);
        await emit("task.created", inp.assignee_id, id);
        return reply(res, 201, { id });
      }
      return reply(res, 404, { error: "not_found" });
    }

    // GET|POST|DELETE /people/:id/ics — the person's own calendar link (status · new link · switch off)
    const icm = path.match(/^\/people\/([^/]+)\/ics$/);
    if (icm && ["GET", "POST", "DELETE"].includes(req.method)) {
      if (!me || me.id !== icm[1]) return reply(res, 403, { error: "forbidden", reason: "own_link_only" });
      if (req.method === "GET") { const t = await store.getIcs(me.id); return reply(res, 200, { active: Boolean(t), created_at: t?.created_at ?? null }); }
      if (req.method === "DELETE") { const ok = await store.revokeIcs(me.id, who.email); if (ok) await emit("ics.revoked", me.id, null); return reply(res, 200, { ok }); }
      const token = randomBytes(32).toString("base64url");
      await store.setIcs(me.id, sha256(token), who.email);
      await emit("ics.issued", me.id, null);
      return reply(res, 201, { token }); // shown once; only its hash is kept
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
  if (/^\/people\/[^/]+\/routines$/.test(p)) return "/people/:id/routines";
  if (/^\/routines\/[^/]+\/check$/.test(p)) return "/routines/:id/check";
  if (/^\/routines\/[^/]+$/.test(p)) return "/routines/:id";
  if (/^\/people\/[^/]+\/(prefs|pauses)$/.test(p)) return "/people/:id/" + p.split("/").pop();
  if (/^\/pauses\/[^/]+$/.test(p)) return "/pauses/:id";
  if (p === "/rotations" || p === "/rules") return p;
  if (/^\/rotations\/[^/]+\/check$/.test(p)) return "/rotations/:id/check";
  if (/^\/rotations\/[^/]+$/.test(p)) return "/rotations/:id";
  if (/^\/rules\/[a-z_]+$/.test(p)) return "/rules/:id";
  if (p === "/council" || p === "/council-tasks" || p === "/calendar" || p === "/events") return p;
  if (/^\/council\/\d{4}-\d{2}-\d{2}(\/tasks)?$/.test(p)) return p.endsWith("/tasks") ? "/council/:date/tasks" : "/council/:date";
  if (/^\/council-tasks\/[^/]+\/done$/.test(p)) return "/council-tasks/:id/done";
  if (/^\/people\/[^/]+\/(goals|ics)$/.test(p)) return "/people/:id/" + p.split("/").pop();
  if (/^\/goals\/[^/]+(\/checkins)?$/.test(p)) return p.endsWith("/checkins") ? "/goals/:id/checkins" : "/goals/:id";
  if (/^\/events\/[^/]+$/.test(p)) return "/events/:id";
  if (/^\/ics\/[^/]+$/.test(p)) return "/ics/:token";
  if (p === "/board" || p === "/my-tasks" || p === "/plan" || p === "/templates" || p === "/sprint" || p === "/sprint/goals" || p === "/tasks/accept-all") return p;
  if (/^\/tasks\/[^/]+\/[a-z_]+$/.test(p)) return "/tasks/:id/" + p.split("/").pop();
  if (/^\/tasks\/[^/]+$/.test(p)) return "/tasks/:id";
  if (/^\/plan\/\d{4}-\d{2}-\d{2}\/tasks\/[^/]+$/.test(p)) return "/plan/:date/tasks/:id";
  if (/^\/plan\/\d{4}-\d{2}-\d{2}(\/build|\/tasks)?$/.test(p)) return "/plan/:date" + (p.match(/\/(build|tasks)$/)?.[0] ?? "");
  if (/^\/templates\/[^/]+$/.test(p)) return p.endsWith("/activate") ? "/templates/activate" : "/templates/:id";
  if (/^\/sprint\/goals\/[^/]+(\/tasks)?$/.test(p)) return p.endsWith("/tasks") ? "/sprint/goals/:id/tasks" : "/sprint/goals/:id";
  if (/^\/documents\/[^/]+$/.test(p)) return "/documents/:id";
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

/**
 * Create/refresh the least-privilege role kfo_app (roles.sql) with the owner connection, then prove it:
 * an UPDATE on access_log as kfo_app must be refused by privilege (42501). Returns the app pool.
 */
export async function appRolePool(pg, owner, ownerUrl, password) {
  if (typeof password !== "string" || password.length < 24) throw new Error("FAMILY_OS_APP_DB_PASSWORD must be >= 24 chars");
  const c = await owner.connect();
  try {
    await c.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kfo_app') THEN CREATE ROLE kfo_app; END IF; END $$");
    await c.query(`ALTER ROLE kfo_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${c.escapeLiteral(password)}`);
    await c.query(await readFile(new URL("./roles.sql", import.meta.url), "utf8"));
  } finally { c.release(); }
  const u = new URL(ownerUrl); u.username = "kfo_app"; u.password = encodeURIComponent(password);
  const app = new pg.Pool({ connectionString: u.toString(), max: 5 });
  const probe = await app.query("UPDATE access_log SET actor = actor WHERE false").then(() => "allowed", (e) => (e?.code === "42501" ? "denied" : `error ${e?.code}`));
  if (probe !== "denied") { await app.end(); throw new Error(`kfo_app privilege self-test failed (${probe})`); }
  return app;
}

async function main() {
  const { default: pg } = await import("pg");
  const { pgStore } = await import("./store.mjs");
  const masterKey = await readFile(process.env.FAMILY_OS_MASTER_KEY_FILE ?? "/run/secrets/master_key");
  const owner = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  await owner.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  await ensureCanary(owner, parseMasterKey(masterKey));
  const pool = await appRolePool(pg, owner, process.env.DATABASE_URL, process.env.FAMILY_OS_APP_DB_PASSWORD);
  await owner.end();
  console.log("[os] requests run as kfo_app (access_log: select+insert only)");
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
