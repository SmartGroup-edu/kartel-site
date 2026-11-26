// kartel-mail-relay — sends KARTEL sign-in links through Brevo from a fixed Hetzner IP.
//
// Why it exists: the Brevo account blocks API calls from unlisted IPs, and Vercel has no fixed
// egress IP. kartel-site signs a request; this relay checks it and calls Brevo.
//
// It is NOT a general mail relay. It sends two fixed templates, each to one recipient:
//  - /send: the sign-in link (only links that start with ALLOWED_LINK_PREFIX), optionally with the six-digit
//    one-time code (bus 165) — digits only, shown beside the button, never part of a link;
//  - /send-reminder: a Family OS document-expiry reminder (fixed wording; validated document type,
//    first name, date and milestone; the link must be a Family OS person page). It never carries a
//    document number — there is no field for one.
// A leaked RELAY_SECRET lets someone send these two emails with links to our own pages — nothing else.
//
// Node 22, standard library only. No address is ever written to the log.

import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const env = (k, d) => {
  const v = process.env[k] ?? d;
  if (v === undefined || v === "") throw new Error(`missing env ${k}`);
  return v;
};

const PORT = Number(env("PORT", "8787"));
const SECRET = env("RELAY_SECRET");
const BREVO_API_KEY = env("BREVO_API_KEY");
const LINK_PREFIX = env("ALLOWED_LINK_PREFIX", "https://kartel.org.uk/api/family-auth/verify?token=");
const FROM_EMAIL = env("MAIL_FROM", "no-reply@mail.kartel.org.uk");
const FROM_NAME = env("MAIL_FROM_NAME", "KARTEL");
const LINK_TTL_MIN = Number(env("LINK_TTL_MINUTES", "10"));
const BREVO_ENDPOINT = env("BREVO_ENDPOINT", "https://api.brevo.com/v3/smtp/email"); // override only in tests
const MAX_SKEW_S = 60;
const MAX_BODY = 4096;

if (SECRET.length < 32) throw new Error("RELAY_SECRET must be >= 32 chars");

// ── In-memory rate limits (single process — fine for one container) ─────────
const PER_RECIPIENT = { max: 3, windowMs: 60 * 60 * 1000 };
// QA-156 M1: and at most 8 sign-in letters a day to one address, however the hours are spaced.
const PER_RECIPIENT_DAY = { max: 8, windowMs: 24 * 60 * 60 * 1000 };
const GLOBAL = { max: 60, windowMs: 60 * 60 * 1000 };
const hits = new Map(); // key -> timestamps[]
/** Allow only if EVERY limit has room; consume from all of them only then. */
function allowAll(limits) {
  const now = Date.now();
  const windows = limits.map(([key, { max, windowMs }]) => {
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.set(key, arr);
    return { arr, max };
  });
  if (windows.some(({ arr, max }) => arr.length >= max)) return false;
  for (const { arr } of windows) arr.push(now);
  return true;
}
setInterval(() => {
  const now = Date.now();
  // The longest window any key uses (the daily per-address cap), so no key is dropped while it still counts.
  for (const [k, arr] of hits) if (arr.every((t) => now - t > PER_RECIPIENT_DAY.windowMs)) hits.delete(k);
}, 10 * 60 * 1000).unref();

