// QA-158 fixes on the site (bus 159): N2 (bounded Family OS calls per page), N3 (owner tabs on the family 404),
// N4 (person index links «Вес и питание»), N5 (the remaining RU lines through the typographer).
// The live call count per page is tests/e2e/family-os-calls.e2e.mjs (CI `e2e`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { typograph, typographRuFields } from "../app/lib/typograph.mjs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NB = " ";

test("N2: every Family OS GET goes through one per-request cache; /me and /people included", () => {
  const s = src("app/lib/family-os.ts");
  assert.match(s, /import \{ cache \} from "react";/);
  assert.match(s, /const osGet = cache\(async \(path: string, actor: string\)/);
  // Only osGet and the writers call osCall directly; no GET bypasses the cache.
  for (const line of s.split("\n").filter((l) => l.includes("osCall(\"GET\""))) assert.match(line, /const r = await osCall\("GET", path, actor\);/, line);
  assert.match(s, /const meRes = await osGet\(withSat\("\/me", session\), actor\);/);
  assert.match(s, /const pRes = await osGet\(withSat\("\/people", session\), actor\);/);
  assert.match(s, /const r = await osGet\(withSat\("\/me", session\), osActor\(session\)\);/, "getOsNav");
  assert.match(s, /const r = await osGet\(withSat\(path, session\), osActor\(session\)\);/, "getJson");
});

test("N2: family links never prefetch (each prefetch was a full render: /me, /people and the page's data)", () => {
  const files = readdirSync(new URL("../app/components/", import.meta.url)).filter((f) => /^(Family.*|NotFoundView)\.tsx$/.test(f));
  let links = 0;
  for (const f of files) {
    for (const m of src(`app/components/${f}`).matchAll(/<Link\b[^>]*>/g)) { links++; assert.match(m[0], /prefetch=\{false\}/, `${f}: ${m[0].slice(0, 80)}`); }
  }
  assert.ok(links >= 20, `found ${links} family links`);
});

test("N2: a 429 from Family OS reads «Слишком много запросов», not «не отвечает»", () => {
  const s = src("app/lib/family-os.ts");
  assert.match(s, /\| \{ status: "busy" \}/);
  assert.match(s, /return \{ status: meRes\.status === 429 \? "busy" : "error" \};/);
  const d = src("app/components/FamilyOsDown.tsx");
  assert.match(d, /busy: "Слишком много запросов\. Попробуй через минуту\."/);
  assert.match(d, /busy: "Too many requests right now\. Please try again in a minute\."/);
  assert.match(d, /\{t\[status\]\}/);
});

test("N3: the family 404 gets `member`, and the chrome passes it to the sub-nav", () => {
  // bus 173: getOsNav also returns `me`; the 404 takes os + member, and `child` from me (QA bus 173: a child's own tabs)
  assert.match(src("app/[lang]/family/not-found.tsx"), /const \{ os, member, me \} = await getOsNav\(session\);\s*family = \{ admin: isFamilyAdmin\(sub\), editor: familyRole\(sub\) === "editor", os, member, child: me\?\.kind === "child" \};/);
  const c = src("app/components/FamilyChrome.tsx");
  assert.match(c, /export type FamilyChromeNav = \{ admin: boolean; editor: boolean; os: boolean; member\?: boolean; child\?: boolean \};/);
  assert.match(c, /<FamilySubNav [^>]*member=\{nav\.member \?\? true\} child=\{nav\.child \?\? false\} \/>/);
});

test("N4: the person index links «Вес и питание» once the section has loaded, between goals and letters", () => {
  const p = src("app/components/FamilyOsPerson.tsx");
  assert.match(p, /\.\.\.\(goalsShown \? \[\["#goals", t\.goals\][^\n]*\n\s*\.\.\.\(bodyShown \? \[\["#body", t\.body\][^\n]*\n\s*\.\.\.\(prefs && pauses/);
  assert.match(p, /<FamilyBody lang=\{lang\} onShown=\{setBodyShown\} \/>/);
  assert.match(p, /body: "Вес и питание"/);
  const b = src("app/components/FamilyBody.tsx");
  assert.match(b, /useEffect\(\(\) => \{ onShown\?\.\(b !== null\); \}, \[b, onShown\]\);/);
  assert.match(b, /<section id="body" aria-labelledby="body-h"/);
});

test("N5: the QA-158 lines no longer end on a short word", () => {
  const cases = [
    ["Войдите снова по ссылке из письма", `Войдите снова по${NB}ссылке из${NB}письма`],
    ["Служу, а не командую. Беру ответственность первым", `Служу, а${NB}не${NB}командую. Беру ответственность первым`],
    ["напиши владельцу семейного раздела и назови код:", `напиши владельцу семейного раздела и${NB}назови код:`],
    ["Каждое изменение уходит на утверждение", `Каждое изменение уходит на${NB}утверждение`],
    ["основой идентичности и памяти", `основой идентичности и${NB}памяти`],
  ];
  for (const [i, o] of cases) assert.equal(typograph(i), o, i);
});

test("N5: heritage content — only the RU fields are typographed, nothing else changes", () => {
  const nodes = [{ id: "a", nameEN: "and in", nameRU: "Пётр", descEN: "a to b", descRU: "род от его корней", nested: { textRU: "и в доме" } }];
  assert.deepEqual(typographRuFields(nodes), [{ id: "a", nameEN: "and in", nameRU: "Пётр", descEN: "a to b", descRU: `род от${NB}его${NB}корней`, nested: { textRU: `и${NB}в${NB}доме` } }]);
  assert.match(src("app/[lang]/family/page.tsx"), /const HERITAGE_NODES = typographRuFields\(FAMILY_TREE_NODES\), HERITAGE_EVENTS = typographRuFields\(FAMILY_TIMELINE_EVENTS\);/);
  assert.match(src("app/[lang]/family/page.tsx"), /content: upperLang === "RU" \? typographDict\(familyContent\.RU\) : familyContent\.EN/);
});

test("N5: sign-in, the family 404 and error, the editor, the week sheet and recognitions read through the typographer", () => {
  assert.match(src("app/components/FamilyGateNotice.tsx"), /const COPY_RU = typographDict\(copy\.ru\);/);
  assert.match(src("app/components/FamilyGateNotice.tsx"), /const c: Copy = lang === "ru" \? COPY_RU : copy\.en;/);
  assert.match(src("app/components/NotFoundView.tsx"), /const f = lang === "ru" \? FAMILY_REF_RU : familyRefText\.en;/);
  assert.match(src("app/[lang]/family/error.tsx"), /f = lang === "ru" \? FAMILY_REF_RU : familyRefText\.en;/);
  assert.match(src("app/components/FamilyAdmin.tsx"), /const t = tx\(T, lang\);/);
  const w = src("app/components/FamilyWeek.tsx");
  assert.match(w, /\{ty\(principle\.principle\)\}/); assert.match(w, /\{ty\(r\.principle\)\}/);
  assert.match(src("app/components/FamilyKodeks.tsx"), /\{personName\(r\.to, lang\)\} · \{ty\(r\.principle, lang\)\}/);
});
