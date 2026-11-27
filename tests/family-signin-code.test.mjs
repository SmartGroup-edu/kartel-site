// bus 165: the one-time code fallback and the named link failures. Helpers run for real; the routes import
// next/headers and cannot run here, so their guarantees are checked in the source (as the other route guards in
// tests/ do). The behaviour end to end is tests/e2e/family-signin-code.e2e.mjs.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newCode, normCode, nonceHash, emailKey, codeHash, LINK_REASONS } from "../app/lib/family-signin-code.mjs";
import { linkNonceCookie } from "../app/lib/family-cookie.mjs";

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const SECRET = "test-secret-at-least-32-characters-long!!";

describe("code helpers", () => {
  test("six ASCII digits, leading zeros kept, spread over the range", () => {
    const seen = new Set();
    for (let i = 0; i < 2000; i++) { const c = newCode(); assert.match(c, /^[0-9]{6}$/); seen.add(c); }
    assert.ok(seen.size > 1990, "no obvious repetition");
    const firsts = new Set([...seen].map((c) => c[0]));
    assert.equal(firsts.size, 10, "every leading digit occurs, 0 included");
  });

  test("what a person types: spaces, dashes, full-width digits; anything else is refused", () => {
    assert.equal(normCode("042 917"), "042917");
    assert.equal(normCode(" 042-917 "), "042917");
    assert.equal(normCode("０４２９１７"), "042917");
    for (const bad of ["42917", "0429171", "04a917", "", null, 42917, "1".repeat(40)]) assert.equal(normCode(bad), null, String(bad));
  });

  test("hashes: fixed-length hex, deterministic, labelled apart, the address case-folded", async () => {
    const n = await nonceHash("nonce-1"), e = await emailKey(SECRET, " Member@Example.com "), c = await codeHash(SECRET, "042917");
    for (const h of [n, e, c]) assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(e, await emailKey(SECRET, "member@example.com"));
    assert.notEqual(c, await codeHash(SECRET, "042918"));
    assert.notEqual(await codeHash(SECRET, "042917"), await emailKey(SECRET, "042917"), "different labels, different keys");
    assert.notEqual(c, await codeHash("another-secret-at-least-32-characters!!", "042917"), "the code hash depends on the site's secret");
    assert.deepEqual(LINK_REASONS, ["expired", "superseded", "elsewhere", "used"]);
  });

  test("the nonce cookie is __Host- in production and has no env override", () => {
    assert.equal(linkNonceCookie({ NODE_ENV: "production" }), "__Host-kartel_family_link");
    assert.equal(linkNonceCookie({ NODE_ENV: "development" }), "kartel_family_link");
    assert.doesNotMatch(src("app/lib/family-env.ts"), /FAMILY_LINK_NONCE_COOKIE/);
    // __Host- needs Secure, Path=/ and no Domain — the cookie is set exactly so.
    const set = src("app/lib/family-auth.ts").match(/export async function issueSignInNonce[\s\S]*?\n}/)[0];
    assert.match(set, /secure: process\.env\.NODE_ENV === "production"/);
    assert.match(set, /path: "\/"/);
    assert.doesNotMatch(set, /domain:/i);
  });
});

