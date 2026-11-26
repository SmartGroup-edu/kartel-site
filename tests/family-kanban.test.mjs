// bus 172 P2: «Задачи» as a Kanban — the state → column mapping, the moves (the service's existing ones only),
// a child's own-tasks view (applied on the server) and the wiring of drag and drop + the keyboard menu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KANBAN_COLS, kanbanCol, moveAction, MOVE_STATE, canDrag, tasksOf, kanbanColumns, childBoardView, childMayOpen } from "../app/lib/family-kanban.mjs";
import { NEXT, ACTIONS } from "../family-os/board.mjs";

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const task = (id, state, extra = {}) => ({ id, state, assignee_id: "a", co_ids: [], needs_review: false, ...extra });

test("four columns in the mockup's order", () => {
  assert.deepEqual(KANBAN_COLS, ["todo", "doing", "wait", "done"]);
});

test("state → column: every on-board state lands in one column; the rest are not on the board", () => {
  const dec = new Set(["late"]);
  assert.equal(kanbanCol(task("x", "approved"), dec), "todo");
  assert.equal(kanbanCol(task("x", "accepted"), dec), "todo");
  assert.equal(kanbanCol(task("x", "in_progress"), dec), "doing");
  assert.equal(kanbanCol(task("x", "declined"), dec), "wait");
  assert.equal(kanbanCol(task("late", "approved"), dec), "wait", "a child's task not accepted by 12:00 (needs_decision)");
  assert.equal(kanbanCol(task("x", "done"), dec), "done");
  assert.equal(kanbanCol(task("x", "reviewed"), dec), "done");
  for (const s of ["proposed", "declined_by_adult", "carried_over", "cancelled"]) assert.equal(kanbanCol(task("x", s)), null, s);
});

test("moves are only the service's existing task moves, and lead where the service leads", () => {
  const cases = [
    [task("x", "accepted"), "doing", "start"], [task("x", "accepted"), "done", "done"], [task("x", "in_progress"), "done", "done"],
    [task("x", "in_progress"), "todo", "pause"], [task("x", "approved"), "wait", "decline"], [task("x", "done", { needs_review: true }), "doing", "rework"],
  ];
  for (const [t, to, a] of cases) {
    assert.equal(moveAction(t, to), a, `${t.state} → ${to}`);
    assert.ok(ACTIONS.includes(a), `${a} is a service action`);
    assert.equal(MOVE_STATE[a], NEXT[a] instanceof Function ? NEXT[a](t) : NEXT[a], `${a} → the service's next state`);
    assert.equal(kanbanCol({ ...t, state: MOVE_STATE[a] }), to === "wait" ? "wait" : to, "the card lands in the column it was dropped on");
  }
  // no single move does these: they stay put (the panel has the steps)
  for (const [t, to] of [[task("x", "approved"), "doing"], [task("x", "approved"), "done"], [task("x", "done"), "doing"], [task("x", "reviewed"), "todo"],
    [task("x", "declined"), "todo"], [task("x", "declined"), "done"], [task("x", "in_progress"), "wait"], [task("x", "accepted"), "accepted"]]) assert.equal(moveAction(t, to), null, `${t.state} → ${to}`);
  assert.equal(moveAction(task("x", "accepted"), "todo"), null, "same column");
});

test("dragging: only someone the service lets move it — participant, a parent for a child's task, the reviewer", () => {
  const t = task("x", "accepted", { assignee_id: "a", co_ids: ["b"] });
  assert.equal(canDrag(t, "a", false), true); assert.equal(canDrag(t, "b", false), true);
  assert.equal(canDrag(t, "c", false, "child"), false); assert.equal(canDrag(t, "c", true, "child"), true); assert.equal(canDrag(t, null, false), false);
  // QA P2: a parent cannot start/finish/pause another adult's task (board.mjs canMove: assignee_only) — no drag offered
  assert.equal(canDrag(t, "c", true, "adult"), false);
  // a done task with a check: the accountable person reviews; without one, a parent who is not doing it
  const r = task("y", "done", { assignee_id: "a", needs_review: true, accountable_id: "d" });
  assert.equal(canDrag(r, "d", false, "adult"), true); assert.equal(canDrag(r, "c", true, "child"), false);
  assert.equal(canDrag({ ...r, accountable_id: null }, "c", true, "adult"), true);
  // QA P2: no menu whose every item is disabled — the doer of a checked task, and states no single move leaves
  assert.equal(canDrag(r, "a", false, "child"), false, "not_own_review");
  for (const s of ["reviewed", "declined"]) assert.equal(canDrag(task("z", s, { assignee_id: "a" }), "a", true, "child"), false, s);
  assert.equal(canDrag(task("z", "done", { assignee_id: "a" }), "a", false, "adult"), false, "done without a check");
});

test("person filter and columns", () => {
  const ts = [task("1", "approved", { assignee_id: "a" }), task("2", "in_progress", { assignee_id: "b", co_ids: ["a"] }), task("3", "done", { assignee_id: "b" })];
  assert.deepEqual(tasksOf(ts, "a").map((x) => x.id), ["1", "2"]); assert.equal(tasksOf(ts, null).length, 3);
  const c = kanbanColumns(ts);
  assert.deepEqual(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.map((x) => x.id)])), { todo: ["1"], doing: ["2"], wait: [], done: ["3"] });
});

