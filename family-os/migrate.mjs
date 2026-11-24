// Bus 85 (High): one model. Routines are personal habits only; everything assigned is a task. This moves the
// legacy shapes into the task model, idempotently:
//   routine kind "chore"  → task_template (one assignee), DRAFT (inactive until «Утвердить шаблоны»); routine archived
//   rotation              → task_template with members (round-robin), DRAFT; rotation archived
//   council_task          → task (origin "council", same id, so a rerun inserts nothing); done stays done
// A rule a weekday mask cannot express (an interval, a monthly day) is left as it is and counted as `skipped`.
// Counts only — no titles or names leave this function.
import { randomUUID } from "node:crypto";
import { seal, newDataKey } from "./crypto.mjs";
import { parseRule } from "./recur.mjs";

/** RRULE subset → 7-char weekday mask (Monday first), or null when a mask cannot express it. */
export function ruleMask(rrule, dtstart) {
  const r = parseRule(rrule);
  if (!r || r.interval !== 1) return null;
  if (r.freq === "DAILY") return "1111111";
  if (r.freq === "WEEKLY" && r.byday?.length) return [0, 1, 2, 3, 4, 5, 6].map((d) => (r.byday.includes(d) ? "1" : "0")).join("");
  if (r.freq === "WEEKLY" && dtstart) { const d = (new Date(`${dtstart}T12:00:00Z`).getUTCDay() + 6) % 7; return [0, 1, 2, 3, 4, 5, 6].map((i) => (i === d ? "1" : "0")).join(""); }
  return null;
}
const sealed = (kek, scope, id, title) => { const { dek, wrapped } = newDataKey(kek, scope, id); try { return { wrapped_key: wrapped, title_ct: seal(dek, Buffer.from(title), `${scope}:${id}`) }; } finally { dek.fill(0); } };

export async function migrateToTaskModel(store, kek, actor = "system:migrate-3c") {
  const out = { chores: 0, rotations: 0, council: 0, skipped: 0 };
  for (const r of await store.choreRoutines()) {
    const mask = ruleMask(r.rrule, r.dtstart);
    if (!mask) { out.skipped++; continue; }
    const id = randomUUID();
    await store.insertTemplate({ id, ...sealed(kek, "template", id, r.title), mask, dtstart: r.dtstart, assignee_id: r.person_id, members: null, due_time: r.at_time ?? null, needs_review: false, active: false }, r.created_by ?? actor);
    await store.updateRoutine(r.id, { archived: true }, actor);
    out.chores++;
  }
  for (const x of await store.listRotations()) {
    const mask = ruleMask(x.rrule, x.dtstart);
    if (!mask) { out.skipped++; continue; }
    const id = randomUUID();
    await store.insertTemplate({ id, ...sealed(kek, "template", id, x.title), mask, dtstart: x.dtstart, assignee_id: null, members: x.members, due_time: x.at_time ?? null, needs_review: false, active: false }, x.created_by ?? actor);
    await store.archiveRotation(x.id, actor);
    out.rotations++;
  }
  for (const t of await store.legacyCouncilTasks()) {
    if (!t.on_date) { out.skipped++; continue; }
    const ok = await store.insertTask({ id: t.id, plan_date: t.due_date, kind: "oneoff", origin: "council", council_date: t.on_date, assignee_id: t.owner_id, ...sealed(kek, "task", t.id, t.title),
      state: t.done_at ? "done" : "accepted", approved_by: t.created_by ?? actor }, actor);
    if (ok) out.council++;
  }
  return out;
}
