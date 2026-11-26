// Bus 172 P3: a child's Family OS is «Мой день» + «Календарь» — the menu and the server agree. Every other OS page
// sends a child home before it reads anything; «Мой день» has big task cards, the schedule and no invented stars.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { osShellNav, childMayOpenPath } from "../app/lib/family-os-shell.mjs";
import { osSessionState } from "../app/lib/family-os-session.mjs";
import { todayModel } from "../app/lib/family-today.mjs";

const src = (p) => readFileSync(p, "utf8");

test("menu: a child sees «Мой день» and «Календарь» only — sidebar, tab bar and ⌘K alike", () => {
  for (const [lang, labels] of [["RU", ["Мой день", "Календарь"]], ["EN", ["My day", "Calendar"]]]) {
    const n = osShellNav({ lang, admin: false, os: true, member: true, child: true, editor: true, badges: { board: 3 } });
    assert.deepEqual(n.groups.map((g) => g.items.map((i) => i.label)), [labels]);
    assert.deepEqual(n.tabs.map((i) => i.href), [`/${lang.toLowerCase()}/family/os`, `/${lang.toLowerCase()}/family/os/calendar`]);
    assert.ok(n.tabs.every((i) => !i.badge));
  }
  // an adult member keeps the full menu
  assert.equal(osShellNav({ lang: "RU", admin: false, os: true, member: true, child: false }).groups.flatMap((g) => g.items).length, 7);
  const lay = src("app/[lang]/family/os/layout.tsx");
  assert.match(lay, /child: state\.me\?\.kind === "child"/, "decided on the server, from Family OS");
});

test("server: every other OS page sends a child to «Мой день» before it reads its data", () => {
  const h = src("app/lib/family-child.ts");
  assert.match(h, /if \(me\?\.kind === "child" && !own\) redirect\(`\/\$\{lang === "en" \? "en" : "ru"\}\/family\/os`\);/);
  const before = { "board/page.tsx": "getBoard(session", "council/page.tsx": "getCouncil(session", "people/page.tsx": "getBoard(session", "kodeks/page.tsx": "getKodeks(session",
    "week/page.tsx": "getPrinciple(session", "access/page.tsx": "getRules(session", "people/[id]/page.tsx": "getPersonPage(session" };
  for (const [p, read] of Object.entries(before)) {
    const s = src(`app/[lang]/family/os/${p}`);
    const at = s.indexOf("childHome(lang, state.me");
    assert.ok(at > 0, `${p} calls childHome`);
    assert.ok(at < s.indexOf(read, s.indexOf("export default")), `${p}: before ${read}`);
  }
  assert.match(src("app/[lang]/family/os/people/[id]/page.tsx"), /childHome\(lang, state\.me, state\.me\?\.id === id\);/, "the child's own page stays open");
  for (const p of ["page.tsx", "calendar/page.tsx"]) assert.doesNotMatch(src(`app/[lang]/family/os/${p}`), /childHome/, `${p} is the child's own section`);
});

