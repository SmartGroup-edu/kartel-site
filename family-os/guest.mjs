// bus 176 P4 (R0 27.11): a read-only guest — for example an accountant — sees only the sections the owner opened,
// until an end date of one year at most. Pure; tested in guest.test.mjs.
//
// - The owner invites from «Доступ и безопасность»: an address, a label («Бухгалтер»), the sections, the end date.
// - The site signs the guest's calls as "guest:<grant id>". The service refuses every write (403 read_only), any route
//   outside the guest's sections (403 section_closed), and a revoked or expired guest (401 guest_ended).
// - A guest is never a person: no /people, no documents, health, notes, routines or children, whatever the sections.
// - Every section read and every sign-in is logged (guest_access_log); the runner deletes rows after 12 months.

/** The sections a guest may be given, in menu order. «Финансы» joins when it exists (bus 172 P6: no data yet). */
export const GUEST_SECTIONS = ["calendar", "kodeks", "companies", "review"];
export const GUEST_MAX_DAYS = 365;
export const GUEST_LABEL_MAX = 60;

/**
 * The service routes a guest may read, by section. Only GETs; anything else is refused before any handler runs.
 * «Компании и проекты» reads nothing from Family OS (the cards live on the site), so it has no route here.
 */
const ROUTES = { "/calendar": "calendar", "/kodeks": "kodeks", "/principle": "kodeks", "/board": "review", "/sprint": "review" };

/** The section a guest GET belongs to, or null (closed to every guest). */
export function guestSectionOf(method, path) {
  return method === "GET" ? ROUTES[path] ?? null : null;
}

/** Active on `today` (YYYY-MM-DD, family-local): not revoked and the end date not passed (the end date is inclusive). */
export function guestActive(g, today) {
  return Boolean(g) && !g.revoked_at && typeof g.until === "string" && g.until >= today;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** YYYY-MM-DD + n days (UTC arithmetic on a date only). */
export function plusDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Validate the owner's invitation. @returns {{ error: string } | { email: string, label: string, sections: string[], until: string }}
 * The end date is required: from today up to today + 365 days.
 */
export function cleanGuestInvite(b, today) {
  const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254 || email.includes(":")) return { error: "bad_email" };
  const label = typeof b?.label === "string" ? b.label.trim().replace(/\s+/g, " ") : "";
  if (!label || label.length > GUEST_LABEL_MAX) return { error: "bad_label" };
  const s = b?.sections;
  if (!Array.isArray(s) || s.length === 0 || new Set(s).size !== s.length || s.some((x) => !GUEST_SECTIONS.includes(x))) return { error: "bad_sections" };
  const until = typeof b?.until === "string" ? b.until : "";
  if (!DATE_RE.test(until) || Number.isNaN(Date.parse(`${until}T00:00:00Z`)) || plusDays(until, 0) !== until) return { error: "bad_until" };
  if (until < today || until > plusDays(today, GUEST_MAX_DAYS)) return { error: "bad_until" };
  return { email, label, sections: GUEST_SECTIONS.filter((x) => s.includes(x)), until };
}

/** What the guest and the site's edge are told about a grant: never the address, the inviter or the log. */
export const guestView = (g) => ({ id: g.id, label: g.label, sections: g.sections, until: g.until });
