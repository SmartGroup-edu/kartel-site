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
function allow(key, { max, windowMs }) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
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

async function sendViaBrevo(to, link) {
  const text = [
    "Sign in to KARTEL", "",
    `Open this link to sign in: ${link}`, "",
    `It expires in ${LINK_TTL_MIN} minutes and only works in the browser that asked for it.`,
    "If you did not request this, ignore this message — nothing has changed.",
  ].join("\n");
  const html = [
    `<p>Open this link to sign in to KARTEL:</p>`,
    `<p><a href="${esc(link)}">Sign in</a></p>`,
    `<p>It expires in ${LINK_TTL_MIN} minutes and only works in the browser that asked for it.</p>`,
    `<p>If you did not request this, ignore this message — nothing has changed.</p>`,
  ].join("\n");
  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject: "Your KARTEL sign-in link",
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
    if (!allow("global", GLOBAL) || !allow(`to:${to}`, PER_RECIPIENT)) {
      console.warn("[relay] rate limited");
      return reply(res, 429, { error: "rate_limited" });
    }
    try {
      const status = await sendViaBrevo(to, link);
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
export { server };
