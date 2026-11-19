// Bus 85 M2: deterministic colours; one letter unless a first letter is shared; then unique pairs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avatars, avatarColour, AVATAR_COLOURS } from "../app/lib/family-avatars.mjs";

const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
test("palette: every colour keeps white text ≥ 4.5:1 (AA)", () => {
  for (const c of AVATAR_COLOURS) assert.ok(1.05 / (lum(c) + 0.05) >= 4.5, c);
});
test("colour is fixed per id and does not depend on who else is in the family", () => {
  const a = avatars([{ id: "a", name: "Anna" }, { id: "b", name: "Boris" }]), b = avatars([{ id: "b", name: "Boris" }]);
  assert.equal(a.get("b").bg, b.get("b").bg); assert.equal(a.get("b").bg, avatarColour("b"));
});
test("letters: single when unique; two, unique, when a first letter is shared", () => {
  const m = avatars([{ id: "1", name: "Альфа" }, { id: "2", name: "Бета" }, { id: "3", name: "Гамма" }, { id: "4", name: "Гамма Два" }]);
  assert.equal(m.get("1").text, "А"); assert.equal(m.get("2").text, "Б");
  assert.notEqual(m.get("3").text, m.get("4").text); assert.equal(m.get("3").text.length, 2); assert.equal(m.get("4").text.length, 2);
  const qa = avatars(["QA Родитель Один", "QA Родитель Два", "QA Ребёнок", "QA Ребёнок Два", "QA Взрослый", "QA Родственник"].map((name, i) => ({ id: `id${i}`, name })));
  const texts = [...qa.values()].map((x) => x.text);
  assert.equal(new Set(texts).size, texts.length, `all distinct: ${texts.join(" ")}`);
});