// ── Signature: hex HMAC-SHA256(secret, `${ts}.${rawBody}`) ──────────────────
export function sign(secret, ts, raw) {
  return createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
}
function sigOk(ts, raw, sig) {
  if (!/^\d+$/.test(ts ?? "") || !/^[0-9a-f]{64}$/.test(sig ?? "")) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_S) return false;
  const want = Buffer.from(sign(SECRET, ts, raw), "hex");
  return timingSafeEqual(want, Buffer.from(sig, "hex"));
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bus 105 M1: every name field in a family letter keeps single inner spaces. Runs of whitespace (incl. NBSP and
// other Unicode spaces) collapse to one ASCII space and the ends are trimmed — before validation, so a name with
// a non-breaking space is neither refused nor glued together.
const oneSpace = (v) => (typeof v === "string" ? v.replace(/\s+/gu, " ").trim() : v);
export function normNames(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return b;
  const o = { ...b };
  for (const k of ["firstName", "about"]) if (k in o) o[k] = oneSpace(o[k]);
  if (Array.isArray(o.docs)) o.docs = o.docs.map((d) => (d && typeof d === "object" && "who" in d ? { ...d, who: oneSpace(d.who) } : d));
  if (Array.isArray(o.notes)) o.notes = o.notes.map((n) => (n && typeof n === "object" && "child" in n ? { ...n, child: oneSpace(n.child) } : n));
  return o;
}

/** 1 минуту · 2 минуты · 5 минут · 21 минуту — accusative after «действует». */
function ruMinutes(n) {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return "минуту";
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "минуты";
  return "минут";
}

const COPY = {
  en: {
    subject: "Your KARTEL sign-in link",
    heading: "Sign in to KARTEL",
    intro: "Use the button below to sign in to Family Heritage.",
    rule: (m) => `The link works once, in the browser where you asked to sign in, and expires in ${m} ${m === 1 ? "minute" : "minutes"}.`,
    button: "Sign in",
    preheader: (m) => `Your sign-in link — valid for ${m} ${m === 1 ? "minute" : "minutes"}.`,
    ignore: "If you did not request this, ignore this message — nothing has changed.",
    open: "Open this link to sign in:",
    codeLead: "If the button opens another browser, type this code on the sign-in page instead:",
    codeRule: (m) => `The code works once, in the tab where you asked to sign in, for ${m} ${m === 1 ? "minute" : "minutes"}. Never share it.`,
    codeText: "Or type this code on the sign-in page:",
  },
  ru: {
    subject: "Ссылка для входа на KARTEL",
    heading: "Вход на KARTEL",
    intro: "Нажмите кнопку ниже, чтобы войти в раздел «Семейное наследие».",
    rule: (m) => `Ссылка действует ${m} ${ruMinutes(m)} и срабатывает один раз в том браузере, где вы запросили вход.`,
    button: "Войти",
    preheader: (m) => `Ваша ссылка для входа — действует ${m} ${ruMinutes(m)}.`,
    ignore: "Если вы не запрашивали вход, просто проигнорируйте это письмо — ничего не изменилось.",
    open: "Откройте ссылку, чтобы войти:",
    codeLead: "Если кнопка открылась в другом браузере, введите на странице входа этот код:",
    codeRule: (m) => `Код действует ${m} ${ruMinutes(m)} и срабатывает один раз в той вкладке, где вы запросили вход. Никому его не сообщайте.`,
    codeText: "Или введите на странице входа этот код:",
  },
};

/**
 * The one sign-in email (cycle 7 #3), on the site's type system: serif heading in the burgundy
 * accent, 16px body, a burgundy button at least 44px tall, the same rule as the sign-in form
 * ("works once, only in this browser, expires in N minutes", N = the site's FAMILY_LINK_TTL, sent
 * with the request) and the motto in the footer. Exported for tests and local previews.
 */
export function renderSignInEmail({ link, ttlMinutes = LINK_TTL_MIN, lang = "en", code = null }) {
  const c = COPY[lang] ?? COPY.en;
  const m = ttlMinutes;
  // bus 165: the six-digit code, shown as «123 456» (the page accepts it with or without the space). Absent when
  // the site could not record it — then the letter is exactly the link-only letter.
  const shown = typeof code === "string" && /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : null;
  const text = [c.heading, "", c.intro, "", `${c.open} ${link}`, "", c.rule(m), ...(shown ? ["", `${c.codeText} ${shown}`, c.codeRule(m)] : []), "", c.ignore, "", "Virtus et Potestas · kartel.org.uk"].join("\n");
  // Neutral light panel, dark digits: stays readable when Gmail on iOS inverts the letter in dark mode.
  const codeBlock = shown ? `
  <p style="margin:0 0 10px;font-size:16px;line-height:1.6;color:#2b2824;">${esc(c.codeLead)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;"><tr><td style="border:1px solid #d9d3cb;border-radius:8px;background:#f6f3ef;padding:12px 20px;">
    <span data-code="" style="font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:28px;line-height:32px;letter-spacing:0.12em;font-weight:600;color:#2b2824;">${esc(shown)}</span>
  </td></tr></table>
  <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#6f685c;">${esc(c.codeRule(m))}</p>` : "";
  const serif = "Georgia,'Times New Roman',serif";
  // Single column, inline styles (mail clients ignore <style>), no images — reads the same with
  // images blocked. color-scheme "light only": Apple Mail otherwise auto-darkens the white page
  // around a burgundy button. Footer links are explicit muted colour — left bare, Apple Mail
  // auto-links them in default blue (seen 2026-11-14).
  const html = `<!doctype html><html lang="${lang === "ru" ? "ru" : "en"}"><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader(m))}</div>
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2824;">
  <p style="margin:0 0 28px;font-family:${serif};font-size:24px;letter-spacing:0.12em;color:#7b1e2d;">KARTEL</p>
  <h1 style="margin:0 0 16px;font-family:${serif};font-size:30px;line-height:1.15;font-weight:normal;color:#7b1e2d;">${esc(c.heading)}</h1>
  <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#2b2824;">${esc(c.intro)}</p>
  <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#2b2824;">${esc(c.rule(m))}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;"><tr><td style="border-radius:8px;background:#7b1e2d;">
    <a href="${esc(link)}" style="display:inline-block;padding:14px 28px;line-height:20px;min-height:20px;border-radius:8px;background:#7b1e2d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">${esc(c.button)}</a>
  </td></tr></table>${codeBlock}
  <p style="margin:0;padding-top:16px;border-top:1px solid #e6e2dd;font-size:14px;line-height:1.6;color:#6f685c;">${esc(c.ignore)}</p>
  <p style="margin:16px 0 0;font-family:${serif};font-size:16px;font-style:italic;color:#7b1e2d;">Virtus et Potestas</p>
  <p style="margin:4px 0 0;font-size:14px;color:#6f685c;"><a href="https://kartel.org.uk" style="color:#6f685c;text-decoration:none;">kartel.org.uk</a></p>
</div></body></html>`;
  return { subject: c.subject, text, html };
}

async function sendViaBrevo(to, { subject, text, html }) {
  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  return res.status;
}


// ── Family OS document-expiry reminders (bus 66) ────────────────────────────
const REMINDER_LIMITS = { recipient: { max: 10, windowMs: 24 * 3600_000 }, global: { max: 300, windowMs: 24 * 3600_000 } };
const PERSON_LINK_RE = /^https:\/\/kartel\.org\.uk\/(en|ru)\/family\/os\/people\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const KINDS = {
  en: { passport: "passport", national_id: "ID card", ni_number: "National Insurance number", residence: "EU Settlement status", other: "document" },
  ru: { passport: "паспорт", national_id: "удостоверение личности", ni_number: "номер социального страхования (National Insurance)", residence: "статус проживания (EU Settlement)", other: "документ" },
};
const WHEN = {
  en: { 12: "in 12 months", 6: "in 6 months", 3: "in 3 months", 1: "in a month", 0: "today" },
  ru: { 12: "через 12 месяцев", 6: "через 6 месяцев", 3: "через 3 месяца", 1: "через месяц", 0: "сегодня" },
};

/** Fixed wording; only the type, first name, date and milestone vary. No document numbers, ever. */
export function renderReminderEmail({ lang, kind, firstName, expiry, milestone, link }) {
  const ru = lang === "ru";
  const k = KINDS[ru ? "ru" : "en"][kind], w = WHEN[ru ? "ru" : "en"][milestone];
  const date = new Date(`${expiry}T12:00:00Z`).toLocaleDateString(ru ? "ru-RU" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const subject = ru ? `Срок документа: ${firstName}, ${k} — ${w}` : `Document renewal: ${firstName}'s ${k} — ${w}`;
  const lead = ru ? `${firstName}: ${k} действует до ${date}.` : `${firstName}'s ${k} is valid until ${date}.`;
  const ask = ru ? "Пора подумать о продлении. Подробности — в разделе «Семья»:" : "Time to plan the renewal. Details are in the Family area:";
  const button = ru ? "Открыть профиль" : "Open the profile";
  const text = [lead, "", ask, link, "", "Virtus et Potestas · kartel.org.uk"].join("\n");
  const html = `<!doctype html><html lang="${ru ? "ru" : "en"}"><head><meta charset="utf-8"><meta name="color-scheme" content="light only"></head><body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2824;">
  <p style="margin:0 0 8px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7b1e2d;">KARTEL</p>
  <p style="margin:0 0 16px;font-size:18px;line-height:1.5;">${esc(lead)}</p>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#4a453e;">${esc(ask)}</p>
  <p style="margin:0 0 28px;"><a href="${esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:8px;background:#7b1e2d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">${esc(button)}</a></p>
  <p style="margin:0;font-size:14px;color:#6f685c;"><a href="https://kartel.org.uk" style="color:#6f685c;text-decoration:none;">kartel.org.uk</a></p>
</div></body></html>`;
  return { subject, text, html };
}

function handleReminder(req, res) {
  let raw = "", tooBig = false;
  req.setEncoding("utf8");
  req.on("data", (c) => { raw += c; if (raw.length > MAX_BODY) { tooBig = true; req.destroy(); } });
  req.on("end", async () => {
    if (tooBig) return;
    if (!sigOk(req.headers["x-kartel-ts"], raw, req.headers["x-kartel-sig"])) { console.warn("[relay] rejected: bad signature"); return reply(res, 401, { error: "unauthorized" }); }
    let b; try { b = normNames(JSON.parse(raw)); } catch { return reply(res, 400, { error: "bad_json" }); }
    const to = typeof b.to === "string" ? b.to.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(to) || to.length > 254) return reply(res, 400, { error: "bad_recipient" });
    if (typeof b.link !== "string" || !PERSON_LINK_RE.test(b.link)) return reply(res, 400, { error: "bad_link" });
    if (!Object.hasOwn(KINDS.en, b.kind)) return reply(res, 400, { error: "bad_kind" });
    if (typeof b.firstName !== "string" || !/^[\p{L}\p{M}' -]{1,40}$/u.test(b.firstName)) return reply(res, 400, { error: "bad_name" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.expiry ?? "")) return reply(res, 400, { error: "bad_date" });
    if (![12, 6, 3, 1, 0].includes(b.milestone)) return reply(res, 400, { error: "bad_milestone" });
    if (!allowAll([["r:global", REMINDER_LIMITS.global], [`r:to:${to}`, REMINDER_LIMITS.recipient]])) { console.warn("[relay] reminder rate limited"); return reply(res, 429, { error: "rate_limited" }); }
    try {
      const status = await sendViaBrevo(to, renderReminderEmail({ lang: b.lang === "en" ? "en" : "ru", kind: b.kind, firstName: b.firstName.trim(), expiry: b.expiry, milestone: b.milestone, link: b.link }));
      console.log(`[relay] reminder brevo ${status}`);
      return status >= 200 && status < 300 ? reply(res, 202, { ok: true }) : reply(res, 502, { error: "upstream", status });
    } catch { console.error("[relay] brevo unreachable"); return reply(res, 502, { error: "upstream" }); }
  });
}

// ── Family editor review notices (bus 87): counts only — never titles, names or images ──────
const REVIEW_LIMITS = { recipient: { max: 12, windowMs: 24 * 3600_000 }, global: { max: 200, windowMs: 24 * 3600_000 } };
/** Validate a /send-review body; null when valid, else an error code. */
export function checkReview(b) {
  const to = typeof b?.to === "string" ? b.to.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(to) || to.length > 254) return "bad_recipient";
  if (b.lang !== undefined && !["ru", "en"].includes(b.lang)) return "bad_lang";
  const n = (v) => Number.isInteger(v) && v >= 0 && v <= 999;
  if (b.kind === "pending") { if (!n(b.count) || b.count < 1 || Object.keys(b).some((k) => !["to", "kind", "count", "lang"].includes(k))) return "bad_count"; return null; }
  if (b.kind === "decided") { if (!n(b.approved) || !n(b.rejected) || b.approved + b.rejected < 1 || Object.keys(b).some((k) => !["to", "kind", "approved", "rejected", "lang"].includes(k))) return "bad_count"; return null; }
  return "bad_kind";
}
/** The two review notices, fixed copy («ты»), one link to the editor. Exported for tests. */
export function renderReviewEmail({ kind, count = 0, approved = 0, rejected = 0, lang = "ru" }) {
  const ru = lang !== "en";
  const link = `https://kartel.org.uk/${ru ? "ru" : "en"}/family/admin#${kind === "pending" ? "review" : "mine"}`;
  const c = kind === "pending"
    ? (ru ? { subject: `Новые изменения на утверждение: ${count}`, heading: "Изменения ждут утверждения", lines: [`На утверждении: ${count}.`, "Открой редактор, чтобы посмотреть и утвердить или отклонить."], button: "Открыть редактор" }
          : { subject: `Changes waiting for approval: ${count}`, heading: "Changes are waiting", lines: [`Waiting for approval: ${count}.`, "Open the editor to review, approve or reject them."], button: "Open the editor" })
    : (ru ? { subject: "Твои изменения рассмотрены", heading: "Твои изменения рассмотрены", lines: [`Утверждено: ${approved}. Отклонено: ${rejected}.`, rejected ? "Комментарии — в редакторе, в разделе «Мои изменения»." : "Утверждённое уже видно семье."], button: "Открыть редактор" }
          : { subject: "Your changes were reviewed", heading: "Your changes were reviewed", lines: [`Approved: ${approved}. Rejected: ${rejected}.`, rejected ? "The comments are in the editor, under “My changes”." : "Approved changes are already visible to the family."], button: "Open the editor" });
  const serif = "Georgia,'Times New Roman',serif";
  const text = [c.heading, "", ...c.lines, "", link, "", "Virtus et Potestas · kartel.org.uk"].join("\n");
  const html = `<!doctype html><html lang="${ru ? "ru" : "en"}"><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2824;">
  <p style="margin:0 0 28px;font-family:${serif};font-size:24px;letter-spacing:0.12em;color:#7b1e2d;">KARTEL</p>
  <h1 style="margin:0 0 16px;font-family:${serif};font-size:28px;line-height:1.15;font-weight:normal;color:#7b1e2d;">${esc(c.heading)}</h1>
  ${c.lines.map((l) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#2b2824;">${esc(l)}</p>`).join("\n  ")}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 28px;"><tr><td style="border-radius:8px;background:#7b1e2d;">
    <a href="${esc(link)}" style="display:inline-block;padding:14px 28px;line-height:20px;border-radius:8px;background:#7b1e2d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">${esc(c.button)}</a>
  </td></tr></table>
  <p style="margin:16px 0 0;font-family:${serif};font-size:16px;font-style:italic;color:#7b1e2d;">Virtus et Potestas</p>
</div></body></html>`;
  return { subject: c.subject, text, html };
}
function handleReview(req, res) {
  let raw = "", tooBig = false;
  req.setEncoding("utf8");
  req.on("data", (c) => { raw += c; if (raw.length > MAX_BODY) { tooBig = true; req.destroy(); } });
  req.on("end", async () => {
    if (tooBig) return;
    if (!sigOk(req.headers["x-kartel-ts"], raw, req.headers["x-kartel-sig"])) { console.warn("[relay] rejected: bad signature"); return reply(res, 401, { error: "unauthorized" }); }
    let b; try { b = normNames(JSON.parse(raw)); } catch { return reply(res, 400, { error: "bad_json" }); }
    const err = checkReview(b);
    if (err) return reply(res, 400, { error: err });
    const to = b.to.trim().toLowerCase();
    if (!allowAll([["v:global", REVIEW_LIMITS.global], [`v:to:${to}`, REVIEW_LIMITS.recipient]])) { console.warn("[relay] review rate limited"); return reply(res, 429, { error: "rate_limited" }); }
    try {
      const status = await sendViaBrevo(to, renderReviewEmail({ ...b, lang: b.lang ?? "ru" }));
      console.log(`[relay] review brevo ${status}`);
      return status >= 200 && status < 300 ? reply(res, 202, { ok: true }) : reply(res, 502, { error: "upstream", status });
    } catch { console.error("[relay] brevo unreachable"); return reply(res, 502, { error: "upstream" }); }
  });
}


// ── Family OS engine notifications (Stage 3a, bus 77) ────────────────────────
// Fixed templates: a first name, item titles and times, document type + date + holder's first name,
// and a fixed link to Today. Nothing else can be sent through this route (no free text, no numbers).
const FAMILY_LIMITS = { recipient: { max: 6, windowMs: 24 * 3600_000 }, global: { max: 500, windowMs: 24 * 3600_000 } };
const TODAY_LINK_RE = /^https:\/\/kartel\.org\.uk\/(en|ru)\/family\/os(\/board)?$/;
const SETTINGS_LINK_RE = /^https:\/\/kartel\.org\.uk\/(en|ru)\/family\/os\/people\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}#letters$/;
const NAME_RE = /^[\p{L}\p{M}' -]{1,40}$/u, HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/, DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const fmtDay = (d, ru, year = false) => new Date(`${d}T12:00:00Z`).toLocaleDateString(ru ? "ru-RU" : "en-GB", { day: "numeric", month: "long", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).replace(/\s*г\.$/, "");

/** Validate a /send-family body; returns null when valid, else an error code. */
export function checkFamily(b) {
  if (!["digest", "evening", "council", "plan", "decision", "invite"].includes(b?.kind)) return "bad_kind";
  if (b.tasks_new !== undefined && (b.kind !== "digest" || !Number.isInteger(b.tasks_new) || b.tasks_new < 1 || b.tasks_new > 99)) return "bad_count";
  if (["plan", "decision"].includes(b.kind) && (!Number.isInteger(b.count) || b.count < 1 || b.count > 99)) return "bad_count";
  if (b.count !== undefined && !["plan", "decision"].includes(b.kind)) return "bad_count";
  if (typeof b.firstName !== "string" || !NAME_RE.test(b.firstName.trim())) return "bad_name";
  if (!DATE_ONLY_RE.test(b.date ?? "")) return "bad_date";
  if (typeof b.link !== "string" || !TODAY_LINK_RE.test(b.link)) return "bad_link";
  if (typeof b.settingsLink !== "string" || !SETTINGS_LINK_RE.test(b.settingsLink)) return "bad_link";
  const items = b.items ?? [], docs = b.docs ?? [], notes = b.notes ?? [];
  if (!Array.isArray(items) || items.length > 30 || items.some((i) => typeof i?.title !== "string" || !i.title.trim() || i.title.length > 120 || (i.time != null && !HHMM_RE.test(i.time)) || Object.keys(i).some((k) => !["title", "time"].includes(k)))) return "bad_items";
  if (!Array.isArray(docs) || docs.length > 10 || docs.some((d) => !Object.hasOwn(KINDS.en, d?.type) || !DATE_ONLY_RE.test(d.expiry ?? "") || !NAME_RE.test(String(d.who ?? "")) || Object.keys(d).some((k) => !["type", "expiry", "who"].includes(k)))) return "bad_docs";
  if (!Array.isArray(notes) || notes.length > 10 || notes.some((n) => !NAME_RE.test(String(n?.child ?? "")) || typeof n.title !== "string" || !n.title.trim() || n.title.length > 120 || Object.keys(n).some((k) => !["child", "title"].includes(k)))) return "bad_notes";
  if (["digest", "evening"].includes(b.kind) && !items.length && !docs.length && !notes.length && !b.tasks_new) return "empty";
  // bus 97 item 3: the owner's «Отправить ссылку ещё раз» — a first name and the fixed Today link, nothing else.
  if (b.kind === "invite" && (items.length || docs.length || notes.length)) return "bad_items";
  return null;
}

/**
 * «Ты» in Russian (bus 74). No shaming: open items are listed plainly, a miss is never called a failure.
 * Bus 78: a greeting heading + the weekday date lead every email; the footer links straight to the
 * reader's own «Письма и паузы»; light and dark both readable (color-scheme + prefers-color-scheme;
 * clients that ignore the media query keep the light palette, which is the safe default).
 */
export function renderFamilyEmail({ kind, lang, firstName, date, items = [], docs = [], notes = [], link, settingsLink, tasks_new = 0, count = 0 }) {
  const ru = lang !== "en";
  const dayShort = fmtDay(date, ru);
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString(ru ? "ru-RU" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dateLine = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const t = ru ? {
    digest: { subject: `Твой день — ${dayShort}`, hello: `Доброе утро, ${firstName}!`, lead: "На сегодня:" },
    evening: { subject: `Что ещё открыто — ${dayShort}`, hello: `Добрый вечер, ${firstName}!`, lead: "Ещё открыто сегодня:" },
    council: { subject: "Семейный совет сегодня в 19:00", hello: `${firstName}, сегодня семейный совет`, lead: "В 19:00 — семейный совет. Неделя уже собрана в разделе «Семья»." },
    plan: { subject: "План на завтра готов — утвердить", hello: `${firstName}, план на завтра готов`, lead: `Задач в плане: ${count}. Утверди до утра — в 07:00 обычные дела утвердятся сами, новые — нет.` },
    decision: { subject: `Нужно решение: ${count}`, hello: `${firstName}, нужно решение`, lead: `Задач, от которых отказались: ${count}. Передать, перенести или отменить — на доске.` },
    invite: { subject: "Тебя ждут в семейном разделе KARTEL", hello: `${firstName}, тебя ждут в семейном разделе`, lead: "Открой ссылку ниже и введи свой адрес почты: придёт письмо со ссылкой для входа. Она действует 10 минут и открывается в том же браузере." },
    tasksNew: (n) => `Новые задачи: ${n} — принять`,
    docs: "Документы:", until: "до", expired: "истёк", notes: "Для родителей:", note: (c, x) => `${c}: «${x}» — три раза подряд без отметки. Может, стоит спокойно поговорить.`,
    evening_tail: "Если уже сделано — отметь в разделе «Семья». Если нет — ничего страшного, завтра новый день.", open: "Открыть «Сегодня»",
    off: "Выключить письма или сменить время:", offLink: "твоя страница → «Письма и паузы»",
  } : {
    digest: { subject: `Your day — ${dayShort}`, hello: `Good morning, ${firstName}!`, lead: "Today:" },
    evening: { subject: `Still open — ${dayShort}`, hello: `Good evening, ${firstName}!`, lead: "Still open today:" },
    council: { subject: "Family council today at 19:00", hello: `${firstName}, family council today`, lead: "Family council at 19:00. The week is already gathered in the Family area." },
    plan: { subject: "Tomorrow's plan is ready to approve", hello: `${firstName}, tomorrow's plan is ready`, lead: `Tasks in the plan: ${count}. Approve before morning — at 07:00 the usual chores approve themselves, new ones do not.` },
    decision: { subject: `Needs a decision: ${count}`, hello: `${firstName}, a decision is needed`, lead: `Tasks someone could not take: ${count}. Hand over, carry over or cancel — on the board.` },
    invite: { subject: "You are invited to the KARTEL family area", hello: `${firstName}, the family area is waiting for you`, lead: "Open the link below and enter your email address: a sign-in link will arrive. It works for 10 minutes, in the same browser." },
    tasksNew: (n) => `New tasks: ${n} — accept`,
    docs: "Documents:", until: "until", expired: "expired", notes: "For parents:", note: (c, x) => `${c}: “${x}” — three times in a row without a tick. Maybe worth a calm chat.`,
    evening_tail: "If it is done, tick it in the Family area. If not, no matter — tomorrow is a new day.", open: "Open Today",
    off: "Turn these emails off or change the time:", offLink: "your page → “Emails and pauses”",
  };
  const k = t[kind];
  const lines = items.map((i) => (i.time ? `${i.time} · ${i.title}` : i.title));
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const docLines = docs.map((d) => `${cap(KINDS[ru ? "ru" : "en"][d.type])} (${d.who}) — ${d.expiry < date ? t.expired : t.until} ${fmtDay(d.expiry, ru, true)}`);
  const noteLines = notes.map((n) => t.note(n.child, n.title));
  const newLine = tasks_new ? t.tasksNew(tasks_new) : "";
  const text = [k.hello, dateLine, "", k.lead, ...(newLine ? [newLine] : []), ...lines.map((l) => `• ${l}`), ...(docLines.length ? ["", t.docs, ...docLines.map((l) => `• ${l}`)] : []), ...(noteLines.length ? ["", t.notes, ...noteLines] : []),
    ...(kind === "evening" ? ["", t.evening_tail] : []), "", `${t.open}: ${link}`, "", `${t.off} ${settingsLink}`].join("\n");
  const ul = (xs) => `<ul class="fg" style="margin:0 0 20px;padding-left:20px;font-size:16px;line-height:1.6;color:#2b2824;">${xs.map((x) => `<li style="margin:0 0 4px;">${esc(x)}</li>`).join("")}</ul>`;
  const label = (x) => `<p class="mut" style="margin:0 0 6px;font-size:15px;color:#5c564c;">${esc(x)}</p>`;
  const html = `<!doctype html><html lang="${ru ? "ru" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){.bg{background:#1b1917!important}.fg{color:#f1ebe2!important}.mut{color:#c4bbae!important}.acc{color:#eba8b3!important}.btn{background:#eba8b3!important;color:#1b1917!important}.rule{border-color:#3a3631!important}}</style>
</head><body class="bg" style="margin:0;padding:0;background:#ffffff;">
<div class="bg" style="max-width:480px;margin:0 auto;padding:28px 20px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2824;">
  <p class="acc" style="margin:0 0 16px;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#7b1e2d;">KARTEL</p>
  <h1 class="fg" style="margin:0 0 4px;font-size:24px;line-height:1.3;font-weight:600;color:#2b2824;">${esc(k.hello)}</h1>
  <p class="mut" style="margin:0 0 20px;font-size:15px;color:#5c564c;">${esc(dateLine)}</p>
  <p class="fg" style="margin:0 0 8px;font-size:16px;line-height:1.5;color:#2b2824;">${esc(k.lead)}</p>
  ${newLine ? `<p class="acc" style="margin:0 0 12px;font-size:16px;font-weight:600;color:#7b1e2d;">${esc(newLine)}</p>` : ""}
  ${lines.length ? ul(lines) : ""}${docLines.length ? label(t.docs) + ul(docLines) : ""}${noteLines.length ? label(t.notes) + noteLines.map((l) => `<p class="fg" style="margin:0 0 12px;font-size:16px;line-height:1.55;color:#2b2824;">${esc(l)}</p>`).join("") : ""}
  ${kind === "evening" ? `<p class="mut" style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#5c564c;">${esc(t.evening_tail)}</p>` : ""}
  <p style="margin:8px 0 28px;"><a class="btn" href="${esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:8px;background:#7b1e2d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">${esc(t.open)}</a></p>
  <p class="mut rule" style="margin:0;padding-top:16px;border-top:1px solid #e4ded3;font-size:14px;line-height:1.5;color:#5c564c;">${esc(t.off)} <a class="acc" href="${esc(settingsLink)}" style="color:#7b1e2d;">${esc(t.offLink)}</a></p>
