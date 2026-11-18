// Family OS Stage 3c (bus 82): «Семейная доска». Pure: the task state machine, who may make each move,
// tomorrow's plan from templates / rotation / sprint / carried-over, the 07:00 auto-approval set and the
// family progress. Unit-tested in board.test.mjs. Nothing here reads a clock, a DB or decrypts.
//
//   proposed → approved → accepted → in_progress → done → reviewed
//                  ↘ declined(reason) → (parent) reassign → approved · carry over · cancel
//   open at 21:00 → (parent) carried_over → a new proposed task tomorrow
// Routines are NOT tasks: they stay auto-accepted ticks (FamilyRoutines), with no approve/accept step.
import { parseRule, occursOn, addDays } from "./recur.mjs";
import { rotationAssignee } from "./engine.mjs";

export const TASK_STATES = ["proposed", "approved", "accepted", "in_progress", "done", "reviewed", "declined", "carried_over", "cancelled"];
export const TASK_KINDS = ["chore", "rotation", "sprint", "oneoff"];
export const OPEN_STATES = ["approved", "accepted", "in_progress"];
export const CHILD_SELF_ACCEPT_AGE = 9;   // under this age a guardian may accept on the child's behalf (switch kept)
export const PLAN_TIME = "20:30", AUTO_APPROVE_TIME = "07:00", CARRY_TIME = "21:00", DECISION_TIME = "19:00";

/** Parent = holds an active grant with relation "parent" (one approval by either parent is enough). */
export const isParent = (me, grants) => Boolean(me) && grants.some((g) => !g.revoked_at && g.guardian_id === me.id && g.relation === "parent");
/** Is `me` a parent (relation parent) of `child`? */
export const parentOf = (me, child, grants) => Boolean(me && child) && grants.some((g) => !g.revoked_at && g.guardian_id === me.id && g.child_id === child.id && g.relation === "parent");

/**
 * May `me` move `task` (assigned to `assignee`) with `action`? Returns null if allowed, else a reason code.
 * `ageOf(person)` → whole years or null (only used for the under-9 accept-on-behalf switch).
 */
export function canMove(action, me, task, assignee, grants, ageOf = () => null) {
  if (!me) return "not_a_member";
  const self = me.id === task.assignee_id;
  const parentForMinor = assignee?.kind === "child" && parentOf(me, assignee, grants);
  switch (action) {
    case "accept": case "decline": {
      if (task.state !== "approved") return "bad_state";
      if (self) return null;
      const age = ageOf(assignee);
      return parentForMinor && age !== null && age < CHILD_SELF_ACCEPT_AGE ? null : "assignee_only";
    }
    case "start":
      if (task.state !== "accepted") return "bad_state";
      return self || parentForMinor ? null : "assignee_only";
    case "done":
      if (!["accepted", "in_progress"].includes(task.state)) return "bad_state";
      return self || parentForMinor ? null : "assignee_only";
    case "review": case "rework":
      if (task.state !== "done" || !task.needs_review) return "bad_state";
      return isParent(me, grants) ? null : "parent_only";
    case "reassign": case "cancel":
      if (!["declined", "approved", "accepted"].includes(task.state)) return "bad_state";
      return isParent(me, grants) ? null : "parent_only";
    case "carry":
      if (![...OPEN_STATES, "declined"].includes(task.state)) return "bad_state";
      return isParent(me, grants) ? null : "parent_only";
    default: return "bad_action";
  }
}

/** The state after an allowed move. */
export const NEXT = { accept: "accepted", decline: "declined", start: "in_progress", done: (t) => "done", review: "reviewed", rework: "in_progress", reassign: "approved", cancel: "cancelled", carry: "carried_over" };
export const nextState = (action, task) => (typeof NEXT[action] === "function" ? NEXT[action](task) : NEXT[action]);

const DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
/** Weekday mask (7 chars "1111100", Monday first) → RRULE, so a template recurs like a routine. */
export const maskRule = (mask) => `FREQ=WEEKLY;BYDAY=${DAYS.filter((_, i) => mask[i] === "1").join(",")}`;
export const validMask = (m) => typeof m === "string" && /^[01]{7}$/.test(m) && m.includes("1");

/**
 * Tomorrow's proposed set (20:30). Sources, each tagged with `origin`:
 *   template (fixed assignee) · rotation (template with members, round-robin) · sprint (sprint tasks
 *   scheduled for that date, already created as proposed) · carry (carried over from today).
 * @returns [{ origin, template_id?, title, kind, assignee_id, due_time, needs_review, sprint_goal_id?, carried_from? }]
 */
export function buildPlan(date, { templates, carried = [] }) {
  const out = [];
  for (const t of templates) {
    if (!t.active || !validMask(t.mask)) continue;
    const rule = parseRule(maskRule(t.mask));
    if (!occursOn(rule, t.dtstart, date)) continue;
    const assignee = t.members?.length >= 2 ? rotationAssignee({ rrule: maskRule(t.mask), dtstart: t.dtstart, members: t.members }, date) : t.assignee_id;
    if (!assignee) continue;
    out.push({ origin: t.members?.length >= 2 ? "rotation" : "template", template_id: t.id, title: t.title, kind: t.members?.length >= 2 ? "rotation" : "chore", assignee_id: assignee, due_time: t.due_time ?? null, needs_review: Boolean(t.needs_review) });
  }
  for (const c of carried) out.push({ origin: "carry", title: c.title, kind: c.kind, assignee_id: c.assignee_id, due_time: c.due_time ?? null, needs_review: Boolean(c.needs_review), sprint_goal_id: c.sprint_goal_id ?? null, carried_from: c.id });
  return out;
}

/** 07:00 without an approval: approve exactly the template set (template + rotation) — never ad-hoc or carried. */
export const autoApprovable = (tasks) => tasks.filter((t) => t.state === "proposed" && (t.origin === "template" || t.origin === "rotation"));

/** Family progress of a day: done (incl. reviewed) / in progress / accepted / waiting (approved + declined). */
export function progress(tasks) {
  const c = { done: 0, in_progress: 0, accepted: 0, waiting: 0 };
  for (const t of tasks) {
    if (t.state === "done" || t.state === "reviewed") c.done++;
    else if (t.state === "in_progress") c.in_progress++;
    else if (t.state === "accepted") c.accepted++;
    else if (t.state === "approved" || t.state === "declined") c.waiting++;
  }
  return { ...c, total: c.done + c.in_progress + c.accepted + c.waiting };
}

/** Sprint goal progress in family totals only (no per-person numbers). */
export function sprintProgress(goals, tasks) {
  return goals.map((g) => {
    const mine = tasks.filter((t) => t.sprint_goal_id === g.id && t.state !== "cancelled" && t.state !== "carried_over");
    return { id: g.id, title: g.title, done: mine.filter((t) => t.state === "done" || t.state === "reviewed").length, total: mine.length };
  });
}

export { addDays };
