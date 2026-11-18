// «Неделя семьи · PDF» (bus 84/97 item 5): what goes on the sheet, and what never does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { weekDays, weekTasks, weekBirthdays } from "../app/lib/family-week.mjs";

test("weekDays: Monday..Sunday", () => {
  assert.deepEqual(weekDays("2026-11-16"), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
});

test("weekTasks: per person (assignee + together), day order, planned or done only — no proposals, declines, cancels", () => {
  const people = [{ id: "a", name_ru: "А", name_en: "A" }, { id: "b", name_ru: "Б", name_en: "B" }, { id: "c", name_ru: "В", name_en: "C" }];
  const boards = [
    { date: "2026-11-17", tasks: [{ title: "Мусор", state: "done", assignee_id: "a", co_ids: [] }, { title: "Предложение", state: "proposed", assignee_id: "a" }, { title: "Отказ", state: "declined", assignee_id: "b" }] },
    { date: "2026-11-16", tasks: [{ title: "Посуда", state: "approved", assignee_id: "b", co_ids: ["a"] }, { title: "Снято", state: "cancelled", assignee_id: "b" }] },
    null,
  ];
  const w = weekTasks(boards, people, weekDays("2026-11-16"));
  assert.deepEqual(w.map((p) => p.id), ["a", "b"], "people with nothing are left out");
  assert.deepEqual(w[0].tasks, [{ date: "2026-11-16", title: "Посуда", done: false }, { date: "2026-11-17", title: "Мусор", done: true }]);
  assert.deepEqual(w[1].tasks, [{ date: "2026-11-16", title: "Посуда", done: false }]);
});

test("weekBirthdays: this week and next, name and date only (no age)", () => {
  const items = [{ kind: "birthday", date: "2026-11-25", name_ru: "Б", name_en: "B", age: 9 }, { kind: "birthday", date: "2026-12-01", name_ru: "Х" }, { kind: "event", date: "2026-11-18", title: "x" }];
  assert.deepEqual(weekBirthdays(items, "2026-11-16"), [{ date: "2026-11-25", name_ru: "Б", name_en: "B" }]);
});

test("the sheet: no documents, health, notes or routines; recognitions only on opt-in; A4 print; reached from the council", () => {
  const page = readFileSync("app/[lang]/family/os/week/page.tsx", "utf8");
  const imports = page.match(/import \{([^}]+)\} from "@\/app\/lib\/family-os"/)[1];
  assert.doesNotMatch(imports, /Document|Reminder|Notes|Routine|PersonPage|Health/i, "no documents, health, notes or routines");
  assert.match(page, /withRec \? getRecognitions\(session, week\) : Promise\.resolve\(null\)/, "recognitions are fetched only on opt-in");
  const c = readFileSync("app/components/FamilyWeek.tsx", "utf8");
  assert.match(c, /checked=\{recognitions !== null\}/);
  assert.match(c, /window\.print\(\)/);
  assert.match(c, /data-week-controls="" className="[^"]*print:hidden/);
  assert.match(readFileSync("app/globals.css", "utf8"), /@page \{\s*size: A4;/);
  assert.match(readFileSync("app/components/FamilyCouncil.tsx", "utf8"), /data-week-link=""/);
});
