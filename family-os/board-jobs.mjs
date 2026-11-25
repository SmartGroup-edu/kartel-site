// Family OS Stage 3c (bus 82): board jobs shared by the API (a parent's «Собрать план») and the runner.
//   20:30 → build tomorrow's proposed set from active templates (rotation included); idempotent per
//           (template, day). Carried-over and sprint tasks are created as proposed when they happen.
//   07:00 → no approval for today yet → approve exactly the template set (template + rotation), record it
//           as an automatic approval. Ad-hoc additions and carried-over tasks are never auto-approved.
import { randomUUID } from "node:crypto";
import { seal, open, newDataKey, unwrapDataKey } from "./crypto.mjs";
import { buildPlan, autoApprovable, PLAN_TIME, AUTO_APPROVE_TIME } from "./board.mjs";
import { localParts, isDue } from "./engine.mjs";
import { addDays } from "./recur.mjs";

const openTitle = (kek, row) => { const k = unwrapDataKey(kek, row.wrapped_key, "template", row.id); try { return open(k, row.title_ct, `template:${row.id}`).toString("utf8"); } finally { k.fill(0); } };
const sealTask = (kek, id, title) => { const { dek, wrapped } = newDataKey(kek, "task", id); try { return { wrapped_key: wrapped, title_ct: seal(dek, Buffer.from(title), `task:${id}`) }; } finally { dek.fill(0); } };

/** Build the proposed set for `date` from active templates. Returns counts only. */
export async function buildDayPlan(store, kek, date, actor) {
  const templates = (await store.listTemplates()).map((t) => ({ ...t, title: t.active ? openTitle(kek, t) : "" }));
  // The template's author is accountable for its tasks until a parent approves the plan (then: that parent).
  const people = await store.listPeople(), personOf = (email) => people.find((x) => x.email === email)?.id ?? null;
  let created = 0, existing = 0;
  for (const p of buildPlan(date, { templates })) {
    const id = randomUUID(), tpl = templates.find((x) => x.id === p.template_id);
    const ok = await store.insertTask({ id, plan_date: date, kind: p.kind, origin: p.origin, template_id: p.template_id, assignee_id: p.assignee_id, ...sealTask(kek, id, p.title), due_time: p.due_time,
      when_slot: p.when_slot, estimate_min: p.estimate_min, accountable_id: personOf(tpl?.created_by), needs_review: p.needs_review, state: "proposed" }, actor);
    if (ok) created++; else existing++;
  }
  return { date, created, existing };
}

/** 07:00 auto-approval of the template set, only if no parent approved the day. */
export async function autoApproveDay(store, date) {
  if (await store.planApproval(date)) return { date, approved: 0, skipped: "already_approved" };
  let approved = 0;
  for (const t of autoApprovable(await store.boardTasks(date, date))) if (await store.moveTask(t.id, "proposed", "approved", { approved_by: "auto" })) approved++;
  await store.approvePlan(date, "auto", true);
  return { date, approved };
}

/** The runner's board step for one tick. Times are family-local (Europe/London). */
export async function boardTick(now, store, kek) {
  const { date, hhmm } = localParts(now), out = {};
  if (isDue(PLAN_TIME, hhmm)) out.plan = await buildDayPlan(store, kek, addDays(date, 1), "system:runner");
  if (isDue(AUTO_APPROVE_TIME, hhmm)) out.auto = await autoApproveDay(store, date);
  return out;
}
