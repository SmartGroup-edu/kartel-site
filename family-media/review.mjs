// Bus 87: when the owner and the editors hear about review changes. Pure — unit-tested in media.test.mjs.
//   owner  : «Новые изменения на утверждение: N» — only when something new is waiting, at most once per 2 hours,
//            never in quiet hours (21:00–07:00 Europe/London). No titles, no images.
//   editor : «Твои изменения утверждены / отклонены» — counts per author, also outside quiet hours.
export const OWNER_GAP_MS = 2 * 3600_000;
export const PURGE_AFTER_MS = 30 * 24 * 3600_000;

/** "HH:MM" in Europe/London for a Date. */
export const londonHHMM = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });
export const quiet = (d) => { const t = londonHHMM(d); return t >= "21:00" || t < "07:00"; };

/** The owner digest is due: something waiting that the last notice did not cover, ≥ 2 h since it, not in quiet hours. */
export function ownerDue({ pending, fresh, lastAt, now }) {
  if (!pending || !fresh || quiet(now)) return false;
  return !lastAt || now.getTime() - new Date(lastAt).getTime() >= OWNER_GAP_MS;
}

/** Decided, not yet told: one line per author { to, approved, rejected, ids }. */
export function editorDigests(rows) {
  const by = new Map();
  for (const r of rows) {
    const d = by.get(r.author) ?? { to: r.author, approved: 0, rejected: 0, ids: [] };
    d[r.state === "approved" ? "approved" : "rejected"]++; d.ids.push(r.id); by.set(r.author, d);
  }
  return [...by.values()];
}
