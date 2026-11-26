// bus 172 P2: «Календарь» week and month views — grids, the data window, chips and the wiring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { weekOf, monthGrid, addMonths, byDay, chips, inWindow, monthsInWindow, weeksInWindow, hourRange, minutesFrom, weekdayMon, mondayOf } from "../app/lib/family-calendar.mjs";

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("weeks start on Monday", () => {
  assert.equal(weekdayMon("2026-11-23"), 0); assert.equal(weekdayMon("2026-11-29"), 6);
  assert.equal(mondayOf("2026-11-26"), "2026-11-23");
  assert.deepEqual(weekOf("2026-11-26"), ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);
});

test("month grid: 6×7 from the Monday on or before the 1st", () => {
  const g = monthGrid("2026-11");
  assert.equal(g.length, 42); assert.equal(g[0], "2026-10-26"); assert.equal(g[41], "2026-12-06");
  assert.equal(monthGrid("2026-06")[0], "2026-06-01", "a month that starts on Monday");
  assert.equal(addMonths("2026-12", 1), "2027-01"); assert.equal(addMonths("2026-01", -1), "2025-12");
});

test("data window: from today, N days; the views only offer what the service answered for", () => {
  assert.equal(inWindow("2026-11-26", "2026-11-26", 62), true); assert.equal(inWindow("2026-11-25", "2026-11-26", 62), false);
  assert.equal(inWindow("2027-01-26", "2026-11-26", 62), true); assert.equal(inWindow("2027-01-27", "2026-11-26", 62), false);
  assert.deepEqual(monthsInWindow("2026-11-26", 62), ["2026-11", "2026-12", "2027-01"]);
  const w = weeksInWindow("2026-11-26", 62);
  assert.equal(w[0], "2026-11-23"); assert.equal(w.at(-1), "2027-01-25");
});

test("chips: up to three, then «+N ещё»; days sorted all-day first, then by time", () => {
  assert.deepEqual(chips([1, 2, 3, 4, 5]), { shown: [1, 2, 3], more: 2 }); assert.deepEqual(chips([1]), { shown: [1], more: 0 }); assert.deepEqual(chips(undefined), { shown: [], more: 0 });
  const m = byDay([{ date: "d", time: "19:00", kind: "council" }, { date: "d", time: null, kind: "birthday" }, { date: "d", time: "08:30", kind: "event" }]);
  assert.deepEqual(m.get("d").map((x) => x.kind), ["birthday", "event", "council"]);
});

test("hour grid: 08–22, widened to fit; positions in minutes", () => {
  assert.deepEqual(hourRange([]), [8, 22]);
  assert.deepEqual(hourRange([{ time: "06:30" }, { time: "23:15" }]), [6, 24]);
  assert.equal(minutesFrom("09:30", 8), 90);
});

test("wiring: week and month views, now line, day panel, phone bars, ?cal=month, the week sheet still reachable", () => {
  const c = src("app/components/FamilyCalendar.tsx");
  assert.match(c, /data-cal-week=""/); assert.match(c, /data-cal-month=""/); assert.match(c, /data-cal-now=""/);
  assert.match(c, /role="group" aria-label=\{t\.viewLabel\}/); assert.match(c, /aria-pressed=\{view === v\}/);
  assert.match(c, /max-\[899px\]:h-\[5px\]/, "colour bars instead of chips on a phone");
  assert.match(c, /\{more > 0 && <span className="pl-1 text-\[11px\] text-\[var\(--muted\)\] max-\[899px\]:hidden">\{t\.more\(more\)\}<\/span>\}/);
  assert.match(c, /<Dialog open=\{Boolean\(day\)\}/, "a day opens the side panel");
  assert.match(c, /aria-label=\{t\.dayLabel\(dayHead\(d, lang\), known \? list\.length : null\)\}/, "each cell says the day and its count");
  assert.match(c, /<span className="sr-only"> · \{t\.dayLabel\(dayHead\(d, lang\), n\)\}<\/span>/, "week day header: visible «Пт 27» stays in the name (WCAG 2.5.3) + the date and count");
  assert.match(c, /data-cal-head=\{d\}\s*className="relative /, "the sr-only text is contained by its button (no page-wide sideways scroll at 390 px)");
  assert.match(c, /onCloseAutoFocus=\{\(e\) => \{ const el = returnFocus\.current; if \(el\?\.isConnected\) \{ e\.preventDefault\(\); el\.focus\(\); \} \}\}/, "closing the day panel returns focus to the day");
  assert.match(c, /el\.scrollLeft = Math\.max\(0, col\.getBoundingClientRect\(\)\.left/, "on a phone the week opens on today's column");
  assert.match(c, /t\.noData/, "a day outside the service's window is never shown as a free day");
  assert.match(c, /href=\{`\$\{base\}\/week`\} data-week-link=""/, "os/week stays reachable from Календарь");
  assert.match(src("app/[lang]/family/os/calendar/page.tsx"), /\(await searchParams\)\.cal === "month" \? "month" : "week"/);
  for (const w of ["Неделя", "Месяц", "Сегодня", "Открыть неделю", "вся семья"]) assert.ok(c.includes(w), w);
  for (const k of ["prevWeek", "nextWeek", "prevMonth", "nextMonth"]) assert.match(c, new RegExp(`t\\.${k}`), `${k}: the arrow buttons are named`);
});
