// Document-expiry reminders (R0 2026-11-17, bus 66). Pure planning, unit-tested; the daily job
// (reminders-job.mjs) adds the database, the "already sent" ledger and the relay.

/** Milestones (months before expiry) and the day counts at which each becomes due. 0 = the day. */
export const MILESTONES = [12, 6, 3, 1, 0];
const DUE_AT = { 12: 365, 6: 183, 3: 91, 1: 30, 0: 0 };

const utcDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function daysLeft(expiry, today) {
  const t = Date.parse(`${expiry}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.round((t - utcDay(today)) / 86400_000);
}

/**
 * The milestone due now: the tightest one whose threshold the document has reached. Earlier
 * (looser) milestones are skipped — a document first seen 2 months out gets the 3-month email
 * once, not three emails at once. Expired documents get nothing more.
 */
export function dueMilestone(days) {
  if (days === null || days < 0) return null;
  if (days === 0) return 0;
  for (const m of [1, 3, 6, 12]) if (days <= DUE_AT[m]) return m;
  return null;
}

/** Status shown on Today: "expired" | "lt3" | "lt6" | "lt12" | null (more than 12 months). */
export function tier(days) {
  if (days === null) return null;
  if (days < 0) return "expired";
  if (days <= 91) return "lt3";
  if (days <= 183) return "lt6";
  if (days <= 365) return "lt12";
  return null;
}

/** Adults: the holder. Minors: guardians whose active grant includes documents. */
export function recipients(holder, people, grants) {
  if (holder.kind === "adult") return [holder];
  const ids = new Set(grants.filter((g) => !g.revoked_at && g.child_id === holder.id && g.scopes.includes("documents")).map((g) => g.guardian_id));
  return people.filter((p) => ids.has(p.id));
}

/**
 * @param {{ id: string, person_id: string, type: string, expiry_date: string }[]} docs
 * @param {Set<string>} sent  keys "docId:milestone:recipientId" already sent
 * @returns {{ doc, holder, milestone: number, recipient }[]}
 */
export function planReminders(docs, people, grants, sent, today) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const out = [];
  for (const doc of docs) {
    const holder = byId.get(doc.person_id);
    if (!holder) continue;
    const m = dueMilestone(daysLeft(doc.expiry_date, today));
    if (m === null) continue;
    for (const r of recipients(holder, people, grants)) {
      if (!r.email) continue;
      if (!sent.has(`${doc.id}:${m}:${r.id}`)) out.push({ doc, holder, milestone: m, recipient: r });
    }
  }
  return out;
}

/** What the relay receives. There is deliberately no field for a document number. */
export function relayPayload({ doc, holder, milestone, recipient }, lang = "ru") {
  const name = (lang === "ru" ? holder.name_ru : holder.name_en) || holder.name_en;
  return {
    to: recipient.email, lang, kind: doc.type, milestone, expiry: doc.expiry_date,
    firstName: String(name).trim().split(/\s+/)[0].slice(0, 40),
    link: `https://kartel.org.uk/${lang}/family/os/people/${holder.id}`,
  };
}
