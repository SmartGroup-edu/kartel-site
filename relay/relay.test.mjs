// Run: node --test relay/relay.test.mjs   (no network: Brevo is mocked locally)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

const SECRET = "relay-test-secret-at-least-32-characters";
const PREFIX = "https://kartel.org.uk/api/family-auth/verify?token=";
let brevoCalls = [];
let brevo, relay, base;

// The SITE's own signer — the exact module app/lib/family-mail.ts uses — so these tests prove the
// site and the relay agree, and break if either side changes alone.
import { signRelayRequest } from "../app/lib/relay-signature.mjs";

async function send(payload, { secret = SECRET, tsOffset = 0 } = {}) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000) + tsOffset);
  const sig = await signRelayRequest(secret, ts, body);
  return fetch(base + "/send", { method: "POST", headers: { "content-type": "application/json", "x-kartel-ts": ts, "x-kartel-sig": sig }, body });
}

before(async () => {
  brevo = createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { brevoCalls.push({ key: req.headers["api-key"], body: JSON.parse(b) }); res.writeHead(201); res.end("{}"); });
  }).listen(0);
  await new Promise((r) => brevo.once("listening", r));
  Object.assign(process.env, {
    RELAY_SECRET: SECRET, BREVO_API_KEY: "test-key", RELAY_NO_LISTEN: "1",
    BREVO_ENDPOINT: `http://127.0.0.1:${brevo.address().port}/`,
  });
  ({ server: relay } = await import("./server.mjs"));
  relay.listen(0);
  await new Promise((r) => relay.once("listening", r));
  base = `http://127.0.0.1:${relay.address().port}`;
});
after(() => { relay.close(); brevo.close(); });

test("valid signed request is sent through Brevo with the house sender", async () => {
  brevoCalls = [];
  const r = await send({ to: "Member@Example.com", link: PREFIX + "abc" });
  assert.equal(r.status, 202);
  assert.equal(brevoCalls.length, 1);
  assert.equal(brevoCalls[0].key, "test-key");
  assert.equal(brevoCalls[0].body.to[0].email, "member@example.com");
  assert.equal(brevoCalls[0].body.sender.email, "no-reply@mail.kartel.org.uk");
  assert.match(brevoCalls[0].body.htmlContent, /verify\?token=abc/);
  assert.match(brevoCalls[0].body.htmlContent, /display:none[^>]*>Your sign-in link — valid for 10 minutes\./, "preheader present");
  assert.match(brevoCalls[0].body.htmlContent, />KARTEL</, "wordmark present");
});
test("wrong secret → 401, nothing sent", async () => {
  brevoCalls = [];
  const r = await send({ to: "a@example.com", link: PREFIX + "x" }, { secret: "x".repeat(40) });
  assert.equal(r.status, 401); assert.equal(brevoCalls.length, 0);
});
test("stale timestamp → 401", async () => {
  const r = await send({ to: "a@example.com", link: PREFIX + "x" }, { tsOffset: -120 });
  assert.equal(r.status, 401);
});
test("foreign link → 400 (not a general relay)", async () => {
  brevoCalls = [];
  const r = await send({ to: "a@example.com", link: "https://evil.example/phish" });
  assert.equal(r.status, 400); assert.equal(brevoCalls.length, 0);
});
test("prefix-lookalike host → 400", async () => {
  const r = await send({ to: "a@example.com", link: "https://kartel.org.uk.evil.example/api/family-auth/verify?token=x" });
  assert.equal(r.status, 400);
});
test("bad recipient → 400", async () => {
  const r = await send({ to: "not-an-email", link: PREFIX + "x" });
  assert.equal(r.status, 400);
});
test("per-recipient limit: 4th within the hour → 429", async () => {
  const to = "limit@example.com";
  for (let i = 0; i < 3; i++) assert.equal((await send({ to, link: PREFIX + i })).status, 202);
  assert.equal((await send({ to, link: PREFIX + "4" })).status, 429);
});
test("site signer and relay signer agree byte for byte", async () => {
  const { sign } = await import("./server.mjs");
  assert.equal(await signRelayRequest(SECRET, "1794660000", '{"a":1}'), sign(SECRET, "1794660000", '{"a":1}'));
});
test("a refused per-recipient request does not use up the global budget", async () => {
  const { _hits } = await import("./server.mjs");
  const to = "blocked@example.com";
  for (let i = 0; i < 3; i++) await send({ to, link: PREFIX + i });
  const before = _hits.get("global").length;
  for (let i = 0; i < 5; i++) assert.equal((await send({ to, link: PREFIX + "x" })).status, 429);
  assert.equal(_hits.get("global").length, before);
});
test("unsigned request and other paths are refused", async () => {
  assert.equal((await fetch(base + "/send", { method: "POST", body: "{}" })).status, 401);
  assert.equal((await fetch(base + "/")).status, 404);
  assert.equal((await fetch(base + "/healthz")).status, 200);
});

