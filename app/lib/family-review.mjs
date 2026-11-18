/**
 * Bus 87: what an editor's proposal changes, for the owner's review screen. Pure; tested in
 * tests/family-review.test.mjs. Works on one key's body (a person or a chronicle entry).
 */
const PERSON_FIELDS = ["altEN", "altRU"];
const EVENT_FIELDS = ["dateFrom", "dateTo", "placesEN", "placesRU", "professionEN", "professionRU", "storyEN", "storyRU"];

/** Word-level diff: [{ t: "same" | "add" | "del", s }]. LCS over words and the spaces between them. */
export function wordDiff(a = "", b = "") {
  const A = a.split(/(\s+)/).filter(Boolean), B = b.split(/(\s+)/).filter(Boolean);
  if (A.length * B.length > 4_000_000) return [{ t: "del", s: a }, { t: "add", s: b }]; // too long to align: whole blocks
  const L = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [], push = (t, s) => { const last = out.at(-1); if (last && last.t === t) last.s += s; else out.push({ t, s }); };
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { push("same", A[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) push("del", A[i++]); else push("add", B[j++]);
  }
  while (i < A.length) push("del", A[i++]);
  while (j < B.length) push("add", B[j++]);
  return out;
}

/**
 * The changes in one proposal:
 *   { type: "text", field, before, after, diff } · { type: "portrait", before, after }
 *   { type: "photo_added" | "photo_removed", id, captionEN, captionRU } · { type: "caption", id, field, before, after }
 * A deletion proposal is a change whose `after` drops something (a photo, a portrait, a text).
 */
export function diffKey(key, before, after) {
  const kind = String(key).split(":")[0], b = before ?? {}, a = after ?? {}, out = [];
  for (const f of kind === "person" ? PERSON_FIELDS : EVENT_FIELDS) {
    const x = b[f] ?? "", y = a[f] ?? "";
    if (x !== y) out.push({ type: "text", field: f, before: x, after: y, diff: wordDiff(x, y) });
  }
  if (kind === "person" && (b.portrait ?? null) !== (a.portrait ?? null)) out.push({ type: "portrait", before: b.portrait ?? null, after: a.portrait ?? null });
  if (kind === "event") {
    const bp = new Map((b.photos ?? []).map((p) => [p.id, p])), ap = new Map((a.photos ?? []).map((p) => [p.id, p]));
    for (const [id, p] of ap) if (!bp.has(id)) out.push({ type: "photo_added", id, captionEN: p.captionEN ?? "", captionRU: p.captionRU ?? "" });
    for (const [id, p] of bp) if (!ap.has(id)) out.push({ type: "photo_removed", id, captionEN: p.captionEN ?? "", captionRU: p.captionRU ?? "" });
    for (const [id, p] of ap) { const q = bp.get(id); if (q) for (const f of ["captionEN", "captionRU"]) if ((q[f] ?? "") !== (p[f] ?? "")) out.push({ type: "caption", id, field: f, before: q[f] ?? "", after: p[f] ?? "" }); }
  }
  return out;
}