</div></body></html>`;
  return { subject: k.subject, text, html };
}

// ── Security notices for passkeys (bus 100 C1): fixed templates, no identifiers ────────────────────────────
// Three events: a key was added, revoked, or flagged. The letter names the device KIND and a date — never a
// credential id, a label someone typed, an IP or a time. Sent to the person, and for a child also to the parents
// (`about` = the child's first name in the parents' copy).
const SECURITY_LIMITS = { recipient: { max: 12, windowMs: 24 * 3600_000 }, global: { max: 300, windowMs: 24 * 3600_000 } };
export const SECURITY_DEVICES = { iphone: ["iPhone", "iPhone"], ipad: ["iPad", "iPad"], mac: ["Mac", "Mac"], android: ["Android", "Android"], windows: ["Windows", "Windows"], linux: ["Linux", "Linux"], key: ["ключ безопасности", "security key"], other: ["устройство", "device"] };
export function checkSecurity(b) {
  const to = typeof b?.to === "string" ? b.to.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(to) || to.length > 254) return "bad_recipient";
  if (!["new_key", "revoked", "flagged"].includes(b.kind)) return "bad_kind";
  if (b.lang !== undefined && !["ru", "en"].includes(b.lang)) return "bad_lang";
  if (b.firstName !== undefined && (typeof b.firstName !== "string" || !NAME_RE.test(b.firstName.trim()))) return "bad_name";
  if (b.about !== undefined && (typeof b.about !== "string" || !NAME_RE.test(b.about.trim()))) return "bad_name";
  if (!Object.hasOwn(SECURITY_DEVICES, b.device)) return "bad_device";
  if (!DATE_ONLY_RE.test(b.date ?? "")) return "bad_date";
  if (typeof b.link !== "string" || !TODAY_LINK_RE.test(b.link)) return "bad_link";
  if (Object.keys(b).some((k) => !["to", "kind", "lang", "firstName", "about", "device", "date", "link"].includes(k))) return "bad_field";
  return null;
}
export function renderSecurityEmail({ kind, lang = "ru", firstName, about, device, date, link }) {
  const ru = lang !== "en", dev = SECURITY_DEVICES[device][ru ? 0 : 1], day = fmtDay(date, ru, true);
  const hi = firstName ? (ru ? `${firstName}, ` : `${firstName}, `) : "";
  // Names are never declined (we can't do Russian cases safely): the parents' copy uses «Чей: <имя>».
  const whom = about ? (ru ? ` Чей: ${about}.` : ` Whose: ${about}.`) : "";
  const c = ru ? {
    new_key: { subject: "Добавлен новый ключ входа", lines: [about ? `${hi}в семейный раздел добавлен новый ключ входа.${whom} Устройство: ${dev}, ${day}.` : `${hi}к твоему входу в семейный раздел добавлен новый ключ: ${dev}, ${day}.`,
      about ? `Если это неожиданно — войди и отзови ключ: «Люди» → ${about} → «Вход».` : "Если это не ты — войди по ссылке из письма и отзови его: твоя страница → «Вход»."] },
    revoked: { subject: "Ключ входа отозван", lines: [`${hi}ключ входа отозван.${whom} Устройство: ${dev}.`, "Войти можно по ссылке из письма или другим ключом."] },
    flagged: { subject: "Ключ входа помечен как подозрительный", lines: [`${hi}ключ входа повёл себя необычно — возможно, его скопировали.${whom} Устройство: ${dev}. Вход с ним приостановлен.`,
      about ? "Владелец семейного раздела может вернуть или отозвать его." : "Войти можно по ссылке из письма. Ключ можно вернуть или отозвать на странице «Вход»."] },
    open: "Открыть семейный раздел",
  } : {
    new_key: { subject: "A new sign-in key was added", lines: [about ? `${hi}a new sign-in key was added to the family area.${whom} Device: ${dev}, ${day}.` : `${hi}a new key was added to your sign-in for the family area: ${dev}, ${day}.`,
      about ? `If this is unexpected, sign in and revoke it: People → ${about} → Sign-in.` : "If this wasn't you, sign in with an email link and revoke it: your page → Sign-in."] },
    revoked: { subject: "A sign-in key was revoked", lines: [`${hi}a sign-in key was revoked.${whom} Device: ${dev}.`, "You can still sign in with an email link or another key."] },
    flagged: { subject: "A sign-in key was flagged", lines: [`${hi}a sign-in key behaved unusually — it may have been copied.${whom} Device: ${dev}. Signing in with it is paused.`, "You can sign in with an email link; the key can be restored or revoked on the Sign-in page."] },
    open: "Open the family area",
  };
  const k0 = c[kind], k = { ...k0, lines: [hi ? k0.lines[0] : k0.lines[0].charAt(0).toUpperCase() + k0.lines[0].slice(1), ...k0.lines.slice(1)] };
  const text = [k.subject, "", ...k.lines, "", `${c.open}: ${link}`].join("\n");
  const html = `<!doctype html><html lang="${ru ? "ru" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){.bg{background:#1b1917!important}.fg{color:#f1ebe2!important}.acc{color:#eba8b3!important}.btn{background:#eba8b3!important;color:#1b1917!important}}</style>
