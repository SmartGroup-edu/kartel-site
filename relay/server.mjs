// kartel-mail-relay — sends KARTEL sign-in links through Brevo from a fixed Hetzner IP.
//
// Why it exists: the Brevo account blocks API calls from unlisted IPs, and Vercel has no fixed
// egress IP. kartel-site signs a request; this relay checks it and calls Brevo.
//
// It is NOT a general mail relay. It sends exactly one template, to one recipient, and only a link
// that starts with ALLOWED_LINK_PREFIX. A leaked RELAY_SECRET lets someone send our sign-in email
// with a link to our own verify endpoint — nothing else.
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
  for (const [k, arr] of hits) if (arr.every((t) => now - t > GLOBAL.windowMs)) hits.delete(k);
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
    rule: (m) => `The link works once, only in this browser, and expires in ${m} ${m === 1 ? "minute" : "minutes"}.`,
    button: "Sign in",
    preheader: (m) => `Your sign-in link — valid for ${m} ${m === 1 ? "minute" : "minutes"}.`,
    ignore: "If you did not request this, ignore this message — nothing has changed.",
    open: "Open this link to sign in:",
  },
  ru: {
    subject: "Ссылка для входа на KARTEL",
    heading: "Вход на KARTEL",
    intro: "Нажмите кнопку ниже, чтобы войти в раздел «Семейное наследие».",
    rule: (m) => `Ссылка действует ${m} ${ruMinutes(m)}, срабатывает один раз и только в этом браузере.`,
    button: "Войти",
    preheader: (m) => `Ваша ссылка для входа — действует ${m} ${ruMinutes(m)}.`,
    ignore: "Если вы не запрашивали вход, просто проигнорируйте это письмо — ничего не изменилось.",
    open: "Откройте ссылку, чтобы войти:",
  },
};

/**
 * The one sign-in email (cycle 7 #3), on the site's type system: serif heading in the burgundy
 * accent, 16px body, a burgundy button at least 44px tall, the same rule as the sign-in form
 * ("works once, only in this browser, expires in N minutes", N = the site's FAMILY_LINK_TTL, sent
 * with the request) and the motto in the footer. Exported for tests and local previews.
 */
export function renderSignInEmail({ link, ttlMinutes = LINK_TTL_MIN, lang = "en" }) {
  const c = COPY[lang] ?? COPY.en;
  const m = ttlMinutes;
  const text = [c.heading, "", c.intro, "", `${c.open} ${link}`, "", c.rule(m), c.ignore, "", "Virtus et Potestas · kartel.org.uk"].join("\n");
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
  </td></tr></table>
  <p style="margin:0;padding-top:16px;border-top:1px solid #e6e2dd;font-size:14px;line-height:1.6;color:#6f685c;">${esc(c.ignore)}</p>
  <p style="margin:16px 0 0;font-family:${serif};font-size:16px;font-style:italic;color:#7b1e2d;">Virtus et Potestas</p>
  <p style="margin:4px 0 0;font-size:14px;color:#6f685c;"><a href="https://kartel.org.uk" style="color:#6f685c;text-decoration:none;">kartel.org.uk</a></p>
</div></body></html>`;
  return { subject: c.subject, text, html };
}

async function sendViaBrevo(to, link, ttlMinutes, lang) {
  const { subject, text, html } = renderSignInEmail({ link, ttlMinutes, lang });
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

const reply = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
};

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") return reply(res, 200, { ok: true });
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
    if (!allowAll([["global", GLOBAL], [`to:${to}`, PER_RECIPIENT]])) {
      console.warn("[relay] rate limited");
      return reply(res, 429, { error: "rate_limited" });
    }
    try {
      const status = await sendViaBrevo(to, link, ttl, lang);
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
