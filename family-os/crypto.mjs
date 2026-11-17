// Field-level envelope encryption for Family OS care notes (plan v3 §6.1).
//
// Each note gets its own random 256-bit data key (DEK). The note's fields are encrypted with the DEK
// (AES-256-GCM); the DEK is wrapped with the master key (KEK, AES-256-GCM). Only the wrapped DEK and
// ciphertexts reach Postgres, the backups and the logs. The KEK lives in a root-only file on the
// service host, mounted read-only into the container (auto-unlock, R0 2026-11-16); R0 keeps an
// age-encrypted offline copy.
//
// Every ciphertext is bound to its row and field with AES-GCM additional data, so a ciphertext copied
// into another note or another field does not decrypt.
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export const KEY_VERSION = 1;
const PREFIX = "v1";

/** @param {Buffer} key 32 bytes @param {Buffer} plaintext @param {string} aad */
export function seal(key, plaintext, aad) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return [PREFIX, iv.toString("base64"), ct.toString("base64"), c.getAuthTag().toString("base64")].join(".");
}

/** @returns {Buffer} — throws on a wrong key, a tampered ciphertext or a swapped AAD */
export function open(key, sealed, aad) {
  const [v, iv, ct, tag] = String(sealed).split(".");
  if (v !== PREFIX || !iv || ct === undefined || !tag) throw new Error("bad_ciphertext");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]);
}

/** The master key: exactly 32 raw bytes, or 64 hex characters (with optional trailing newline). */
export function parseMasterKey(raw) {
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
  if (buf.length === 32) return buf;
  const hex = buf.toString("utf8").trim();
  if (/^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, "hex");
  throw new Error("master key must be 32 bytes (raw or 64 hex)");
}

const FIELDS = ["title", "body"];

/** @param {Buffer} kek @param {string} noteId @param {{ title: string, body: string }} fields */
export function encryptNote(kek, noteId, fields) {
  const dek = randomBytes(32);
  const out = { wrapped_key: seal(kek, dek, `dek:${noteId}`), key_version: KEY_VERSION };
  for (const f of FIELDS) out[`${f}_ct`] = seal(dek, Buffer.from(fields[f] ?? "", "utf8"), `${f}:${noteId}`);
  dek.fill(0);
  return out;
}

/** @returns {{ title: string, body: string }} */
export function decryptNote(kek, row) {
  const dek = open(kek, row.wrapped_key, `dek:${row.id}`);
  try {
    return Object.fromEntries(FIELDS.map((f) => [f, open(dek, row[`${f}_ct`], `${f}:${row.id}`).toString("utf8")]));
  } finally { dek.fill(0); }
}

/** Rotation: a new master key re-wraps the data keys; the field ciphertexts stay as they are. */
export function rewrap(oldKek, newKek, row) {
  const dek = open(oldKek, row.wrapped_key, `dek:${row.id}`);
  try { return seal(newKek, dek, `dek:${row.id}`); } finally { dek.fill(0); }
}

// ---- Stage 2a: documents -------------------------------------------------------------------------
// A document has its own data key (wrapped by the master key) for its structured fields; each file
// has its own data key too. Files are stored on disk as iv(12) | tag(16) | ciphertext — never plain.

/** @returns {Buffer} iv | tag | ciphertext */
export function sealBytes(key, plaintext, aad) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}

export function openBytes(key, blob, aad) {
  if (!Buffer.isBuffer(blob) || blob.length < 28) throw new Error("bad_blob");
  const d = createDecipheriv("aes-256-gcm", key, blob.subarray(0, 12));
  d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}

/** New data key for `scope:id`, returned with its wrapped form for storage. */
export function newDataKey(kek, scope, id) {
  const dek = randomBytes(32);
  return { dek, wrapped: seal(kek, dek, `${scope}:${id}`) };
}

export function unwrapDataKey(kek, wrapped, scope, id) {
  return open(kek, wrapped, `${scope}:${id}`);
}
