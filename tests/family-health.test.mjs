// Stage 3e-1 «Здоровье-лайт» on the site: copy red lines (plan §2.4), the proxy routes, Today placement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("copy: no scores, no judgement, no medical advice, no weight or calories, no sleep hours; «ты»", () => {
  const c = src("app/components/FamilyHealth.tsx");
  const copy = c.slice(c.indexOf("const T = {"), c.indexOf("} as const;"));
  assert.doesNotMatch(copy, /плохо|лишн|норм[ау]|должен|должна|провал|серия|streak|bad|fail|should|must/i, "no reproach, no streaks");
  assert.doesNotMatch(copy, /вес|калор|кг|ИМТ|BMI|weight|calorie|kcal/i, "no weight or calories in 3e-1");
  assert.doesNotMatch(copy, /диагноз|лекарств|таблет|симптом|diagnos|medic|symptom/i, "no medical advice");
  assert.doesNotMatch(copy, /\d+\s*(час|ч\b|hours?)\s*сна|\d+\s*hours? of sleep|сон\s*[—-]\s*\d/i, "no sleep hours (NHS figures not yet checked)");
  assert.doesNotMatch(copy, /\bВы\b|\bВаш/, "«ты» in Family OS");
  assert.doesNotMatch(c, /--destructive|text-red|text-green|bg-red|bg-green|#[0-9a-f]{6}/i, "no judgement colours; tokens only");
  assert.match(copy, /Общий итог появится, когда отмечать будут хотя бы трое/);
  assert.match(copy, /Видишь только ты/);
  assert.match(c, /<span className="whitespace-nowrap text-\[14px\]">· \{t\.only\}<\/span>/, "«Видишь только ты» never breaks before «ты» (bus 113 L1)");
  assert.match(c, /\{h\.family\.ready \? t\.total\(h\.family\.move, h\.family\.sleep, h\.family\.of\) : t\.notYet\}/, "under the floor the line explains, it never disappears (bus 113 L2)");
  assert.doesNotMatch(c, /text-\[1[0-3]px\]/, "text ≥ 14 px");
  assert.match(c, /border-l-2 border-\[var\(--pillar-health\)\]/, "Здоровье = червлень, a thin rule only");
});

test("the NHS movement guide is shown to children only; sleep has no number", () => {
  const c = src("app/components/FamilyHealth.tsx");
  assert.match(c, /\{h\.mine\.kind === "child" && <p[^>]*>\{t\.guide\}<\/p>\}/);
  assert.match(c, /guide: "Ориентир NHS для 5–18 лет: в среднем час движения в день\."/);
});

test("proxy: GET /health and /evening (JSON), POST /health/tick, PUT /health/prefs and /evening/<date> — nothing else new", () => {
  const p = src("app/api/family-os/[...op]/route.ts");
  assert.match(p, /if \(\/\^\\\/\(health\|evening\)\$\/\.test\(path\)\)/);
  assert.match(p, /\|health\/tick\)\$`\)\.test\(path\)\) return forwardJson\(req, "POST"/);
  assert.match(p, /\|health\/prefs\|evening\/\\\\d\{4\}-\\\\d\{2\}-\\\\d\{2\}\)\$`\)\.test\(path\)\) return json\(404/);
  assert.doesNotMatch(p, /people\/\$\{ID\}\/(health|evening)/, "no route reads someone else's health");
});

test("Today shows «Здоровье» for members, after recognition and before documents", () => {
  const f = src("app/components/FamilyOs.tsx");
  const i = f.indexOf("<TodayRecognition"), j = f.indexOf("<FamilyHealth lang={lang} />"), k = f.indexOf('id="remind-h"');
  assert.ok(i > 0 && j > i && k > j);
  assert.match(f, /\{state\.me && <FamilyHealth lang=\{lang\} \/>\}/);
});