test("«Мой день»: big tick cards on the existing routes, the schedule, no stars; links only to the child's sections", () => {
  const c = src("app/components/FamilyToday.tsx");
  const kid = c.slice(c.indexOf("function ChildDay("));
  assert.match(c, /if \(model\.child\) return <ChildDay /);
  assert.match(kid, /role="checkbox" aria-checked=\{x\.done\} aria-label=\{t\.check\(x\.title\)\}[^>]*onClick=\{\(\) => tick\(x\)\} data-kid-task=""/);
  assert.match(c, /osSend\("POST", `tasks\/\$\{x\.id\}\/done`\)/, "the tick is the existing «Готово»");
  assert.doesNotMatch(kid, /★|☆|stars?\b|звёзд|streak|подряд/i, "no star counter — Family OS has none");
  assert.match(kid, /<TodayPrinciple lang=\{lang\} principle=\{principle\} link=\{false\} \/>/, "no link to the Кодекс");
  assert.doesNotMatch(kid, /TodayCouncil|\/board|\/council|\/people`|\/kodeks|\/week/, "nothing that would send the child back home");
  assert.match(kid, /href=\{`\$\{base\}\/calendar`\}/);
  const cal = src("app/components/FamilyCalendar.tsx");
  assert.match(cal, /\{!child && <p><Link prefetch=\{false\} href=\{`\$\{base\}\/week`\}/, "no family week sheet link for a child");
});

test("model: a child's first name for «Привет, Вера!»; no adult blocks", () => {
  const me = { id: "v", kind: "child", name_en: "Vera K", name_ru: "Вера К" };
  const m = todayModel({ lang: "RU", me, admin: false, people: [], myBoard: { today: "2026-11-26", new: [], mine: [] }, routines: null, board: null, calendar: null, reminders: [], hour: 9, today: "2026-11-26" });
  assert.equal(m.name, "Вера"); assert.equal(m.child, true);
  assert.equal(m.decisions, null); assert.equal(m.family, null);
});

test("edge: a child is sent to «Мой день» with a real 307 before any page renders; their own page and Календарь stay open", async () => {
  const own = "00000000-0000-4000-8000-00000000000c", other = "00000000-0000-4000-8000-00000000000a";
  for (const p of ["/ru/family/os", "/en/family/os/", "/ru/family/os/calendar", `/ru/family/os/people/${own}`]) assert.equal(childMayOpenPath(p, own), true, p);
  for (const p of ["/ru/family/os/board", "/ru/family/os/council", "/ru/family/os/people", `/ru/family/os/people/${other}`, "/ru/family/os/kodeks", "/ru/family/os/week", "/ru/family/os/access", "/en/family/os/board?date=2026-11-27"])
    assert.equal(childMayOpenPath(p.split("?")[0], own), false, p);
  assert.equal(childMayOpenPath(`/ru/family/os/people/${own}`, null), false, "no id from the service: closed");
  assert.equal(childMayOpenPath("/ru/family", own), true, "heritage is outside Family OS — not decided here");
  const px = src("proxy.ts");
  assert.match(px, /if \(os\.state === "ok" && os\.child && !childMayOpenPath\(pathname, os\.id\)\) return NextResponse\.redirect\(new URL\(`\/\$\{lang\}\/family\/os`, request\.url\), 307\);/);
  // the edge's /me answer carries the kind and the id
  const env = { FAMILY_OS_URL: "http://os.test", FAMILY_OS_SECRET: "x".repeat(40) };
  const reply = (body, status = 200) => async () => new Response(JSON.stringify(body), { status });
  assert.deepEqual(await osSessionState({ email: "c1@example.com", admin: false, iat: 1 }, env, reply({ me: { id: own, kind: "child" }, admin: false })), { state: "ok", member: true, child: true, id: own });
  assert.deepEqual(await osSessionState({ email: "a1@example.com", admin: false, iat: 1 }, env, reply({ me: { id: other, kind: "adult" }, admin: false })), { state: "ok", member: true, child: false, id: other });
  assert.deepEqual(await osSessionState({ email: "d1@example.com", admin: false, iat: 1 }, env, reply({}, 503)), { state: "unknown", member: false, child: false, id: null });
});

// bus 172 P3 QA (acceptor): no link on a child's pages leads to a page that sends them back to «Мой день».
test("QA: a child's pages carry no dead-end links (Люди, Решения) and /os is titled «Мой день»", () => {
  assert.match(src("app/components/FamilyOsPerson.tsx"), /\{!\(ok && state\.me\?\.kind === "child"\) && <p className="text-\[15px\]"><Link prefetch=\{false\} href=\{`\$\{base\}\/people`\}/);
  const cal = src("app/components/FamilyCalendar.tsx");
  assert.match(cal, /i\.kind === "council" && !child \? <Link/);
  assert.match(cal, /canWrite=\{canWrite\} base=\{base\} child=\{child\} \/>/);
  assert.match(src("app/components/FamilyKodeks.tsx"), /\{councilLink && items\.length > 0 && <p className="mt-2"><Link prefetch=\{false\} href=\{councilHref\(lang\)\}/);
  assert.match(src("app/components/FamilyToday.tsx"), /items=\{recognitions\} councilLink=\{false\} \/>/);
  assert.match(src("app/[lang]/family/os/page.tsx"), /child \? \(lang === "ru" \? "Мой день · Семья" : "My day · Family"\)/);
});
