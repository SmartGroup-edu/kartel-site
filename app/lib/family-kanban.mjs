/**
 * «Задачи» as a Kanban (bus 172 P2, mockup v5). Pure; tested in tests/family-kanban.test.mjs.
 *
 * The board's task states map onto four columns (the mapping is also in the bus 172 P2 reply):
 *   Нужно сделать — approved (new, waiting to be accepted) · accepted
 *   В работе      — in_progress
 *   Ждёт решения  — declined («Не могу», parents decide) · a child's task not accepted by 12:00 (the service's needs_decision)
 *   Готово        — done · reviewed
 * Every other state (proposed, declined_by_adult, carried_over, cancelled) is not on the board (the service never sends it).
 *
 * A move between columns is one of the service's existing task moves (family-os/board.mjs canMove), never a new one:
 *   Нужно сделать → В работе: accepted → «start» (an approved task is accepted first, in the drawer)
 *   Нужно сделать → Готово:   accepted → «done»
 *   Нужно сделать → Ждёт решения: approved → «decline» (needs a reason: the drawer opens on «Почему не можешь?»)
 *   В работе → Нужно сделать: «pause» · В работе → Готово: «done»
 *   Готово → В работе: «rework» (the accountable person, a task with a check)
 * The service still decides who may make each move; a refused move rolls back.
 */
export const KANBAN_COLS = /** @type {const} */ (["todo", "doing", "wait", "done"]);

/** @param {{ id: string, state: string }} task @param {Set<string>} decisionIds the ids in the board's needs_decision */
export function kanbanCol(task, decisionIds = new Set()) {
  switch (task.state) {
    case "declined": return "wait";
    case "approved": return decisionIds.has(task.id) ? "wait" : "todo";
    case "accepted": return "todo";
    case "in_progress": return "doing";
    case "done": case "reviewed": return "done";
    default: return null;
  }
}

/**
 * The existing move that takes `task` into column `to`, or null when no single move does.
 * @param {{ id: string, state: string, needs_review?: boolean }} task @param {string} to @param {Set<string>} [decisionIds]
 * @returns {"start" | "done" | "pause" | "decline" | "rework" | null}
 */
export function moveAction(task, to, decisionIds = new Set()) {
  const from = kanbanCol(task, decisionIds);
  if (!from || from === to) return null;
  const s = task.state;
  if (to === "doing") return s === "accepted" ? "start" : s === "done" && task.needs_review ? "rework" : null;
  if (to === "done") return s === "accepted" || s === "in_progress" ? "done" : null;
  if (to === "todo") return s === "in_progress" ? "pause" : null;
  if (to === "wait") return s === "approved" ? "decline" : null;
  return null;
}

/** The state a move leads to — for the optimistic card (the service's answer replaces it). Mirrors board.mjs NEXT. */
export const MOVE_STATE = { start: "in_progress", done: "done", pause: "accepted", decline: "declined", rework: "in_progress" };

/**
 * May this viewer try to drag `task` at all? A participant, or a parent (the service has the last word).
 * @param {{ assignee_id: string, co_ids?: string[] }} task @param {string | null} meId @param {boolean} parent
 */
export function canDrag(task, meId, parent) {
  const mine = Boolean(meId) && [task.assignee_id, ...(task.co_ids ?? [])].includes(meId);
  return mine || parent;
}

/** Tasks of one person (assignee or together with), or all. */
export function tasksOf(tasks, personId) {
  return personId ? tasks.filter((t) => t.assignee_id === personId || (t.co_ids ?? []).includes(personId)) : tasks;
}

/**
 * Columns with their tasks, in board order (the service sorts by time).
 * @template T @param {T[]} tasks @param {Set<string>} [decisionIds] @returns {Record<"todo" | "doing" | "wait" | "done", T[]>}
 */
export function kanbanColumns(tasks, decisionIds = new Set()) {
  /** @type {any} */
  const cols = Object.fromEntries(KANBAN_COLS.map((k) => [k, []]));
  for (const t of tasks) { const k = kanbanCol(t, decisionIds); if (k) cols[k].push(t); }
  return cols;
}

/**
 * A child sees only their own tasks (bus 172 P2) — applied on the server (the board page and the /api/family-os/board
 * proxy), so nothing of the other family tasks reaches a child's browser. Their own lane only; family progress becomes
 * their own; the parents-only parts are dropped even if present.
 * @template {{ tasks: any[], members: any[], progress: any }} B
 * @param {B} board @param {string} meId @returns {B}
 */
export function childBoardView(board, meId) {
  if (!board) return board;
  const tasks = tasksOf(board.tasks ?? [], meId);
  const n = (s) => tasks.filter((t) => s.includes(t.state)).length;
  /** @type {any} */
  const rest = { ...board };
  delete rest.needs_decision; delete rest.plan; delete rest.carry_offer;
  return {
    ...rest,
    tasks,
    members: (board.members ?? []).filter((m) => m.id === meId),
    progress: { done: n(["done", "reviewed"]), in_progress: n(["in_progress"]), accepted: n(["accepted"]), waiting: n(["approved", "declined"]), total: tasks.length },
  };
}

/** A child may open a task's details only for their own task. */
export const childMayOpen = (task, meId) => Boolean(task) && [task.assignee_id, ...(task.co_ids ?? [])].includes(meId);