// Cycle 7 #3 — the email states the site's link lifetime and speaks the requester's language.
test("ttlMinutes and lang from the site reach the email; bad values fall back", async () => {
  const link = PREFIX + "abc";
  brevoCalls = [];
  assert.equal((await send({ to: "ttl-a@example.com", link, ttlMinutes: 15, lang: "ru" })).status, 202);
  const ru = brevoCalls.at(-1).body;
  assert.equal(ru.subject, "Ссылка для входа на KARTEL");
  assert.match(ru.htmlContent, /Ссылка действует 15 минут, срабатывает один раз и только в этом браузере\./);
  assert.match(ru.htmlContent, /<html lang="ru">/);
  assert.equal((await send({ to: "ttl-b@example.com", link, ttlMinutes: 999, lang: "xx" })).status, 202);
  const en = brevoCalls.at(-1).body;
  assert.equal(en.subject, "Your KARTEL sign-in link");
  assert.match(en.htmlContent, /The link works once, only in this browser, and expires in 10 minutes\./);
  assert.match(en.textContent, /expires in 10 minutes/);
});

test("email on the site's type system: serif accent heading, 16px body, ≥44px button, motto", async () => {
  const { renderSignInEmail } = await import("./server.mjs");
  const { html } = renderSignInEmail({ link: PREFIX + "x", ttlMinutes: 1, lang: "en" });
  assert.match(html, /<h1 style="[^"]*font-family:Georgia[^"]*color:#7b1e2d;">Sign in to KARTEL<\/h1>/);
  assert.match(html, /expires in 1 minute\./);
  assert.match(html, /font-size:16px;line-height:1\.6/);
  assert.match(html, /padding:14px 28px;line-height:20px/); // 14 + 20 + 14 = 48px tall
  assert.match(html, /font-style:italic;color:#7b1e2d;">Virtus et Potestas</);
  assert.doesNotMatch(html, /font-size:1[0-3]px/);
  const ru = renderSignInEmail({ link: PREFIX + "x", ttlMinutes: 21, lang: "ru" }).html;
  assert.match(ru, /действует 21 минуту,/);
});

// ── Family OS document reminders (bus 66) ──
async function remind(payload) {
  const body = JSON.stringify(payload), ts = String(Math.floor(Date.now() / 1000));
  return fetch(base + "/send-reminder", { method: "POST", headers: { "content-type": "application/json", "x-kartel-ts": ts, "x-kartel-sig": await signRelayRequest(SECRET, ts, body) }, body });
}
const LINK = "https://kartel.org.uk/ru/family/os/people/11111111-1111-4111-8111-111111111111";
const GOOD = { to: "parent@example.test", kind: "passport", firstName: "Анна", expiry: "2027-12-01", milestone: 12, link: LINK, lang: "ru" };

test("reminder: fixed template — type, first name, date, milestone; no document number anywhere", async () => {
  brevoCalls = [];
  const r = await remind({ ...GOOD, number: "QA1234567", personal_code: "999999-99999" });
  assert.equal(r.status, 202);
  const mail = JSON.stringify(brevoCalls[0].body);
  assert.ok(mail.includes("Анна") && mail.includes("паспорт") && mail.includes("1 декабря 2027") && mail.includes("через 12 месяцев"));
  assert.ok(!mail.includes("QA1234567") && !mail.includes("999999"), "unknown fields never reach the email");
  assert.equal(brevoCalls[0].body.to[0].email, "parent@example.test");
});

test("reminder: only Family OS person links, known kinds, plain first names, valid milestones", async () => {
  for (const [patch, err] of [
    [{ link: "https://evil.example/x" }, "bad_link"],
    [{ link: "https://kartel.org.uk/api/family-auth/verify?token=x" }, "bad_link"],
    [{ kind: "visa" }, "bad_kind"],
    [{ firstName: "<b>x</b>" }, "bad_name"],
    [{ firstName: "a".repeat(41) }, "bad_name"],
    [{ expiry: "01.12.2027" }, "bad_date"],
    [{ milestone: 2 }, "bad_milestone"],
  ]) {
    const r = await remind({ ...GOOD, ...patch });
    assert.equal(r.status, 400); assert.equal((await r.json()).error, err);
  }
});

test("reminder kinds: RU Russian (Latin only in parentheses), EN without Cyrillic", async () => {
  const { KINDS } = await import("./server.mjs");
  for (const v of Object.values(KINDS.ru)) assert.doesNotMatch(v.replace(/\([^)]*\)/g, ""), /[A-Za-z]/, v);
  for (const v of Object.values(KINDS.en)) assert.doesNotMatch(v, /[А-Яа-яЁё]/, v);
});

