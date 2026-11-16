/**
 * Pure helpers for the family editor and the chronicle gallery (bus 60). No DOM, no React — so the
 * rules are unit-tested: autosave, unpublished-change count, card status, partial dates, justified
 * photo rows, and the "last published" time.
 */

const json = (v) => JSON.stringify(v ?? null);

/**
 * Debounced autosave for one card. `schedule(value)` restarts the timer; `flush()` saves now.
 * States: "idle" → "pending" (typing) → "saving" → "saved" | "error". A save that fails keeps the
 * value so `retry()` can send it again. Timers are injectable for tests.
 *
 * @param {{ save: (v: any) => Promise<boolean>, delay?: number, onState?: (s: { state: string, at?: number }) => void,
 *           setTimer?: (fn: () => void, ms: number) => any, clearTimer?: (h: any) => void, now?: () => number }} o
 */
export function createAutosaver({ save, delay = 800, onState = () => {}, setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now }) {
  let timer = null, pending, hasPending = false, inFlight = null, lastSent = undefined;
  const run = async () => {
    timer = null;
    if (!hasPending) return;
    if (inFlight) { await inFlight; return run(); } // one request at a time, latest value wins
    const v = pending; hasPending = false;
    if (json(v) === json(lastSent)) { onState({ state: "saved", at: now() }); return; }
    onState({ state: "saving" });
    inFlight = (async () => {
      let ok = false;
      try { ok = await save(v); } catch { ok = false; }
      if (ok) { lastSent = v; if (!hasPending) onState({ state: "saved", at: now() }); }
      else { if (!hasPending) { pending = v; hasPending = true; } onState({ state: "error" }); }
    })();
    await inFlight; inFlight = null;
  };
  return {
    schedule(v) { pending = v; hasPending = true; onState({ state: "pending" }); if (timer) clearTimer(timer); timer = setTimer(run, delay); },
    flush() { if (timer) { clearTimer(timer); timer = null; } return run(); },
    retry() { return this.flush(); },
    /** The server already has this value (initial load / reload): nothing to send. */
    seed(v) { lastSent = v; },
    cancel() { if (timer) clearTimer(timer); timer = null; hasPending = false; },
  };
}

/** Keys (person:<id> / event:<id>) whose draft differs from what is published. */
export function unpublishedKeys(draft, published, empty = { person: null, event: null }) {
  const keys = [];
  for (const kind of ["persons", "events"]) {
    const k = kind === "persons" ? "person" : "event";
    const ids = new Set([...Object.keys(draft?.[kind] ?? {}), ...Object.keys(published?.[kind] ?? {})]);
    for (const id of [...ids].sort()) {
      const d = draft?.[kind]?.[id] ?? empty[k], p = published?.[kind]?.[id] ?? empty[k];
      if (json(normalise(d)) !== json(normalise(p))) keys.push(`${k}:${id}`);
    }
  }
  return keys;
}

/** Treat an all-empty card the same as a missing one. */
function normalise(v) {
  if (!v || typeof v !== "object") return null;
  const filled = Object.values(v).some((x) => (Array.isArray(x) ? x.length > 0 : x !== null && x !== ""));
  return filled ? v : null;
}

/** "empty" (nothing entered) · "draft" (differs from published) · "published" (live as is). */
export function cardStatus(draftValue, publishedValue) {
  const d = normalise(draftValue), p = normalise(publishedValue);
  if (!d && !p) return "empty";
  return json(d) === json(p) ? "published" : "draft";
}

/** Small chips for a chronicle entry's summary row. */
export function eventChips(ev) {
  const chips = [];
  if (ev?.storyEN?.trim() || ev?.storyRU?.trim()) chips.push({ kind: "story" });
  if (ev?.photos?.length) chips.push({ kind: "photos", n: ev.photos.length });
  if (ev?.dateFrom) chips.push({ kind: "dates" });
  return chips;
}

/** "1901-05" → { y: "1901", m: "05", d: "" } */
export function splitDate(s) {
  const m = /^(\d{4})?(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(s ?? "") ?? [];
  return { y: m[1] ?? "", m: m[2] ?? "", d: m[3] ?? "" };
}

/**
 * Year/month/day fields → the stored partial date, or an error code.
 * @returns {{ value: string, error: null | "year_required" | "year" | "day_without_month" | "day" }}
 */
export function joinDate({ y = "", m = "", d = "" }) {
  y = y.trim(); d = d.trim();
  if (!y && !m && !d) return { value: "", error: null };
  if (!y) return { value: "", error: "year_required" };
  if (!/^\d{4}$/.test(y) || Number(y) < 1000) return { value: "", error: "year" };
  if (d && !m) return { value: "", error: "day_without_month" };
  if (!m) return { value: y, error: null };
  if (!d) return { value: `${y}-${m}`, error: null };
  const dn = Number(d), max = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  if (!/^\d{1,2}$/.test(d) || dn < 1 || dn > max) return { value: "", error: "day" };
  return { value: `${y}-${m}-${String(dn).padStart(2, "0")}`, error: null };
}

/**
 * Justified rows: every photo keeps its aspect; a row is scaled so it fills the width exactly; the
 * last, incomplete row stays at the target height (left-aligned) instead of blowing up; a photo too
 * wide for the target height (a panorama) gets a row of its own at full width.
 *
 * @param {number[]} aspects width/height of each photo, in order
 * @returns {{ height: number, items: { index: number, width: number }[] }[]}
 */
export function justifyRows(aspects, width, target, gap = 12) {
  const rows = []; let cur = [];
  const close = (h) => { rows.push({ height: h, items: cur.map((i) => ({ index: i, width: aspects[i] * h })) }); cur = []; };
  const fill = () => (width - gap * (cur.length - 1)) / cur.reduce((s, j) => s + aspects[j], 0);
  for (let i = 0; i < aspects.length; i++) {
    if (width / aspects[i] <= target) {
      // A panorama: finish the current row (filling the width, but never taller than 1.6× target),
      // then give the panorama its own full-width row.
      if (cur.length) { const h = fill(); close(Math.min(h, target * 1.6)); }
      cur.push(i); close(width / aspects[i]); continue;
    }
    cur.push(i);
    const h = fill();
    if (h <= target) close(h);
  }
  if (cur.length) close(target);
  return rows;
}

/** "16 ноября, 11:38" / "16 November, 11:38" — no seconds; the year only when it is not this year. */
export function formatPublished(iso, lang, now = new Date()) {
  if (!iso) return null;
  const d = new Date(iso), loc = lang === "RU" ? "ru-RU" : "en-GB";
  const date = d.toLocaleDateString(loc, { day: "numeric", month: "long", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
  const time = d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}
