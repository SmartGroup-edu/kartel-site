// Stage 3d-1 site pieces (bus 86): the gentle weekly count, anchors, the if–then line, and source guards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { weekText, anchorLabel, ifThenText } from "../app/lib/family-routines.mjs";

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = (f) => readFileSync(f, "utf8");

test("weekText: «N из M на этой неделе»; never negative, never above M; empty when nothing is due", () => {
  assert.equal(weekText({ done: 3, of: 7 }, "RU"), "3 из 7 на этой неделе");
  assert.equal(weekText({ done: 0, of: 5 }, "RU"), "0 из 5 на этой неделе", "a week with nothing done is just zero — no «потеряно»");
  assert.equal(weekText({ done: 2, of: 3 }, "EN"), "2 of 3 this week");
  assert.equal(weekText({ done: -1, of: 7 }, "RU"), "0 из 7 на этой неделе");
  assert.equal(weekText({ done: 9, of: 7 }, "RU"), "7 из 7 на этой неделе");
  assert.equal(weekText({ done: 0, of: 0 }, "RU"), ""); assert.equal(weekText(null, "RU"), "");
});

test("anchor and if–then: «После завтрака → Собрать портфель»", () => {
  assert.equal(anchorLabel({ anchor_text: "после завтрака" }, "RU"), "После завтрака");
  assert.equal(anchorLabel({ anchor_text: "ужин" }, "RU"), "После: ужин");
  assert.equal(anchorLabel({ anchor_title: "Завтрак" }, "RU"), "После «Завтрак»");
  assert.equal(anchorLabel({}, "RU"), "");
  assert.equal(ifThenText("После завтрака", "Собрать портфель", "RU"), "Если после завтрака — то я: собрать портфель");
  assert.equal(ifThenText("", "Собрать портфель", "RU"), "");
});

test("no streak wording for children: the Today list shows the streak only when the service sent one", () => {
  const r = src("app/components/FamilyRoutines.tsx");
  assert.match(r, /r\.streak !== undefined \? streakText\(/, "streak text only when present (adult opted in)");
  assert.match(r, /weekText\(/);
  const prefs = src("app/components/FamilyPrefs.tsx");
  assert.doesNotMatch(prefs, /серии просто ждут|streaks simply wait/, "pause hint no longer talks about streaks");
  assert.match(prefs, /\{adult && <div/, "the toggle is offered to adults only");
});

test("bus 91 sweep: no <p> carries whitespace-nowrap (the global p { text-wrap: pretty } would beat it)", () => {
  const hits = walk("app").filter((f) => /\.(tsx|jsx)$/.test(f)).flatMap((f) => {
    const s = src(f), re = /<p\b[^>]*?whitespace-nowrap/gs, out = []; let m;
    while ((m = re.exec(s))) out.push(`${f}:${s.slice(0, m.index).split("\n").length}`);
    return out;
  });
  assert.deepEqual(hits, []);
});

test("Кодекс page: crest thumbnails, motto at the end, the approved status; reached from Today, council and heritage — not a 7th tab", () => {
  const k = src("app/components/FamilyKodeks.tsx");
  assert.match(k, /<CrestThumb element=\{p\.element\}/); assert.match(k, /data-motto=""/); assert.match(k, /approved: \(d: string\) => `Утверждён \$\{d\}`/);
  assert.ok(k.indexOf("data-motto") > k.indexOf("data-kodeks=\"\""), "motto after the principles");
  assert.match(src("app/components/FamilyOs.tsx"), /<TodayPrinciple /);
  assert.match(src("app/components/FamilyCouncil.tsx"), /<CouncilPrinciple /);
  assert.match(src("app/components/FamilyClient.tsx"), /data-kodeks-entry=""[\s\S]*family\/os\/kodeks|family\/os\/kodeks[\s\S]*data-kodeks-entry=""/);
  assert.doesNotMatch(src("app/content/siteNav.ts") + src("app/lib/family-nav.mjs"), /kodeks/, "no tab for the Кодекс (≤ 6 tabs, bus 84)");
  assert.doesNotMatch(k, /likes|leaderboard|рейтинг|лайк/i, "no likes or rankings");
  assert.match(k, /fleurdelis: \{ y: 20, z: 5\.6 \}/, "lilies thumbnail cropped tighter via the table, not by moving the explorer marker");
  assert.match(src("app/components/CrestExplorer.tsx"), /id: "fleurdelis",[\s\S]{0,800}?y: 19,/, "explorer marker unchanged");
});

test("Today (bus 95): recognition collapsed behind «Отметить хорошее», ≤ 3 items + «Все — на совете»; section order", () => {
  const k = src("app/components/FamilyKodeks.tsx");
  assert.match(k, /const \[open, setOpen\] = useState\(false\)/, "the form starts closed");
  assert.match(k, /open: "Отметить хорошее"/); assert.match(k, /allAtCouncil: "Все — на совете"/);
  assert.match(k, /TODAY_RECOGNITIONS = 3/); assert.match(k, /items\.slice\(-TODAY_RECOGNITIONS\)/);
  const o = src("app/components/FamilyOs.tsx");
  const at = (re) => { const i = o.search(re); assert.ok(i > 0, String(re)); return i; };
  const order = [/<TodayPrinciple /, /<TodayBoard /, /<TodayChecklist /, /<TodayRecognition /, /id="remind-h"/].map(at);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "principle → tasks → routine → recognition → documents");
});

test("heraldic accents: pillar tokens in light, dark and print; used as rules/icons, never fills", () => {
  const css = src("app/globals.css");
  // root, dark, print + the two high-contrast sets (bus 97 item 2: pillars → plain black / white there)
  for (const k of ["rhythm", "health", "growth", "kodeks"]) assert.equal((css.match(new RegExp(`--pillar-${k}:`, "g")) ?? []).length, 5, k);
  const uses = walk("app").filter((f) => /\.tsx$/.test(f)).flatMap((f) => src(f).match(/[a-z:-]+-\[var\(--pillar-[a-z]+\)\]/g) ?? []);
  assert.ok(uses.length > 0);
  assert.deepEqual(uses.filter((u) => /^(bg|text)-/.test(u)), [], "no fills or text in pillar colours");
});
