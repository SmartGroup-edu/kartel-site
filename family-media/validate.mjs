// Field rules for the family content the admin editor writes. Pure functions — shared by the
// server and its tests. Content is plain text only: no HTML is ever accepted or rendered.

export const KEY_RE = /^[a-z0-9_-]{1,64}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Partial dates: "YYYY", "YYYY-MM" or "YYYY-MM-DD", or empty. */
export const PARTIAL_DATE_RE = /^(\d{4})(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

const LIMITS = { short: 200, alt: 300, caption: 300, story: 6000, photos: 8 };

function text(v, max, field) {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new Error(`${field}: must be text`);
  // Normalise line endings, drop control characters except newline and tab.
  const s = v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (s.length > max) throw new Error(`${field}: longer than ${max} characters`);
  return s;
}

function date(v, field) {
  const s = text(v, 10, field);
  if (s && !PARTIAL_DATE_RE.test(s)) throw new Error(`${field}: use YYYY, YYYY-MM or YYYY-MM-DD`);
  return s;
}

function mediaRef(v, field) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new Error(`${field}: bad media id`);
  return v;
}

/** A person's editable fields: portrait + alt text. Names are NOT editable here. */
export function validatePerson(body) {
  if (!body || typeof body !== "object") throw new Error("body: expected an object");
  return {
    portrait: mediaRef(body.portrait, "portrait"),
    altEN: text(body.altEN, LIMITS.alt, "altEN"),
    altRU: text(body.altRU, LIMITS.alt, "altRU"),
  };
}

/** A chronicle entry's added fields. The existing title and description are NOT editable here. */
export function validateEvent(body) {
  if (!body || typeof body !== "object") throw new Error("body: expected an object");
  const photos = body.photos ?? [];
  if (!Array.isArray(photos) || photos.length > LIMITS.photos) throw new Error(`photos: at most ${LIMITS.photos}`);
  const out = {
    dateFrom: date(body.dateFrom, "dateFrom"),
    dateTo: date(body.dateTo, "dateTo"),
    placesEN: text(body.placesEN, LIMITS.short, "placesEN"),
    placesRU: text(body.placesRU, LIMITS.short, "placesRU"),
    professionEN: text(body.professionEN, LIMITS.short, "professionEN"),
    professionRU: text(body.professionRU, LIMITS.short, "professionRU"),
    storyEN: text(body.storyEN, LIMITS.story, "storyEN"),
    storyRU: text(body.storyRU, LIMITS.story, "storyRU"),
    photos: photos.map((p, i) => ({
      id: mediaRef(p?.id, `photos[${i}].id`) ?? (() => { throw new Error(`photos[${i}].id: required`); })(),
      captionEN: text(p?.captionEN, LIMITS.caption, `photos[${i}].captionEN`),
      captionRU: text(p?.captionRU, LIMITS.caption, `photos[${i}].captionRU`),
    })),
  };
  if (out.dateFrom && out.dateTo && out.dateTo < out.dateFrom) throw new Error("dateTo: earlier than dateFrom");
  return out;
}

/** Every media id a content document references (for "may a viewer see this file?"). */
export function referencedMedia(content) {
  const ids = new Set();
  for (const p of Object.values(content?.persons ?? {})) if (p?.portrait) ids.add(p.portrait);
  for (const e of Object.values(content?.events ?? {})) for (const ph of e?.photos ?? []) ids.add(ph.id);
  return ids;
}
