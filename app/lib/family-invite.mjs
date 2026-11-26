/**
 * The invite wizard and «Ждут ответа» (bus 172 P4). Pure; tested in tests/family-invite.test.mjs.
 *
 * Built on the invitation Family OS already has: the owner adds a person (POST /people), gives the grants the role
 * needs (POST /grants), and queues the letter (POST /people/:id/invite — one a day per person, at most 10 a day per
 * owner, audited). The runner sends it through the mail relay in the family's quiet hours. The letter is not a
 * credential: it sends the person to the normal sign-in (email link + 6-digit code, then a passkey). Who may sign in
 * at all stays the site's access list (FAMILY_APPROVED_EMAILS / Edge Config `familyAccessEmails`) — the wizard only
 * reads it and says so.
 */

/** The roles the model has. No guest role exists (bus 172 P3). */
export const INVITE_ROLES = ["parent", "relative", "adult", "child"];
export const SCOPES = ["routines", "education", "health", "documents"];
/** Giving these is high impact (family-access.mjs): the preview names them, and «Отправить» is the confirmation. */
export const SENSITIVE = ["health", "documents"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The relay's own first-name rule (relay/server.mjs NAME_RE): the letter goes only when the first name passes it.
const NAME_RE = /^[\p{L}\p{M}' -]{1,40}$/u;
/** The first word, as the runner takes it for the letter (family-os/engine.mjs firstName). */
export const firstWord = (s) => String(s ?? "").trim().split(/\s+/)[0] ?? "";

/**
 * Step 1 → the problems, as keys (the component words them). An empty list means «Далее» may go on.
 * @param {{ name_ru: string, name_en: string, email: string, role: string, children: string[], parents: string[], scopes: string[] }} d
 * @param {{ people: { id: string, email?: string, kind: string }[] }} ctx
 */
export function checkStep1(d, { people }) {
  const out = [];
  const email = String(d.email ?? "").trim().toLowerCase();
  if (!String(d.name_ru ?? "").trim() || !NAME_RE.test(firstWord(d.name_ru))) out.push("name_ru");
  if (!String(d.name_en ?? "").trim() || !NAME_RE.test(firstWord(d.name_en))) out.push("name_en");
  if (!EMAIL_RE.test(email) || email.length > 254) out.push("email");
  else if ((people ?? []).some((p) => String(p.email ?? "").toLowerCase() === email)) out.push("email_taken");
  if (!INVITE_ROLES.includes(d.role)) out.push("role");
  if ((d.role === "parent" || d.role === "relative") && !(d.children ?? []).length) out.push("children");
  if (d.role === "relative" && !(d.scopes ?? []).length) out.push("scopes");
  return out;
}

/** What a parent or a relative gets on each chosen child, and what the parents get on a new child. */
export function grantScopes(d) {
  if (d.role === "relative") return SCOPES.filter((s) => (d.scopes ?? []).includes(s));
  // A parent: the areas chosen, at least the routines (the board and «Решения» need it).
  return SCOPES.filter((s) => s === "routines" || (d.scopes ?? []).includes(s));
}

/**
 * The calls «Отправить» makes, in order. `guardian_id`/`child_id` null = the new person's id, filled in after the
 * person is created.
 */
export function invitePlan(d) {
  const kind = d.role === "child" ? "child" : "adult";
  const person = { email: String(d.email).trim().toLowerCase(), name_ru: String(d.name_ru).trim(), name_en: String(d.name_en).trim(), kind };
  const scopes = grantScopes(d);
  const grants = d.role === "parent" || d.role === "relative"
    ? (d.children ?? []).map((c) => ({ guardian_id: null, child_id: c, relation: d.role, scopes }))
    : d.role === "child" ? (d.parents ?? []).map((g) => ({ guardian_id: g, child_id: null, relation: "parent", scopes })) : [];
  return { person, grants };
}

/**
 * Step 2, «Что увидит»: the sections of the menu (the same rules as family-os-shell.mjs) and, per child, the areas.
 * @returns {{ sections: { key: string, on: boolean }[], areas: { child: string, scopes: string[], sensitive: string[] }[] }}
 */
export function accessPreview(d, { people, lang }) {
  const child = d.role === "child";
  const keys = child ? ["myday", "calendar", "today", "board", "council", "people", "access"] : ["today", "board", "calendar", "council", "people", "docs", "access"];
  const on = new Set(child ? ["myday", "calendar"] : ["today", "board", "calendar", "council", "people", "docs"]);
  const name = (id) => { const p = (people ?? []).find((x) => x.id === id); return p ? (lang === "EN" ? p.name_en : p.name_ru) : ""; };
  const scopes = grantScopes(d);
  const ids = d.role === "parent" || d.role === "relative" ? d.children ?? [] : d.role === "child" ? d.parents ?? [] : [];
  const areas = ids.map((id) => ({ child: name(id), scopes, sensitive: SENSITIVE.filter((s) => scopes.includes(s)) }));
  return { sections: keys.map((key) => ({ key, on: on.has(key) })), areas };
}

/**
 * Step 3: the letter exactly as the relay renders it for kind "invite" (relay/server.mjs renderFamilyEmail). A test
 * holds the two together, so a change on either side fails CI.
 */
export function inviteLetter(lang, firstName, date) {
  const ru = lang !== "EN";
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString(ru ? "ru-RU" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return ru ? {
    subject: "Тебя ждут в семейном разделе KARTEL", hello: `${firstName}, тебя ждут в семейном разделе`, dateLine: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    lead: "Открой ссылку ниже и введи свой адрес почты: придёт письмо со ссылкой для входа. Она действует 10 минут и открывается в том же браузере.",
    button: "Открыть «Сегодня»", off: "Выключить письма или сменить время:", offLink: "твоя страница → «Письма и паузы»",
  } : {
    subject: "You are invited to the KARTEL family area", hello: `${firstName}, the family area is waiting for you`, dateLine: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    lead: "Open the link below and enter your email address: a sign-in link will arrive. It works for 10 minutes, in the same browser.",
    button: "Open Today", off: "Turn these emails off or change the time:", offLink: "your page → “Emails and pauses”",
  };
}

/**
 * «Ждут ответа»: everyone who has not signed in yet, unless their invitation was cancelled. Cancel is offered only when
 * the service reports `cancelled` (it can cancel) and there is an invitation to cancel.
 * @param {{ adoption: { people: any[] } | null, listed: Record<string, "listed" | "not_listed" | "revoked" | "unknown"> }} o
 */
export function pendingCards({ adoption, listed }) {
  if (!adoption) return null;
  return adoption.people
    .filter((r) => !r.signed_in && !(r.invite && r.invite.cancelled === true))
    .map((r) => ({ id: r.id, name_ru: r.name_ru, name_en: r.name_en, kind: r.kind, invite: r.invite, canCancel: Boolean(r.invite) && r.invite.cancelled === false, access: listed[r.id] ?? "unknown" }));
}
