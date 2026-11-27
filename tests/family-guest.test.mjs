// bus 176 P4: the read-only guest on the site — the path rules the edge uses, the lookup against Family OS (fail-closed),
// the guest's menu, and the wiring: only the guest's four section pages and the Family OS shell accept a guest; every
// other page and API route still requires the family list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { guestSectionOfPath, guestMayOpenPath, guestHome, guestBarText, guestDate, guestLookup, GUEST_SECTIONS } from "../app/lib/family-guest.mjs";
import { osShellNav } from "../app/lib/family-os-shell.mjs";
import { GUEST_SECTIONS as SERVICE_SECTIONS } from "../family-os/guest.mjs";

const src = (p) => readFileSync(p, "utf8");

test("paths: only the four section pages; nothing else under /family, never /os/week", () => {
  assert.deepEqual(GUEST_SECTIONS, SERVICE_SECTIONS, "site and service agree on the allow-list");
  assert.equal(guestSectionOfPath("/ru/family/os/calendar"), "calendar");
  assert.equal(guestSectionOfPath("/en/family/os/review/"), "review");
  for (const p of ["/ru/family", "/ru/family/os", "/ru/family/os/week", "/ru/family/os/people", "/ru/family/os/access", "/ru/family/admin", "/ru/core", "/ru/registry", "/ru/family/os/calendar/x"])
    assert.equal(guestSectionOfPath(p), null, p);
  assert.equal(guestMayOpenPath("/ru/family/os/kodeks", ["calendar"]), false);
  assert.equal(guestMayOpenPath("/ru/family/os/calendar", ["calendar"]), true);
  assert.equal(guestHome("ru", ["review", "companies"]), "/ru/family/os/companies", "menu order, not the order given");
  assert.equal(guestHome("EN", ["review"]), "/en/family/os/review");
});

test("the bar: «Только чтение · доступ до …»", () => {
  assert.equal(guestBarText("2027-03-31", "RU"), "Только чтение · доступ до 31 марта 2027");
  assert.equal(guestBarText("2027-03-31", "EN"), "Read only · access until 31 March 2027");
  assert.equal(guestDate("bad", "RU"), "");
});

test("lookup: active / none / ended / unknown; signed as auth:guest; fail-closed when the service is off or down", async () => {
  const env = { FAMILY_OS_URL: "http://os.test", FAMILY_OS_SECRET: "x".repeat(40) };
  let seen;
  const fake = (status, body) => async (url, init) => { seen = { url: String(url), init }; return new Response(JSON.stringify(body), { status }); };
  const g = { id: "0b0e7f5c-1a2b-4c3d-8e4f-123456789abc", label: "Бухгалтер", sections: ["calendar", "people"], until: "2027-03-31" };
  const a = await guestLookup({ email: " A@B.test ", sat: 5, section: "calendar" }, env, fake(200, { guest: g }));
  assert.deepEqual(a, { state: "active", guest: { ...g, sections: ["calendar"] } }, "an unknown section is dropped");
  assert.equal(seen.url, "http://os.test/guests/lookup");
  assert.equal(seen.init.headers["x-kartel-actor"], "auth:guest");
  assert.deepEqual(JSON.parse(seen.init.body), { email: "a@b.test", sat: 5, section: "calendar" });
  assert.deepEqual(await guestLookup({ email: "a@b.test" }, env, fake(404, { error: "not_found" })), { state: "none" });
  assert.deepEqual(await guestLookup({ email: "a@b.test" }, env, fake(401, { error: "session_ended" })), { state: "ended" });
  assert.deepEqual(await guestLookup({ email: "a@b.test" }, env, fake(503, { error: "log_unavailable" })), { state: "unknown" });
  assert.deepEqual(await guestLookup({ email: "a@b.test" }, env, async () => { throw new Error("down"); }), { state: "unknown" });
  assert.deepEqual(await guestLookup({ email: "a@b.test" }, {}, fake(200, { guest: g })), { state: "unknown" }, "Family OS off → no guest");
});

test("menu: a guest sees exactly their sections — no «Сегодня», people, heritage, registry or settings", () => {
  const n = osShellNav({ lang: "RU", admin: false, os: true, member: false, guest: ["companies", "calendar"] });
  const ids = n.groups.flatMap((g) => g.items.map((x) => x.id));
  assert.deepEqual(ids, ["calendar", "companies"]);
  assert.deepEqual(n.tabs.map((x) => x.id), ["calendar", "companies"]);
  assert.ok(!JSON.stringify(n).includes("/registry"));
});

test("wiring: the edge asks for a guest only after the list said no, and sends a guest home from anything else", () => {
  const p = src("proxy.ts");
  const gate = p.slice(p.indexOf("async function familyEdgeGate"), p.indexOf("function detectLocale"));
  assert.ok(gate.indexOf("isViewerApproved(sub, email)") < gate.indexOf("guestLookup("), "the list first");
  assert.match(gate, /if \(g\.state === "ended"\) return sessionEnded/);
  assert.match(gate, /if \(g\.state !== "active"\) return NextResponse\.redirect\(new URL\(`\/\$\{lang\}\/family\/pending`/, "unknown, revoked, expired or silent → pending, as an unknown address");
  assert.match(gate, /if \(area === "business"\) return NextResponse\.redirect\(home, 307\)/, "Core and the registry are closed to a guest");
  assert.match(gate, /if \(!guestMayOpenPath\(pathname, sections\)\) return NextResponse\.redirect\(home, 307\)/);
});

test("wiring: only the four section pages and the shell accept decision \"guest\"; every API route still needs \"allow\"", () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f)) files.push(p); } };
  walk("app");
  const accepting = files.filter((f) => /decision [!=]== "guest"/.test(src(f))).sort();
  assert.deepEqual(accepting, ["app/[lang]/family/os/calendar/page.tsx", "app/[lang]/family/os/companies/page.tsx", "app/[lang]/family/os/kodeks/page.tsx", "app/[lang]/family/os/layout.tsx", "app/[lang]/family/os/review/page.tsx"]);
  for (const f of files.filter((x) => x.startsWith("app/api/") && /familyGateDecision\(\)/.test(src(x))))
    assert.match(src(f), /decision !== "allow"/, `${f} refuses anything but the family list`);
  for (const [page, section] of [["calendar", "calendar"], ["companies", "companies"], ["kodeks", "kodeks"], ["review", "review"]])
    assert.match(src(`app/[lang]/family/os/${page}/page.tsx`), new RegExp(`decision === "guest" && guestMay\\(session, "${section}"\\)`), page);
});

test("wiring: the actor is guest:<id>; a guest's sign-in goes to the guest log; the owner's invite checks the family list", () => {
  assert.match(src("app/lib/family-os.ts"), /if \(session\.guest\) return `guest:\$\{session\.guest\.id\}`;/);
  const v = src("app/api/family-auth/verify/route.ts");
  assert.equal((v.match(/as === "guest" \? guestSignedIn/g) ?? []).length, 2, "link and code");
  assert.match(src("app/api/family-auth/request/route.ts"), /const member = \(await signInAs\(addr\)\) !== null;/);
  const api = src("app/api/family-os/[...op]/route.ts");
  assert.match(api, /g\.actor\.startsWith\("admin:"\) && email && \(await accessListState\(email\)\) === "listed"\) return json\(409, \{ error: "is_member" \}\)/);
  assert.match(src("app/components/FamilyOsShell.tsx"), /data-guest-bar=""/);
});
