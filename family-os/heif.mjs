// HEIC/HEIF metadata stripping (Stage 2 carry-over from 2a). JPEG and PNG are re-encoded with sharp,
// but sharp's prebuilt libvips cannot decode HEVC, so a HEIC cannot be re-encoded here. Instead we parse
// the ISOBMFF container and zero-fill the payload of every Exif item and every XMP item (a `mime` item
// whose content type is XML/RDF). The structure stays valid, the image is untouched, the GPS is gone.
// Anything we cannot parse is refused (fail-closed) rather than stored with its metadata.

class HeifError extends Error {}

function boxes(buf, start, end) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p), header = 8;
    const type = buf.toString("latin1", p + 4, p + 8);
    if (size === 1) { if (p + 16 > end) throw new HeifError("box"); size = Number(buf.readBigUInt64BE(p + 8)); header = 16; }
    else if (size === 0) size = end - p;
    if (size < header || p + size > end) throw new HeifError(`box ${type}`);
    out.push({ type, start: p, body: p + header, end: p + size });
    p += size;
  }
  return out;
}

const readN = (buf, p, n) => (n === 0 ? 0 : n === 2 ? buf.readUInt16BE(p) : n === 4 ? buf.readUInt32BE(p) : n === 8 ? Number(buf.readBigUInt64BE(p)) : (() => { throw new HeifError("size"); })());
const cstr = (buf, p, end) => { let e = p; while (e < end && buf[e] !== 0) e++; return { s: buf.toString("utf8", p, e), next: e + 1 }; };

/** Item ids that carry metadata: Exif, and XMP (`mime` items with an XML/RDF content type). */
function metadataItems(buf, iinf) {
  const version = buf[iinf.body];
  const first = iinf.body + 4 + (version === 0 ? 2 : 4);
  const ids = new Set();
  for (const infe of boxes(buf, first, iinf.end).filter((b) => b.type === "infe")) {
    const v = buf[infe.body];
    if (v < 2) continue; // v0/v1 entries have no item_type — no Exif/XMP items
    let p = infe.body + 4;
    const id = v === 2 ? buf.readUInt16BE(p) : buf.readUInt32BE(p); p += v === 2 ? 2 : 4;
    p += 2; // item_protection_index
    const type = buf.toString("latin1", p, p + 4); p += 4;
    const name = cstr(buf, p, infe.end); p = name.next;
    if (type === "Exif") ids.add(id);
    if (type === "mime") { const ct = cstr(buf, p, infe.end).s.toLowerCase(); if (/xml|rdf|xmp/.test(ct)) ids.add(id); }
  }
  return ids;
}

/** Extents of the given items: [{ method, offset, length }] (offsets absolute for method 0, idat-relative for 1). */
function itemExtents(buf, iloc, wanted) {
  const version = buf[iloc.body];
  let p = iloc.body + 4;
  const offsetSize = buf[p] >> 4, lengthSize = buf[p] & 15, baseSize = buf[p + 1] >> 4, indexSize = version > 0 ? buf[p + 1] & 15 : 0;
  p += 2;
  const count = version < 2 ? buf.readUInt16BE(p) : buf.readUInt32BE(p); p += version < 2 ? 2 : 4;
  const out = [];
  for (let i = 0; i < count; i++) {
    const id = version < 2 ? buf.readUInt16BE(p) : buf.readUInt32BE(p); p += version < 2 ? 2 : 4;
    const method = version > 0 ? buf.readUInt16BE(p) & 15 : 0; if (version > 0) p += 2;
    p += 2; // data_reference_index
    const base = readN(buf, p, baseSize); p += baseSize;
    const extents = buf.readUInt16BE(p); p += 2;
    for (let e = 0; e < extents; e++) {
      if (indexSize) p += indexSize;
      const off = readN(buf, p, offsetSize); p += offsetSize;
      const len = readN(buf, p, lengthSize); p += lengthSize;
      if (wanted.has(id)) out.push({ method, offset: base + off, length: len });
    }
    if (p > iloc.end) throw new HeifError("iloc");
  }
  return out;
}

/**
 * @param {Buffer} input a HEIF-family file (HEIC, AVIF…)
 * @returns {{ bytes: Buffer, stripped: number }} a copy with Exif/XMP payloads zeroed; `stripped` = items cleared
 * @throws when the container cannot be parsed (callers refuse the upload)
 */
export function stripHeifMetadata(input) {
  const buf = Buffer.from(input);
  try {
    const top = boxes(buf, 0, buf.length);
    const meta = top.find((b) => b.type === "meta");
    if (!meta) throw new HeifError("no meta");
    const kids = boxes(buf, meta.body + 4, meta.end); // meta is a FullBox
    const iinf = kids.find((b) => b.type === "iinf"), iloc = kids.find((b) => b.type === "iloc"), idat = kids.find((b) => b.type === "idat");
    if (!iinf || !iloc) throw new HeifError("no iinf/iloc");
    const ids = metadataItems(buf, iinf);
    if (ids.size === 0) return { bytes: buf, stripped: 0 };
    const extents = itemExtents(buf, iloc, ids);
    for (const x of extents) {
      if (x.method === 2) throw new HeifError("item-offset construction");
      if (x.method === 1 && !idat) throw new HeifError("no idat");
      const from = x.method === 1 ? idat.body + x.offset : x.offset;
      const to = x.length === 0 ? (x.method === 1 ? idat.end : buf.length) : from + x.length;
      if (from < 0 || to > buf.length || to < from) throw new HeifError("extent out of range");
      buf.fill(0, from, to);
    }
    return { bytes: buf, stripped: ids.size };
  } catch (e) {
    if (e instanceof HeifError || e instanceof RangeError) throw new Error(`heif_unparseable: ${e.message}`);
    throw e;
  }
}
