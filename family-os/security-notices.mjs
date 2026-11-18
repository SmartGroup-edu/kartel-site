// Security notices for passkeys (bus 100 C1) — who gets which letter. Pure, unit-tested; the runner sends.
// The person always; for a child also every parent (active parent grant), whose copy names the child.
// «Новый ключ» is security-critical: it goes at once, through quiet hours and outside the daily cap of the
// engine's rules. «Отозван» / «подозрительный» wait for the end of quiet hours.
import { localParts, inQuiet, DEFAULT_PREFS } from "./engine.mjs";

const first = (p, lang) => String((lang === "en" ? p?.name_en : p?.name_ru) ?? "").trim().split(/\s+/)[0] || undefined;

export function planSecurityNotices(notices, people, grants, prefsById, now) {
  const { hhmm } = localParts(now);
  const out = [];
  for (const n of notices) {
    if (n.sent_at) continue;
    const person = people.find((p) => p.email === n.email) ?? null;
    const prefs = { ...DEFAULT_PREFS, ...(person ? prefsById.get(person.id) ?? {} : {}) };
    if (n.kind !== "new_key" && inQuiet(hhmm, prefs.quiet_start, prefs.quiet_end)) continue;
    const lang = prefs.lang === "en" ? "en" : "ru";
    const base = { kind: n.kind, device: n.device_kind, date: typeof n.on_date === "string" ? n.on_date : new Date(n.on_date).toISOString().slice(0, 10), lang };
    const sends = [{ ...base, to: n.email, ...(first(person, lang) ? { firstName: first(person, lang) } : {}) }];
    if (person?.kind === "child") {
      for (const g of grants) {
        if (g.revoked_at || g.relation !== "parent" || g.child_id !== person.id) continue;
        const parent = people.find((p) => p.id === g.guardian_id);
        if (!parent?.email) continue;
        const pl = (prefsById.get(parent.id)?.lang ?? DEFAULT_PREFS.lang) === "en" ? "en" : "ru";
        sends.push({ ...base, lang: pl, to: parent.email, ...(first(parent, pl) ? { firstName: first(parent, pl) } : {}), ...(first(person, pl) ? { about: first(person, pl) } : {}) });
      }
    }
    out.push({ id: n.id, sends });
  }
  return out;
}
