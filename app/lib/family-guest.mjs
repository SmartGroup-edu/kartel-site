// bus 176 P4 (R0 27.11): the read-only guest on the site. Plain ESM + WebCrypto (no next/headers), so proxy.ts, the
// route handlers and the pages share it; tests import it directly.
//
// A guest is not on the family access list. Their grant lives in Family OS (the owner invites and revokes there), so
// the site asks Family OS who an address is — signed as "auth:guest" — at the edge on every page (no cache: «Отозвать»
// works on the next request), at sign-in, and in the page render. Fail-closed: when Family OS does not answer, the
// address is treated as unknown (no guest gets in while the service is silent). Then every Family OS call is signed as
// "guest:<grant id>", and the service refuses every write and every section outside the grant.
import { signMediaRequest } from "./media-signature.mjs";

/** The sections the owner may open to a guest, in menu order (family-os/guest.mjs). «Финансы» joins when it exists. */
export const GUEST_SECTIONS = ["calendar", "kodeks", "companies", "review"];
export const GUEST_MAX_DAYS = 365;

/** The section of a family address, when it is one a guest could be given. /os/week is not one (it reads the council). */
export function guestSectionOfPath(pathname) {
  const m = /^\/(?:en|ru)\/family\/os\/(calendar|kodeks|companies|review)\/?$/.exec(String(pathname ?? ""));
  return m ? m[1] : null;
}

/** May this guest open this address? Only their sections; everything else (heritage, /os, people, Core…) is closed. */
export function guestMayOpenPath(pathname, sections) {
  const s = guestSectionOfPath(pathname);
  return Boolean(s) && (sections ?? []).includes(s);
}

/** The guest's home: their first section in menu order. */
export function guestHome(lang, sections) {
  const first = GUEST_SECTIONS.find((s) => (sections ?? []).includes(s)) ?? "calendar";
  return `/${lang === "ru" || lang === "RU" ? "ru" : "en"}/family/os/${first}`;
}

const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2027-03-31" → «31 марта 2027» / "31 March 2027". */
export function guestDate(date, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ""));
  if (!m) return "";
  const d = Number(m[3]), mo = Number(m[2]) - 1;
  return lang === "EN" ? `${d} ${MONTHS_EN[mo]} ${m[1]}` : `${d} ${MONTHS_RU[mo]} ${m[1]}`;
}

/** The blue bar on every page a guest sees: «Только чтение · доступ до 31 марта 2027». */
export function guestBarText(until, lang) {
  return lang === "EN" ? `Read only · access until ${guestDate(until, lang)}` : `Только чтение · доступ до ${guestDate(until, lang)}`;
}

/** YYYY-MM-DD + n days. */
export function plusDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Who is this address in Family OS — an active guest? `sat` (the session's issued-at, seconds) lets the service apply
 * «Завершить сеансы»; `section` (edge only) is logged as a page view when it is one of the guest's.
 * @param {{ email: string, sat?: number, section?: string | null }} q
 * @returns {Promise<{ state: "active", guest: { id: string, label: string, sections: string[], until: string } } | { state: "none" | "ended" | "unknown" }>}
 *   "none": not a guest (unknown, revoked or expired — the service answers all three the same); "ended": the owner ended
 *   this session; "unknown": the service is off, slow or down — callers refuse (fail-closed).
 */
export async function guestLookup(q, env = process.env, fetchImpl = fetch) {
  if (!env.FAMILY_OS_URL || !env.FAMILY_OS_SECRET) return { state: "unknown" };
  const email = String(q?.email ?? "").trim().toLowerCase();
  if (!email) return { state: "none" };
  return post("/guests/lookup", { email, ...(Number.isInteger(q.sat) ? { sat: q.sat } : {}), ...(q.section ? { section: q.section } : {}) }, env, fetchImpl, (r, b) => {
    if (r.status === 404) return { state: "none" };
    if (r.status === 401 && b?.error === "session_ended") return { state: "ended" };
    const g = b?.guest;
    if (!r.ok || !g || typeof g.id !== "string" || !Array.isArray(g.sections) || typeof g.until !== "string") return { state: "unknown" };
    return { state: "active", guest: { id: g.id, label: String(g.label ?? ""), sections: g.sections.filter((s) => GUEST_SECTIONS.includes(s)), until: g.until } };
  });
}

/** After a guest's session is minted: Family OS logs the sign-in. Never blocks sign-in. */
export async function guestSignedIn(email, env = process.env, fetchImpl = fetch) {
  if (!env.FAMILY_OS_URL || !env.FAMILY_OS_SECRET) return;
  await post("/guests/signin", { email: String(email ?? "").trim().toLowerCase() }, env, fetchImpl, () => null);
}

async function post(path, body, env, fetchImpl, read) {
  const raw = JSON.stringify(body);
  try {
    const h = await signMediaRequest({ secret: env.FAMILY_OS_SECRET, method: "POST", path, actor: "auth:guest", body: raw });
    const access = env.FAMILY_OS_ACCESS_CLIENT_ID && env.FAMILY_OS_ACCESS_CLIENT_SECRET
      ? { "CF-Access-Client-Id": env.FAMILY_OS_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": env.FAMILY_OS_ACCESS_CLIENT_SECRET } : {};
    const r = await fetchImpl(new URL(path, env.FAMILY_OS_URL), { method: "POST", headers: { ...h, ...access, "content-type": "application/json" }, body: raw, cache: "no-store", signal: AbortSignal.timeout(3000) });
    return read(r, await r.json().catch(() => null));
  } catch {
    return { state: "unknown" };
  }
}
