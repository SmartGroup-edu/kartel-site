/**
 * «Решения» (bus 172 P3, mockup v5): the page's two lists, built on the server from what Family OS already returns.
 * Pure; tested in tests/family-decisions.test.mjs.
 *
 * Family OS has no voting model, and none is invented here. What really waits for a parent is the task board's queue:
 *  - a task a child could not take («Не могу») or did not accept by 12:00 (`needs_decision`) — a parent hands it over,
 *    moves it to tomorrow or removes it (the existing reassign / carry / cancel moves);
 *  - tomorrow's plan before approval — a parent approves it (the existing PUT plan/:date; the first approval wins).
 * Either parent may decide; there is nothing to count.
 *
 * «Принято» is the history the model keeps: the decisions recorded at the family council (they are tasks with an owner
 * and a date since bus 85) for this council and the one before, and the plan approvals the board stamps.
 */

const nameOf = (p, lang) => (p ? (lang === "EN" ? p.name_en : p.name_ru) : "");

/** Who stamped a plan: a member id, "auto", "system" or "admin" (the owner acting outside the family list). */
export function stampBy(by, people, lang) {
  if (!by || by === "auto" || by === "system") return { kind: "auto", name: "" };
  if (by === "admin") return { kind: "owner", name: "" };
  const p = (people ?? []).find((x) => x.id === by);
  return p ? { kind: "person", name: nameOf(p, lang) } : { kind: "auto", name: "" };
}

/**
 * What waits for a parent. Empty for anyone the board does not let approve (a non-parent adult); null when the board
 * did not answer (no list, not an empty one).
 * @param {{ board: any, plan: any, people: any[], lang: "EN" | "RU" }} o
 */
export function pendingDecisions({ board, plan, people, lang }) {
  if (!board) return null;
  if (!board.can?.approve) return [];
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const out = (board.needs_decision ?? []).map((x) => ({
    key: `d:${x.id}`, type: "task", id: x.id, title: x.title, date: x.plan_date,
    assigneeId: x.assignee_id, who: nameOf(byId.get(x.assignee_id), lang),
    why: x.why ?? (x.state === "declined" ? "declined" : "not_accepted"),
    code: x.decline_code ?? null, reason: x.decline_code === "other" ? x.decline_reason ?? "" : "",
  }));
  const p = board.plan;
  if (p && p.ready && !p.approved && p.proposed > 0) {
    // The plan's own rows, when the page read them (parents, only while the plan waits): the panel lists them and
    // approves exactly these. Without them the panel says so and links to the board, where the plan is edited.
    const rows = plan && plan.date === p.date && !plan.approval ? (plan.tasks ?? []).filter((x) => x.state === "proposed") : null;
    out.push({
      key: `plan:${p.date}`, type: "plan", id: p.date, title: null, date: p.date, count: p.proposed,
      tasks: rows ? rows.map((x) => ({ id: x.id, title: x.title, who: nameOf(byId.get(x.assignee_id), lang), time: x.due_time ?? null, slot: x.when_slot ?? null })) : null,
    });
  }
  return out;
}

/**
 * «Принято», newest first: plan approvals (today's, with who and when; tomorrow's once approved), then the council
 * decisions of this council and the previous one, each with its owner, due date and whether it is done.
 * @param {{ board: any, council: any, people: any[], lang: "EN" | "RU" }} o
 */
export function acceptedDecisions({ board, council, people, lang }) {
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const out = [];
  if (board?.plan?.approved && board.plan.date !== board.date) out.push({ key: `plan:${board.plan.date}`, type: "plan", date: board.plan.date, auto: Boolean(board.plan.auto), by: null, at: null });
  if (board?.approval) {
    const by = board.approval.auto ? { kind: "auto", name: "" } : stampBy(board.approval.by, people, lang);
    out.push({ key: `plan:${board.date}`, type: "plan", date: board.date, auto: by.kind === "auto", by, at: board.approval.at ?? null });
  }
  const meetings = council ? [{ date: council.date, tasks: council.tasks ?? [] }, ...(council.previous ? [council.previous] : [])] : [];
  for (const m of meetings) {
    for (const x of m.tasks ?? []) {
      out.push({ key: `c:${x.id}`, type: "council", id: x.id, title: x.title, council: m.date, ownerId: x.owner_id, owner: nameOf(byId.get(x.owner_id), lang), due: x.due_date, done: Boolean(x.done) });
    }
  }
  return out;
}

/** The plan approval body: every proposed row as it stands (the board is where a parent edits a row first). */
export function approvePlanBody(tasks) {
  return { items: (tasks ?? []).map((x) => ({ id: x.id, include: true })) };
}