// ── Family OS engine notifications (bus 77)
const famBody = (over = {}) => ({ to: "parent@example.test", kind: "digest", lang: "ru", firstName: "Анна", date: "2026-11-18", link: "https://kartel.org.uk/ru/family/os",
  items: [{ title: "Пробежка", time: "07:00" }, { title: "Полить <цветы>", time: null }], docs: [{ type: "passport", expiry: "2027-01-31", who: "Вера" }], notes: [{ child: "Вера", title: "Почистить зубы" }], ...over });

test("send-family: only the fixed shapes pass validation", async () => {
  const { checkFamily } = await import("./server.mjs");
  assert.equal(checkFamily(famBody()), null);
  assert.equal(checkFamily(famBody({ kind: "promo" })), "bad_kind");
  assert.equal(checkFamily(famBody({ link: "https://evil.example/ru/family/os" })), "bad_link");
  assert.equal(checkFamily(famBody({ firstName: "Анна <b>" })), "bad_name");
  assert.equal(checkFamily(famBody({ items: [{ title: "x", time: "25:00" }] })), "bad_items");
  assert.equal(checkFamily(famBody({ items: [{ title: "x", number: "QA7654321" }] })), "bad_items", "no extra fields (e.g. a document number)");
  assert.equal(checkFamily(famBody({ docs: [{ type: "passport", expiry: "2027-01-31", who: "Вера", number: "123" }] })), "bad_docs");
  assert.equal(checkFamily(famBody({ items: Array.from({ length: 31 }, () => ({ title: "x" })) })), "bad_items");
  assert.equal(checkFamily(famBody({ items: [], docs: [], notes: [] })), "empty", "never an empty digest");
  assert.equal(checkFamily(famBody({ kind: "council", items: [], docs: [], notes: [] })), null, "council carries no items");
});

test("send-family: «ты», no shaming, HTML escaped, gentle parent note", async () => {
  const { renderFamilyEmail } = await import("./server.mjs");
  const d = renderFamilyEmail(famBody());
  assert.equal(d.subject, "Анна, твой день: 18 ноября");
  assert.match(d.text, /• 07:00 · Пробежка/); assert.match(d.text, /паспорт \(Вера\) — до 31 января 2027/);
  assert.match(d.text, /Вера: «Почистить зубы» — три раза подряд без отметки\. Может, стоит спокойно поговорить\./);
  assert.match(renderFamilyEmail(famBody({ docs: [{ type: "passport", expiry: "2026-11-07", who: "Анна" }] })).text, /паспорт \(Анна\) — истёк 7 ноября 2026/, "an expired document says «истёк»");
  assert.ok(d.html.includes("Полить &lt;цветы&gt;") && !d.html.includes("<цветы>"), "titles are escaped");
  const e = renderFamilyEmail(famBody({ kind: "evening", docs: [], notes: [] }));
  assert.match(e.text, /ничего страшного/);
  for (const m of [d, e]) {
    assert.doesNotMatch(m.text + m.subject, /(^|[^а-яё])(вы|вас|ваш[а-яё]*)([^а-яё]|$)/i, "«ты» only");
    assert.doesNotMatch(m.text, /пропущ|провал|не выполн|missed|failed/i, "no shaming words");
  }
  assert.equal(renderFamilyEmail(famBody({ lang: "en", kind: "council", items: [] })).subject, "Анна, family council today");
});
