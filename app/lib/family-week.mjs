// «Неделя семьи · PDF» (bus 84/97 item 5). Pure helpers, unit-tested.
const addDays = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** Monday..Sunday of the week starting `monday`. */
export const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** States that belong on a family sheet: planned or done. Never proposals, declines, cancels or carry-overs. */
const ON_SHEET = new Set(["approved", "accepted", "in_progress", "done", "reviewed"]);

/**
 * Family tasks for the week, grouped per person (assignee and anyone doing it together), in day order.
 * Only the board — no routines, notes, documents or health. One row: day, title, done or not.
 */
export function weekTasks(boards, people, days) {
  const rows = new Map(people.map((p) => [p.id, []]));
  boards.forEach((b, i) => {
    for (const t of b?.tasks ?? []) {
      if (!ON_SHEET.has(t.state)) continue;
      for (const pid of [t.assignee_id, ...(t.co_ids ?? [])]) rows.get(pid)?.push({ date: b.date ?? days[i], title: t.title, done: t.state === "done" || t.state === "reviewed" });
    }
  });
  return people.map((p) => ({ id: p.id, name_ru: p.name_ru, name_en: p.name_en, tasks: (rows.get(p.id) ?? []).sort((a, b) => a.date.localeCompare(b.date)) })).filter((x) => x.tasks.length);
}

/** Birthdays this week and next (so the sheet on the fridge gives a week's warning). Name and date — no age. */
export function weekBirthdays(items, monday) {
  const to = addDays(monday, 13);
  return items.filter((x) => x.kind === "birthday" && x.date >= monday && x.date <= to).map((x) => ({ date: x.date, name_ru: x.name_ru ?? "", name_en: x.name_en ?? "" }));
}