</head><body class="bg" style="margin:0;padding:0;background:#ffffff;">
<div class="bg" style="max-width:480px;margin:0 auto;padding:28px 20px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2824;">
  <p class="acc" style="margin:0 0 16px;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#7b1e2d;">KARTEL</p>
  <h1 class="fg" style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600;color:#2b2824;">${esc(k.subject)}</h1>
  ${k.lines.map((l) => `<p class="fg" style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#2b2824;">${esc(l)}</p>`).join("\n  ")}
  <p style="margin:16px 0 8px;"><a class="btn" href="${esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:8px;background:#7b1e2d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">${esc(c.open)}</a></p>
</div></body></html>`;
  return { subject: k.subject, text, html };
}
function handleSecurity(req, res) {
  let raw = "", tooBig = false;
  req.setEncoding("utf8");
  req.on("data", (c) => { raw += c; if (raw.length > MAX_BODY) { tooBig = true; req.destroy(); } });
  req.on("end", async () => {
    if (tooBig) return;
    if (!sigOk(req.headers["x-kartel-ts"], raw, req.headers["x-kartel-sig"])) { console.warn("[relay] rejected: bad signature"); return reply(res, 401, { error: "unauthorized" }); }
    let b; try { b = normNames(JSON.parse(raw)); } catch { return reply(res, 400, { error: "bad_json" }); }
    const err = checkSecurity(b);
    if (err) return reply(res, 400, { error: err });
    const to = b.to.trim().toLowerCase();
    if (!allowAll([["s:global", SECURITY_LIMITS.global], [`s:to:${to}`, SECURITY_LIMITS.recipient]])) { console.warn("[relay] security rate limited"); return reply(res, 429, { error: "rate_limited" }); }
    try {
      const status = await sendViaBrevo(to, renderSecurityEmail({ ...b, firstName: b.firstName?.trim(), about: b.about?.trim(), lang: b.lang === "en" ? "en" : "ru" }));
      console.log(`[relay] security ${b.kind} brevo ${status}`);
      return status >= 200 && status < 300 ? reply(res, 202, { ok: true }) : reply(res, 502, { error: "upstream", status });
    } catch { console.error("[relay] brevo unreachable"); return reply(res, 502, { error: "upstream" }); }
  });
}

const FAMILY_MAX_BODY = 16 * 1024; // a full digest (≤ 30 items of ≤ 120 chars) exceeds the 4 KB sign-in limit
function handleFamily(req, res) {
  let raw = "", tooBig = false;
  req.setEncoding("utf8");
  req.on("data", (c) => { raw += c; if (raw.length > FAMILY_MAX_BODY) { tooBig = true; req.destroy(); } });
  req.on("end", async () => {
    if (tooBig) return;
    if (!sigOk(req.headers["x-kartel-ts"], raw, req.headers["x-kartel-sig"])) { console.warn("[relay] rejected: bad signature"); return reply(res, 401, { error: "unauthorized" }); }
    let b; try { b = normNames(JSON.parse(raw)); } catch { return reply(res, 400, { error: "bad_json" }); }
    const to = typeof b.to === "string" ? b.to.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(to) || to.length > 254) return reply(res, 400, { error: "bad_recipient" });
    const err = checkFamily(b);
    if (err) return reply(res, 400, { error: err });
    if (!allowAll([["f:global", FAMILY_LIMITS.global], [`f:to:${to}`, FAMILY_LIMITS.recipient]])) { console.warn("[relay] family rate limited"); return reply(res, 429, { error: "rate_limited" }); }
    try {
      const status = await sendViaBrevo(to, renderFamilyEmail({ ...b, firstName: b.firstName.trim(), lang: b.lang === "en" ? "en" : "ru" }));
      console.log(`[relay] family ${b.kind} brevo ${status}`);
      return status >= 200 && status < 300 ? reply(res, 202, { ok: true }) : reply(res, 502, { error: "upstream", status });
    } catch { console.error("[relay] brevo unreachable"); return reply(res, 502, { error: "upstream" }); }
  });
}

const reply = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
};

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") return reply(res, 200, { ok: true });
  if (req.method === "POST" && req.url === "/send-reminder") return handleReminder(req, res);
  if (req.method === "POST" && req.url === "/send-review") return handleReview(req, res);
  if (req.method === "POST" && req.url === "/send-family") return handleFamily(req, res);
  if (req.method === "POST" && req.url === "/send-security") return handleSecurity(req, res);
  if (req.method !== "POST" || req.url !== "/send") return reply(res, 404, { error: "not_found" });

  let raw = "";
  let tooBig = false;
  req.setEncoding("utf8");
  req.on("data", (c) => { raw += c; if (raw.length > MAX_BODY) { tooBig = true; req.destroy(); } });
  req.on("end", async () => {
    if (tooBig) return;
    if (!sigOk(req.headers["x-kartel-ts"], raw, req.headers["x-kartel-sig"])) {
      console.warn("[relay] rejected: bad signature");
      return reply(res, 401, { error: "unauthorized" });
    }
    let body;
    try { body = JSON.parse(raw); } catch { return reply(res, 400, { error: "bad_json" }); }
    const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
    const link = typeof body.link === "string" ? body.link : "";
    if (!EMAIL_RE.test(to) || to.length > 254) return reply(res, 400, { error: "bad_recipient" });
    if (!link.startsWith(LINK_PREFIX) || link.length > 2048) return reply(res, 400, { error: "bad_link" });
    // Optional (cycle 7 #3): the site's link lifetime and language. Anything else falls back to
    // LINK_TTL_MINUTES and English — an older site build simply omits them.
    const ttl = Number.isInteger(body.ttlMinutes) && body.ttlMinutes >= 1 && body.ttlMinutes <= 120 ? body.ttlMinutes : LINK_TTL_MIN;
    const lang = body.lang === "ru" ? "ru" : "en";
    // bus 165: an optional six-digit code. Anything else in the field is refused, not dropped: a malformed code
    // means a site bug, and a letter without the code the site promised would be worse than no letter.
    if (body.code !== undefined && !(typeof body.code === "string" && /^\d{6}$/.test(body.code))) return reply(res, 400, { error: "bad_code" });
    if (!allowAll([["global", GLOBAL], [`to:${to}`, PER_RECIPIENT], [`day:${to}`, PER_RECIPIENT_DAY]])) {
      console.warn("[relay] rate limited");
      return reply(res, 429, { error: "rate_limited" });
    }
    try {
      const status = await sendViaBrevo(to, renderSignInEmail({ link, ttlMinutes: ttl, lang, code: body.code ?? null }));
      console.log(`[relay] brevo ${status}`);
      if (status >= 200 && status < 300) return reply(res, 202, { ok: true });
      return reply(res, 502, { error: "upstream", status });
    } catch {
      console.error("[relay] brevo unreachable");
      return reply(res, 502, { error: "upstream" });
    }
  });
});

if (process.env.RELAY_NO_LISTEN !== "1") {
  server.listen(PORT, "0.0.0.0", () => console.log(`[relay] listening on ${PORT}`));
}
export { server, hits as _hits }; // _hits: test-only view of the rate-limit windows
