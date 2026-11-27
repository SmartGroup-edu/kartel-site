// E2E (bus 165): the one-time code beside the email link, and the named link failures, against a real
// `next start`. Runs the real Family OS app (memory store, its clock under test control) on :18795 and a fake mail
// relay on :18797 that keeps the letters the site sends, so the test can read the link and the code exactly as a
// person would. Synthetic addresses only; test-only secrets. NOT part of `npm test`; CI `e2e` job.
//   site env: the family-auth e2e env + FAMILY_OS_URL=http://127.0.0.1:18795 FAMILY_OS_SECRET=… and
//             FAMILY_MAIL_RELAY_URL=http://127.0.0.1:18797
//   node tests/e2e/family-signin-code.e2e.mjs
// Never point this at production.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createApp } from "../../family-os/server.mjs";
import { memoryStore } from "../../family-os/store.mjs";
import { familySessionCookie, linkNonceCookie } from "../../app/lib/family-cookie.mjs";

const B = process.env.E2E_BASE ?? "http://localhost:3999";
const SESSION = familySessionCookie({ NODE_ENV: "production" }), NONCE = linkNonceCookie({ NODE_ENV: "production" });
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

// ── Family OS (in process; its clock can be moved forward) and the fake relay ──
let skew = 0;
const os = createServer(createApp({ store: memoryStore(), secret: process.env.FAMILY_OS_SECRET, masterKey: randomBytes(32), passkeys: null, clock: () => new Date(Date.now() + skew) })).listen(18795, "127.0.0.1");
const letters = [];
const relay = createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c));
  req.on("end", () => { try { letters.push(JSON.parse(raw)); } catch { /* ignore */ } res.writeHead(202, { "content-type": "application/json" }); res.end('{"ok":true}'); });
}).listen(18797, "127.0.0.1");
await Promise.all([os, relay].map((s) => new Promise((r) => s.once("listening", r))));

const cookieOf = (res, name) => { const c = (res.headers.getSetCookie?.() ?? []).find((s) => s.startsWith(name + "=")); return c ? c.split(";")[0].slice(name.length + 1) : null; };
const req = (path, opts = {}) => fetch(B + path, { redirect: "manual", ...opts });
const json = (o) => ({ "content-type": "application/json", origin: B, ...o });

/** Ask for a link as a browser would; returns this browser's nonce and (for members) the letter. */
async function ask(email, lang = "en") {
  const n = letters.length;
  const r = await req("/api/family-auth/request", { method: "POST", headers: json(), body: JSON.stringify({ email, returnTo: `/${lang}/family` }) });
  const nonce = cookieOf(r, NONCE);
  let letter = null;
  for (let i = 0; i < 40 && !letter; i++) { await new Promise((s) => setTimeout(s, 50)); letter = letters.slice(n).find((l) => l.to === email) ?? null; }
  return { nonce, letter, path: letter ? new URL(letter.link).pathname + new URL(letter.link).search : null };
}
const openLink = (path, nonce) => req(path, nonce ? { headers: { cookie: `${NONCE}=${nonce}` } } : {});
const typeCode = (code, nonce, origin = B) => req("/api/family-auth/verify", {
  method: "POST", headers: { ...json({ origin }), ...(nonce ? { cookie: `${NONCE}=${nonce}` } : {}) }, body: JSON.stringify({ code, returnTo: "/en/family" }),
});
const reason = (r) => new URL(r.headers.get("location") ?? "/", B).searchParams.get("family_auth");
const M = "member@example.com";

// ── the letter ──
const a = await ask(M);
check("the letter carries the link and a six-digit code", !!a.letter && /^[0-9]{6}$/.test(a.letter.code ?? ""), JSON.stringify(a.letter && { ...a.letter, to: "…", link: "…", code: a.letter.code ? "######" : null }));
const stranger = await ask("stranger@example.com");
check("no letter for a stranger", stranger.letter === null);

// ── link in the same browser → OK; again → used ──
const ok = await openLink(a.path, a.nonce);
check("link in the same browser → session, back to returnTo", ok.status === 307 && !!cookieOf(ok, SESSION) && (ok.headers.get("location") ?? "").endsWith("/en/family"), `${ok.status}`);
const again = await openLink(a.path, a.nonce);
check("the same link a second time → «used» (single use)", reason(again) === "used" && !cookieOf(again, SESSION), reason(again));

