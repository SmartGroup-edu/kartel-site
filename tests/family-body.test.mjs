// Stage 3e-2 on the site: the adult's own «Вес и питание» — red lines (R0 18.11.2026), placement, routes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("copy: neutral — no BMI, no judgement words or colours, no comparisons, no deltas; one calm GP line", () => {
  const c = src("app/components/FamilyBody.tsx");
  const copy = c.slice(c.indexOf("const T = {"), c.indexOf("} as const;"));
  assert.doesNotMatch(copy, /лишн|плохо|норм[аы]\b|ожирен|худе|толст|идеальн|ИМТ|BMI|overweight|obese|fat\b|ideal|bad|should|must/i);
  assert.doesNotMatch(copy, /[+−-]\s?\d+(\.\d)?\s?(кг|kg)|больше чем|меньше чем|than last/i, "no daily ± changes, no comparisons");
  assert.doesNotMatch(copy, /\bВы\b|\bВаш/, "«ты»");
  assert.doesNotMatch(c, /--destructive|text-red|text-green|bg-red|bg-green|#[0-9a-f]{6}/i, "no judgement colours");
  assert.doesNotMatch(c, /<img|<Image|photo|фото/i, "no body images");
  assert.match(copy, /goalLine: \(g: Goal[^]*`цель: \$\{dec\(g\.weight_kg\)\} кг/, "«цель: N кг к дате», with a Russian decimal comma");
  assert.match(copy, /`калории в день: \$\{g\.kcal_day\}`/);
  assert.match(copy, /gp: "Если хочется обсудить цель или темп, стоит поговорить с GP — это обычный шаг\."/);
  assert.match(c, /\{b\.gp && <p data-body-gp="" role="note"/, "a note, not an alert");
  assert.match(c, /stroke="var\(--foreground\)"/, "the trend line is the text colour");
  assert.doesNotMatch(c, /text-\[1[0-3]px\]/);
});

test("placement: only on the person's own page, only for an adult row; children's pages never render it", () => {
  const p = src("app/components/FamilyOsPerson.tsx");
  assert.match(p, /\{"me" in state && state\.me\?\.id === p\.id && p\.kind === "adult" && <FamilyBody lang=\{lang\} onShown=\{setBodyShown\} \/>\}/);
  assert.equal((p.match(/<FamilyBody/g) ?? []).length, 1);
  for (const f of ["app/components/FamilyOs.tsx", "app/components/FamilyHealth.tsx", "app/components/FamilyAdoption.tsx", "app/components/FamilyBoard.tsx"]) assert.doesNotMatch(src(f), /FamilyBody|\/body\b|weight_kg|kcal/, `${f} carries nothing of it`);
});

test("proxy: GET /body, GET /body/export (download), PUT prefs/goal/log/<date>, DELETE /body — no other person's path", () => {
  const r = src("app/api/family-os/[...op]/route.ts");
  assert.match(r, /if \(path === "\/body"\) \{/);
  assert.match(r, /if \(path === "\/body\/export"\) \{[\s\S]{0,400}"content-disposition": r\.headers\.get\("content-disposition"\)/);
  assert.match(r, /\|body\/prefs\|body\/goal\|body\/log\/\\\\d\{4\}-\\\\d\{2\}-\\\\d\{2\}\)\$/);
  assert.match(r, /ics\|body\)\$`\)\.test\(path\)\) return json\(404/);
  assert.doesNotMatch(r, /people\/\$\{ID\}\/body/);
});

test("bus 117: chart has a visible neutral caption; RU date hint and decimal comma; goal behind «Изменить цель»; the delete confirm says what happens", () => {
  const c = src("app/components/FamilyBody.tsx");
  assert.match(c, /<svg data-body-trend="" role="img" aria-labelledby="body-trend-cap"/);
  assert.match(c, /<figcaption id="body-trend-cap" data-body-trend-caption=""/);
  assert.match(c, /caption: \(a: string, b: string, n: number\) => `Средний вес по неделям: с \$\{a\} до \$\{b\} кг за \$\{n\}/);
  assert.doesNotMatch(c.slice(c.indexOf("caption:"), c.indexOf("caption:") + 300), /минус|↓|↑|−/, "no «минус», no arrows");
  assert.match(c, /datePh: "дд\.мм\.гггг"/); assert.doesNotMatch(c, /type="date"/, "no native date field with an English placeholder");
  assert.match(c, /const dec = \(v: number\) => \(lang === "RU" \? String\(v\)\.replace\("\.", ","\) : String\(v\)\);/);
  assert.match(c, /Number\(s\.trim\(\)\.replace\(",", "\."\)\)/, "inputs accept «,» and «.»");
  assert.match(c, /\{hasGoal && !editGoal \? \(/); assert.match(c, /goalEdit: "Изменить цель"/);
  assert.match(c, /delConfirm: "Все записи о весе и калориях будут удалены без возможности восстановления\. Сначала можно скачать их\."/);
  assert.match(c, /delYes: "Удалить всё"/); assert.match(c, /data-body-delete-no="" autoFocus/, "«Отмена» has the default focus (bus 120)");
  assert.match(c, /\{!ask && <button type="button" data-body-off=""/, "«Выключить» hides while the confirm is open");
  assert.match(c, /onClick=\{\(\) => \{ setMsg\(""\); setAsk\(true\); \}\}/, "the stale status clears when the confirm opens");
});
