// Bus 172 P3: «Решения» — what waits for a parent (the board's queue and tomorrow's plan) and what is decided (council
// decisions, plan approvals). No voting model: either parent decides with the moves the board already has.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pendingDecisions, acceptedDecisions, approvePlanBody, stampBy } from "../app/lib/family-decisions.mjs";

const A = "00000000-0000-4000-8000-00000000000a", B = "00000000-0000-4000-8000-00000000000b", V = "00000000-0000-4000-8000-00000000000c";
const people = [
  { id: A, name_en: "Anna", name_ru: "Анна", kind: "adult" },
  { id: B, name_en: "Boris", name_ru: "Борис", kind: "adult" },
  { id: V, name_en: "Vera", name_ru: "Вера", kind: "child" },
];
const task = (o) => ({ id: "t1", title: "Полить цветы", plan_date: "2026-11-26", assignee_id: V, state: "declined", decline_code: "lessons", ...o });
const board = (o = {}) => ({ date: "2026-11-26", today: "2026-11-26", can: { approve: true, sprint: true }, members: [], tasks: [], approval: null,
  needs_decision: [task(), task({ id: "t2", title: "Убрать в комнате", state: "approved", why: "not_accepted", decline_code: undefined })],
  plan: { date: "2026-11-27", proposed: 3, approved: false, auto: false, ready: true }, ...o });

test("pending: the board's queue — a «Не могу» with its reason, a task not accepted by 12:00, tomorrow's plan", () => {
  const plan = { date: "2026-11-27", approval: null, tasks: [{ id: "p1", title: "Пылесос", assignee_id: B, state: "proposed", due_time: "18:00" }, { id: "p2", title: "x", assignee_id: A, state: "approved" }] };
  const p = pendingDecisions({ board: board(), plan, people, lang: "RU" });
  assert.deepEqual(p.map((x) => [x.type, x.why ?? null, x.who ?? null]), [["task", "declined", "Вера"], ["task", "not_accepted", "Вера"], ["plan", null, null]]);
  assert.equal(p[0].code, "lessons");
  assert.equal(p[2].count, 3);
  assert.deepEqual(p[2].tasks, [{ id: "p1", title: "Пылесос", who: "Борис", time: "18:00", slot: null }], "only proposed rows are approved");
  // the plan list without its rows (the read failed): the panel says so and links to the board
  assert.equal(pendingDecisions({ board: board(), plan: null, people, lang: "RU" })[2].tasks, null);
});

test("pending: nothing for a non-parent adult; null (no list, not an empty one) when the board did not answer", () => {
  assert.deepEqual(pendingDecisions({ board: board({ can: { approve: false, sprint: false } }), plan: null, people, lang: "RU" }), []);
  assert.equal(pendingDecisions({ board: null, plan: null, people, lang: "RU" }), null);
  // an approved or empty plan does not wait
  assert.equal(pendingDecisions({ board: board({ needs_decision: [], plan: { date: "2026-11-27", proposed: 3, approved: true, auto: false, ready: true } }), plan: null, people, lang: "RU" }).length, 0);
  assert.equal(pendingDecisions({ board: board({ needs_decision: [], plan: { date: "2026-11-27", proposed: 0, approved: false, auto: false, ready: true } }), plan: null, people, lang: "RU" }).length, 0);
});

test("accepted: plan stamps (who and when, or automatic) and the decisions of this council and the one before", () => {
  const council = { date: "2026-11-29", tasks: [{ id: "c1", title: "Купить ёлку", owner_id: A, due_date: "2026-12-06", done: false }],
    previous: { date: "2026-11-22", tasks: [{ id: "c0", title: "Записать Веру в бассейн", owner_id: B, due_date: "2026-11-28", done: true }] } };
  const a = acceptedDecisions({ board: board({ approval: { auto: false, by: A, at: "20:15" }, plan: { date: "2026-11-27", proposed: 3, approved: true, auto: true, ready: true } }), council, people, lang: "RU" });
  assert.deepEqual(a.map((x) => x.key), ["plan:2026-11-27", "plan:2026-11-26", "c:c1", "c:c0"]);
  assert.equal(a[0].auto, true);
  assert.deepEqual(a[1].by, { kind: "person", name: "Анна" }); assert.equal(a[1].at, "20:15");
  assert.deepEqual([a[2].owner, a[2].council, a[2].done], ["Анна", "2026-11-29", false]);
  assert.deepEqual([a[3].owner, a[3].council, a[3].done], ["Борис", "2026-11-22", true]);
  assert.deepEqual(acceptedDecisions({ board: null, council: null, people, lang: "RU" }), []);
  assert.deepEqual(stampBy("admin", people, "RU"), { kind: "owner", name: "" });
  assert.deepEqual(stampBy("auto", people, "RU"), { kind: "auto", name: "" });
});

test("the plan is approved as it stands — every row included, nothing reassigned", () => {
  assert.deepEqual(approvePlanBody([{ id: "p1" }, { id: "p2" }]), { items: [{ id: "p1", include: true }, { id: "p2", include: true }] });
});

test("wiring: the panel makes only the board's existing moves; no vote is invented; reads within the cap", () => {
  const c = readFileSync("app/components/FamilyCouncil.tsx", "utf8");
  for (const m of ["reassign", "carry", "cancel"]) assert.match(c, new RegExp(`send\\("POST", \`tasks/\\$\\{item\\.id\\}/${m}\``), m);
  assert.match(c, /send\("PUT", `plan\/\$\{item\.date\}`, approvePlanBody\(item\.tasks\)\)/);
  assert.doesNotMatch(c, /\/vote|votes\b|голосова(ть|ние) «за»/i, "no voting call or button");
  assert.match(c, /pendingHint: "Решает любой из родителей: голосования нет, действует первое решение\."/);
  assert.match(c, /onCloseAutoFocus=/, "closing the panel returns focus");
  const page = readFileSync("app/[lang]/family/os/council/page.tsx", "utf8");
  assert.match(page, /childHome\(lang, state\.me\);\n  const council = await getCouncil/, "a child is sent home before the council is read");
  assert.match(page, /board\?\.can\.approve && p && p\.ready && !p\.approved && p\.proposed > 0 \? await getPlan\(session, p\.date\) : null/, "/plan only for a parent while it waits");
  // Today points «Ждут решения» at «Решения» now (bus 171 residual 2)
  const today = readFileSync("app/components/FamilyToday.tsx", "utf8");
  assert.equal((today.match(/href=\{`\$\{base\}\/council`\}/g) ?? []).length, 2);
});

// bus 172 P3 QA (acceptor)
test("QA: «+ Предложить решение» opens the fold-out and focuses «Что сделать»; «Передать» never offers the assignee", () => {
  const s = readFileSync("app/components/FamilyCouncil.tsx", "utf8");
  assert.match(s, /det\.open = true; box\.scrollIntoView\(\{ block: "start" \}\);/);
  assert.match(s, /querySelector<HTMLInputElement>\("input\[name=title\]"\)\?\.focus/);
  assert.match(s, /people\.filter\(\(p\) => p\.id !== item\.assigneeId\)\.map\(\(p\) =>/);
});