// ── link in a different browser → the helper page, which never shows the code ──
const b = await ask(M);
const other = await openLink(b.path, null);
check("link in a different browser → «elsewhere»", reason(other) === "elsewhere" && !cookieOf(other, SESSION), reason(other));
const page = await (await req(new URL(other.headers.get("location"), B).pathname + new URL(other.headers.get("location"), B).search)).text();
check("the helper page says so calmly and offers a new link here", page.includes("This link opened in a different browser") && page.includes("Send a new email here") && !page.includes('role="alert"'));
check("the helper page never shows the code", !page.includes(b.letter.code) && !page.includes(`${b.letter.code.slice(0, 3)} ${b.letter.code.slice(3)}`));
const otherRu = await openLink((await ask(M, "ru")).path, null);
const pageRu = await (await req(new URL(otherRu.headers.get("location"), B).pathname + new URL(otherRu.headers.get("location"), B).search)).text();
check("…and in Russian", pageRu.replace(/ /g, " ").includes("Ссылка открылась в другом браузере"));

// ── code in the original tab → OK ──
const c = await ask(M);
const opened = await openLink(c.path, null); // a scanner or another browser opens the link first
const byCode = await typeCode(` ${c.letter.code.slice(0, 3)} ${c.letter.code.slice(3)} `, c.nonce);
const byCodeBody = await byCode.json();
check("code in the original tab (with spaces) → session", reason(opened) === "elsewhere" && byCode.status === 200 && byCodeBody.ok === true && !!cookieOf(byCode, SESSION), `${byCode.status} ${JSON.stringify(byCodeBody)}`);
check("…the nonce is cleared and the link is used up", (cookieOf(byCode, NONCE) ?? "x") === "" && reason(await openLink(c.path, c.nonce)) === "used");
check("…the code a second time → used", (await (await typeCode(c.letter.code, c.nonce)).json()).error === "used");

// ── wrong code ×5 → locked ──
const d = await ask(M);
const wrong = d.letter.code === "000000" ? "000001" : "000000";
const answers = [];
for (let i = 0; i < 5; i++) { const r = await typeCode(wrong, d.nonce); answers.push([r.status, await r.json()]); }
check("wrong code ×4 → «wrong» with attempts left 4…1", answers.slice(0, 4).every(([s, j], i) => s === 400 && j.error === "wrong" && j.left === 4 - i), JSON.stringify(answers.slice(0, 4)));
check("5th wrong code → locked", answers[4][0] === 429 && answers[4][1].error === "locked", JSON.stringify(answers[4]));
const late = await typeCode(d.letter.code, d.nonce);
check("…then even the right code is refused", late.status === 429 && !cookieOf(late, SESSION));

// ── superseded link and superseded code ──
const e1 = await ask(M), e2 = await ask(M);
check("older link in the browser that asked again → «superseded»", reason(await openLink(e1.path, e2.nonce)) === "superseded");
check("older link with its own cookie (another browser asked again) → «superseded»", reason(await openLink(e1.path, e1.nonce)) === "superseded");
check("older link opened elsewhere → «superseded», not «elsewhere»", reason(await openLink(e1.path, null)) === "superseded");
const oldCode = await (await typeCode(e1.letter.code, e2.nonce)).json();
check("older letter's code in the newest tab → «superseded»", oldCode.error === "superseded", JSON.stringify(oldCode));
check("older code in its own tab → «superseded»", (await (await typeCode(e1.letter.code, e1.nonce)).json()).error === "superseded");
check("the newest code still works", (await typeCode(e2.letter.code, e2.nonce)).status === 200);

// ── expired ──
const f = await ask(M);
skew = 11 * 60 * 1000;
const expCode = await (await typeCode(f.letter.code, f.nonce)).json();
check("code after 10 minutes → «expired»", expCode.error === "expired", JSON.stringify(expCode));
skew = 0;

// ── a stranger's request answers like a member's ──
const s = await (await typeCode("123456", stranger.nonce)).json();
check("a code against a stranger's request → «wrong» with attempts left, like a member's", s.error === "wrong" && s.left === 4, JSON.stringify(s));

// ── the edges ──
check("code without this browser's request → no_request", (await (await typeCode("123456", null)).json()).error === "no_request");
check("code from another site → 403", (await typeCode("123456", a.nonce, "https://evil.example")).status === 403);
check("code without Origin → 403", (await req("/api/family-auth/verify", { method: "POST", headers: { "content-type": "application/json", cookie: `${NONCE}=${a.nonce}` }, body: "{}" })).status === 403);
check("not six digits → format", (await (await typeCode("12345", a.nonce)).json()).error === "format");
// The RU typographer binds short words with NBSP; compare with plain spaces.
const sentPage = await req("/ru/family/signin?sent=1&returnTo=%2Fru%2Ffamily"), sentHtml = (await sentPage.text()).replace(/ /g, " ");
check("the sent page shows the code field (RU)", sentHtml.includes('id="family-code"') && sentHtml.includes("Код из письма") && sentHtml.includes('autoComplete="one-time-code"'), `${sentPage.status}`);

os.close(); relay.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