describe("verify route (bus 165)", () => {
  const v = src("app/api/family-auth/verify/route.ts");
  const get = v.slice(v.indexOf("export async function GET"), v.indexOf("export async function POST"));
  const post = v.slice(v.indexOf("export async function POST"));

  test("a link opened without its cookie is only READ in Family OS, never used up (mail scanners, other browsers)", () => {
    const failed = get.slice(get.indexOf("if (!chk.ok)"), get.indexOf("const claims = chk.claims"));
    assert.match(failed, /await pendingState\(nonce\)/);
    assert.doesNotMatch(failed, /consumePending|createSession/);
    assert.ok(get.indexOf("await consumePending(") > get.indexOf("const claims = chk.claims"), "consume only after cookie and token match");
  });

  test("named reasons, the plain invalid for anything forged; the log carries the reason code only", () => {
    assert.match(get, /reason: "invalid" \| "expired" \| "elsewhere" \| "superseded" \| "used"/);
    assert.match(get, /console\.warn\(`\[family-auth\/verify\] link \$\{reason\}`\)/);
    assert.match(post, /console\.info\(`\[family-auth\/verify\] code \$\{r\.state\}`\)/);
    // Every log line interpolates at most the reason code — never an address, token, nonce or code.
    for (const line of v.match(/console\.\w+\([^;]*\);/g) ?? []) {
      for (const [x] of line.matchAll(/\$\{[^}]*\}/g)) assert.ok(x === "${reason}" || x === "${r.state}", line);
    }
  });

  test("the code: same Origin, JSON only, the cookie of the tab that asked, allowlist re-checked, then the session", () => {
    assert.match(post, /request\.headers\.get\("origin"\) !== familyEnv\.siteOrigin\(\)\) return cjson\(403/);
    assert.match(post, /startsWith\("application\/json"\)\) return cjson\(415/);
    assert.match(post, /const nonce = await readSignInNonce\(\);\s*if \(!nonce\) return cjson\(400, \{ error: "no_request" \}\)/);
    assert.match(post, /r\.state === "ok" && r\.email && \(await isViewerApproved\(r\.email, r\.email\)\)/);
    assert.ok(post.indexOf("isViewerApproved") < post.indexOf("createSession"));
    assert.match(post, /safeReturnTo\(rt,/, "returnTo is sanitised");
  });

  test("the request route records a pending sign-in for EVERY well-formed address, before the member check returns", () => {
    const r = src("app/api/family-auth/request/route.ts");
    const a = r.slice(r.indexOf("after(async"));
    assert.ok(a.indexOf("await recordPending(nonce, addr, member)") < a.indexOf("if (!member) return;"));
  });

  test("Family OS sees hashes only: no raw code, nonce or stranger's address leaves the site", () => {
    const s = src("app/lib/family-signin.ts");
    assert.match(s, /nonce_hash: await nonceHash\(nonce\)/);
    assert.match(s, /code_hash: await codeHash\(/);
    assert.match(s, /email: member \? email\.trim\(\)\.toLowerCase\(\) : null/);
    assert.doesNotMatch(s, /\bcode: code\b|\bnonce: nonce\b|\bcode,\s*$/m);
  });
});

describe("sign-in page (bus 165)", () => {
  const n = src("app/components/FamilyGateNotice.tsx");

  test("after «Email me a link»: the code field in the same tab, RU and EN", () => {
    // bus 176 P1: the mockup's six cells — the first carries the phone's one-time-code autofill
    assert.match(n, /\{codes && <CodeForm c=\{c\} returnTo=\{returnTo\} onSuccess=\{\(to\) => goWelcome\(setWelcome, to\)\} \/>\}/);
    assert.match(n, /codeLabel: "Код из письма"/);
    assert.match(n, /codeLabel: "Code from the email"/);
    assert.match(n, /autoComplete=\{i === 0 \? "one-time-code" : "off"\}/);
    assert.match(n, /useState<string\[\]>\(\["", "", "", "", "", ""\]\)/);
    assert.match(n, /onPaste=/);
    assert.match(n, /inputMode="numeric"/);
    assert.match(n, /fetch\("\/api\/family-auth\/verify", \{\s*method: "POST"/);
  });

  test("another browser: a calm page that never shows a code, and a new link offered here", () => {
    const block = n.slice(n.indexOf('} else if (state === "elsewhere") {'), n.indexOf('{state === "ended"'));
    assert.match(block, /c\.elsewhereTitle/);
    assert.doesNotMatch(block, /role="alert"|destructive/, "not an error");
    assert.doesNotMatch(block, /CodeForm|\{code\}/);
    assert.match(n, /elsewhereTitle: "Ссылка открылась в другом браузере"/);
    assert.match(n, /elsewhere: "Вернитесь во вкладку, где запрашивали вход, и введите там код из письма/);
    assert.match(n, /ctaHere: "Прислать новое письмо сюда"/);
  });

  test("superseded, expired and used each have their own words", () => {
    assert.match(n, /superseded: "Это не последняя ссылка — откройте самое новое письмо\./);
    assert.match(n, /expired: \(min: number\) => `Ссылка устарела/);
    assert.match(n, /used: "Эта ссылка уже сработала/);
    for (const k of ["wrong", "locked", "superseded", "expired", "used", "no_request", "format", "rate_limited", "other"]) {
      assert.equal((n.match(new RegExp(`\\b${k}: `, "g")) ?? []).length >= 2, true, `codeErr.${k} in both languages`);
    }
  });

  test("the page accepts exactly the states the route sends", () => {
    const p = src("app/[lang]/family/signin/page.tsx");
    assert.match(p, /const STATES = \["invalid", "ended", "expired", "elsewhere", "superseded", "used"\] as const;/);
  });
});
