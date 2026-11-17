import { test } from "node:test";
import assert from "node:assert/strict";
import { describeRule, streakText, buildRule, ruPlural } from "../app/lib/family-routines.mjs";
import { parseRule } from "../family-os/recur.mjs";
import { familySubNav } from "../app/lib/family-nav.mjs";

test("describeRule: plain words in both languages", () => {
  assert.equal(describeRule("FREQ=DAILY", "RU"), "Каждый день");
  assert.equal(describeRule("FREQ=DAILY;INTERVAL=2", "RU"), "Раз в 2 дня");
  assert.equal(describeRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "EN"), "Weekdays");
  assert.equal(describeRule("FREQ=WEEKLY;BYDAY=MO,TH", "RU"), "Пн, Чт");
  assert.equal(describeRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=SU", "RU"), "Раз в 2 недели: Вс");
  assert.equal(describeRule("FREQ=MONTHLY;BYMONTHDAY=15", "EN"), "Monthly on day 15");
  for (const r of ["FREQ=DAILY", "FREQ=WEEKLY;BYDAY=SA,SU", "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1"])
    assert.doesNotMatch(describeRule(r, "EN"), /[А-Яа-яЁё]/);
});

test("streakText: only runs of two or more; never a miss", () => {
  assert.equal(streakText(0, "RU"), ""); assert.equal(streakText(1, "EN"), "");
  assert.equal(streakText(2, "RU"), "2 раза подряд"); assert.equal(streakText(5, "RU"), "5 раз подряд");
  assert.equal(streakText(22, "RU"), "22 раза подряд"); assert.equal(streakText(12, "RU"), "12 раз подряд");
  assert.equal(streakText(3, "EN"), "3 times in a row");
  assert.equal(ruPlural(21, ["день", "дня", "дней"]), "день");
});

test("buildRule: every shape the form builds is accepted by the service parser", () => {
  const shapes = [{ repeat: "daily" }, { repeat: "daily", interval: 2 }, { repeat: "weekdays" }, { repeat: "weekly", days: ["SU", "MO"] },
    { repeat: "weekly", days: ["SU"], interval: 2 }, { repeat: "monthly", monthDay: 31 }];
  for (const s of shapes) { const r = buildRule(s); assert.ok(r && parseRule(r), JSON.stringify(s)); }
  assert.equal(buildRule({ repeat: "weekly", days: [] }), null);
  assert.equal(buildRule({ repeat: "monthly", monthDay: 0 }), null);
  assert.equal(buildRule({ repeat: "yearly" }), null);
});

test("sub-nav: the access screen is for the admin inside Family OS only", () => {
  assert.ok(familySubNav({ lang: "RU", admin: true, os: true }).some((x) => x.id === "access" && x.label === "Доступы"));
  assert.ok(!familySubNav({ lang: "RU", admin: false, os: true }).some((x) => x.id === "access"));
  assert.ok(!familySubNav({ lang: "EN", admin: true, os: false }).some((x) => x.id === "access"));
});
