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

test("buildRule (bus 74): every shape maps to one meaning; N only where it applies", () => {
  assert.equal(buildRule({ repeat: "daily", interval: 5 }), "FREQ=DAILY", "«Каждый день» ignores N");
  assert.equal(buildRule({ repeat: "every_n", interval: 2 }), "FREQ=DAILY;INTERVAL=2");
  assert.equal(buildRule({ repeat: "every_n", interval: 1 }), null, "«Раз в 1 день» is just every day — refused");
  assert.equal(buildRule({ repeat: "weekly", days: ["TH", "TU"], interval: 2 }), "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH");
  assert.equal(buildRule({ repeat: "monthly", monthDay: 15, interval: 3 }), "FREQ=MONTHLY;BYMONTHDAY=15", "«Раз в месяц» has no N");
  for (const s of [{ repeat: "every_n", interval: 3 }, { repeat: "weekly", days: ["SU"], interval: 2 }, { repeat: "monthly", monthDay: 31 }]) assert.ok(parseRule(buildRule(s)));
});

test("scheduleSummary: the live line under the form", async () => {
  const { scheduleSummary } = await import("../app/lib/family-routines.mjs");
  assert.equal(scheduleSummary("FREQ=DAILY;INTERVAL=2", "2026-11-17", "RU"), "Раз в 2 дня, с 17 ноября");
  assert.equal(scheduleSummary("FREQ=WEEKLY;BYDAY=TU,TH", "2026-11-17", "EN"), "Tue, Thu, from 17 November");
  assert.equal(scheduleSummary(null, "2026-11-17", "RU"), "");
});

test("Family OS speaks «ты» in Russian: no formal address in any Family OS screen (bus 74 #3)", async () => {
  const { readFileSync } = await import("node:fs");
  const files = ["app/components/FamilyOs.tsx", "app/components/FamilyToday.tsx", "app/components/FamilyOsShell.tsx", "app/lib/family-today.mjs", "app/lib/family-os-shell.mjs", "app/components/FamilyOsPerson.tsx", "app/components/FamilyRoutines.tsx", "app/components/FamilyOsAccess.tsx", "app/components/FamilyPrefs.tsx", "app/components/FamilyRules.tsx", "app/components/FamilyCouncil.tsx", "app/components/FamilyCalendar.tsx", "app/components/FamilyPersonExtras.tsx", "app/components/FamilyBoard.tsx", "app/lib/family-nav.mjs", "app/lib/family-docs.mjs", "app/components/FamilyOsGuests.tsx"];
  const formal = /(^|[^а-яё])(вы|вас|вам|вами|ваш[а-яё]*)(?=[^а-яё]|$)|(попробуйте|попросите|выберите|оставьте|проверьте|добавьте|нажмите|введите|укажите|сохраните|откройте)/i;
  const hits = [];
  for (const f of files) for (const lit of readFileSync(f, "utf8").match(/"[^"\n]*[А-Яа-яЁё][^"\n]*"|`[^`\n]*[А-Яа-яЁё][^`\n]*`/g) ?? []) if (formal.test(lit)) hits.push(`${f}: ${lit}`);
  assert.deepEqual(hits, []);
});

test("access screen: giving health or documents needs a confirm; removing does not (bus 74 #4)", async () => {
  const { addedSensitive, confirmGrantText } = await import("../app/lib/family-access.mjs");
  assert.deepEqual(addedSensitive(["routines"], ["routines", "documents"]), ["documents"]);
  assert.deepEqual(addedSensitive(["health"], ["health", "routines"]), [], "health already there; routines is not sensitive");
  assert.deepEqual(addedSensitive(["health", "documents"], ["health"]), [], "removing never asks");
  assert.deepEqual(addedSensitive([], ["documents", "health", "education"]), ["health", "documents"]);
  assert.equal(confirmGrantText(["health", "documents"], "QA Родственник", "RU"), "QA Родственник: дать доступ к здоровью и документам ребёнка?");
  assert.equal(confirmGrantText(["documents"], "QA Relative", "EN"), "QA Relative: give access to the child's documents?");
});