test("a child's board: only their own tasks and lane, own progress, no parents-only parts", () => {
  const board = {
    date: "2026-11-26", tasks: [task("1", "approved", { assignee_id: "kid" }), task("2", "in_progress", { assignee_id: "mum", co_ids: ["kid"] }), task("3", "done", { assignee_id: "dad" }), task("4", "declined", { assignee_id: "dad" })],
    members: [{ id: "kid" }, { id: "mum" }, { id: "dad" }], progress: { done: 1, in_progress: 1, accepted: 0, waiting: 2, total: 4 },
    needs_decision: [task("4", "declined")], plan: { date: "x" }, carry_offer: [], can: { approve: false },
  };
  const v = childBoardView(board, "kid");
  assert.deepEqual(v.tasks.map((x) => x.id), ["1", "2"]);
  assert.deepEqual(v.members.map((m) => m.id), ["kid", "mum"], "own lane + the person on a joint task");
  assert.deepEqual(v.members[1], { id: "mum", name_en: undefined, name_ru: undefined, kind: undefined, current: null, waiting: 0, done: 0, total: 0, peer: true }, "a peer is a name only, no lane data");
  assert.deepEqual(v.progress, { done: 0, in_progress: 1, accepted: 0, waiting: 1, total: 2 });
  assert.ok(!("needs_decision" in v) && !("plan" in v) && !("carry_offer" in v));
  assert.doesNotMatch(JSON.stringify(v), /"dad"/, "nothing of another person's tasks");
  assert.equal(childMayOpen(board.tasks[1], "kid"), true); assert.equal(childMayOpen(board.tasks[2], "kid"), false); assert.equal(childMayOpen(null, "kid"), false);
});

test("the child cut is on the server: the board page and the board/task proxy apply it; /me silent = refused", () => {
  const page = src("app/[lang]/family/os/board/page.tsx");
  assert.match(page, /const board = state\.me\?\.kind === "child" && read \? childBoardView\(read, state\.me\.id\) : read;/);
  const r = src("app/api/family-os/[...op]/route.ts");
  assert.match(r, /return json\(r\.status, r\.ok && me\?\.kind === "child" \? childBoardView\(body, me\.id\) : body\);/);
  assert.match(r, /if \(r\.ok && me\?\.kind === "child" && !childMayOpen\(body\?\.task, me\.id\)\) return json\(404/);
  assert.equal((r.match(/if \(r\.ok && me === undefined\) return json\(503/g) ?? []).length, 2, "fail-closed when /me does not answer");
  assert.match(r, /tasks\/\$\{ID\}\/\(accept\|decline\|start\|pause\|done\|/, "«Пауза» reaches the service (it was refused by the proxy before)");
});

test("drag and drop + keyboard: native DnD, a «Переместить в…» menu, optimistic with rollback, decline opens the reason", () => {
  const b = src("app/components/FamilyBoard.tsx");
  assert.doesNotMatch(src("package.json"), /@dnd-kit/, "no @dnd-kit dependency, so native HTML5 drag and drop");
  assert.match(b, /draggable=\{movable\}/); assert.match(b, /onDrop=\{/); assert.match(b, /e\.dataTransfer\.setData\("text\/plain", task\.id\)/);
  assert.match(b, /<DropdownMenuTrigger asChild>\s*<button type="button" data-move-menu="" aria-label=\{t\.moveMenu\(task\.title\)\}/, "the keyboard alternative is a real, named button");
  assert.match(b, /disabled=\{!moveAction\(task, k, decisionIds\)\} onSelect=\{\(\) => onMove\(task, k\)\}/);
  assert.match(b, /setOver\(\(o\) => \(\{ \.\.\.o, \[task\.id\]: \{ from: task\.state, to: MOVE_STATE\[a\] as OsTaskState \} \}\)\);\s*const r = await osSend\("POST", `tasks\/\$\{task\.id\}\/\$\{a\}`\);/, "optimistic first, then the existing route");
  assert.match(b, /setOver\(\(o\) => \{ const n = \{ \.\.\.o \}; delete n\[task\.id\]; return n; \}\);/, "rollback on refusal");
  assert.match(b, /if \(a === "decline"\) \{ setMsg\(""\); c\.open\(task\.id, true\); return; \}/);
  assert.match(b, /\{declining && can\.has\("decline"\) \? <Decline/);
  assert.match(b, /<p role="status" aria-live="polite" data-kanban-status=""/, "moves are announced");
  for (const w of ["Нужно сделать", "В работе", "Ждёт решения", "Готово", "Переместить в…"]) assert.ok(b.includes(w), w);
  assert.match(b, /\{!child && <PersonChips /, "person chips for adults; a child's board is theirs");
  assert.match(b, /<Strip c=\{c\} members=\{board\.members\.filter\(\(m\) => !m\.peer && shown\(m\)\)\} \/>/, "a peer has no card in «Кто чем занят»");
  assert.match(b, /if \(a === "rework"\) \{ setMsg\(""\); c\.open\(task\.id\); return; \}/, "«Ещё немного» asks «Что доделать» in the panel");
  // QA P2 regression: an optimistic move is dropped once the server's state leaves `from`, so a later pause in the
  // panel (back to `from`) cannot bring back the stale target and lock the card
  assert.match(b, /const stale = Object\.keys\(over\)\.filter\(\(id\) => tasks\.find\(\(x\) => x\.id === id\)\?\.state !== over\[id\]\.from\);/);
});
