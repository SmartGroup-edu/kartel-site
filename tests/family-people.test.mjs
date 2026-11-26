// Bus 172 P3: «Люди» cards (role, relation, open load) and «Доступ и безопасность» (roles, sign-in methods), built from
// the real model only: owner / editor / member (parent or relative) / child. No guest role exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { peopleCards, roleRows, signinSummary, relationOf } from "../app/lib/family-people.mjs";

const A = "00000000-0000-4000-8000-00000000000a", B = "00000000-0000-4000-8000-00000000000b", V = "00000000-0000-4000-8000-00000000000c", G = "00000000-0000-4000-8000-00000000000d";
const people = [
  { id: V, name_en: "Vera", name_ru: "Вера", kind: "child", email: "vera@example.com" },
  { id: B, name_en: "Boris", name_ru: "Борис", kind: "adult", email: "boris@example.com" },
  { id: A, name_en: "Anna", name_ru: "Анна", kind: "adult", email: "anna@example.com" },
  { id: G, name_en: "Galina", name_ru: "Галина", kind: "adult", email: "galina@example.com" },
];
const grants = [
  { id: "g1", guardian_id: A, child_id: V, relation: "parent", scopes: ["routines", "health"] },
  { id: "g2", guardian_id: G, child_id: V, relation: "relative", scopes: ["routines"] },
];
const board = { members: [{ id: A, total: 4, done: 1, current: { title: "Ужин" }, routines: { done: 2, total: 3 } }, { id: V, total: 2, done: 2, current: null }] };

test("relation: parent (a parent grant), relative (relative grants only), adult, child", () => {
  assert.deepEqual(people.map((p) => relationOf(p, grants)), ["child", "adult", "parent", "relative"]);
});

test("cards: parents first, then other adults, then children; load from today's board; parents and areas named", () => {
  const c = peopleCards({ people, grants, board, meId: A, lang: "RU" });
  assert.deepEqual(c.map((x) => x.name), ["Анна", "Борис", "Галина", "Вера"]);
  const [anna, boris, galina, vera] = c;
  assert.deepEqual(anna.load, { open: 3, done: 1, total: 4, current: "Ужин", routines: { done: 2, total: 3 } });
  assert.equal(anna.me, true); assert.deepEqual(anna.kids, ["Вера"]);
  assert.deepEqual(boris.load, { open: 0, done: 0, total: 0, current: null, routines: null }, "not on today's board: zero, from a real read");
  assert.deepEqual(galina.sees, [{ child: "Вера", scopes: ["routines"] }]);
  assert.deepEqual(vera.parents, ["Анна"]); assert.equal(vera.load.open, 0);
  // the board did not answer: no number at all
  assert.ok(peopleCards({ people, grants, board: null, meId: A, lang: "RU" }).every((x) => x.load === null));
});

test("roles: owner and editor from the allow-lists (owner wins), members and children; nobody is a guest", () => {
  const r = roleRows({ people, grants, owners: ["ANNA@example.com "], editors: ["anna@example.com", "boris@example.com"], lang: "RU" });
  assert.deepEqual(r.map((x) => [x.name, x.role, x.rel]), [["Анна", "owner", "parent"], ["Борис", "editor", "adult"], ["Галина", "member", "relative"], ["Вера", "child", "child"]]);
  assert.ok(r.every((x) => ["owner", "editor", "member", "child"].includes(x.role)));
});

test("sign-in summary: methods from the deploy settings, latest sign-in by date, never a time or a device", () => {
  const adoption = { people: [
    { id: A, name_en: "Anna", name_ru: "Анна", kind: "adult", signed_in: { first_on: "2026-11-01", last_on: "2026-11-25" }, passkey: true },
    { id: B, name_en: "Boris", name_ru: "Борис", kind: "adult", signed_in: { first_on: "2026-11-02", last_on: "2026-11-26" }, passkey: false },
    { id: V, name_en: "Vera", name_ru: "Вера", kind: "child", signed_in: null, passkey: null },
  ] };
  assert.deepEqual(signinSummary({ adoption, passkeysOn: true, lang: "RU" }), { passkeys: true, withKey: 1, of: 3, last: { name: "Борис", on: "2026-11-26" }, never: 1 });
  assert.equal(signinSummary({ adoption, passkeysOn: false, lang: "RU" }).withKey, null, "no key count while passkeys are off");
  assert.deepEqual(signinSummary({ adoption: null, passkeysOn: true, lang: "RU" }), { passkeys: true, withKey: null, of: null, last: null, never: null });
});

test("wiring: «Люди» reads the board once more and nothing else; «Доступ» adds no read and stays owner-only and read-only", () => {
  const pp = readFileSync("app/[lang]/family/os/people/page.tsx", "utf8");
  assert.match(pp, /childHome\(lang, state\.me\);\n[\s\S]*await getBoard\(session\)/, "a child is sent home before the board is read");
  const ap = readFileSync("app/[lang]/family/os/access/page.tsx", "utf8");
  assert.match(ap, /if \(!state\.admin\) notFound\(\);/);
  assert.match(ap, /roleRows\(\{ people: state\.people, grants: state\.grants, owners: familyEnv\.adminEmails\(\), editors: familyEnv\.editorEmails\(\)/);
  assert.doesNotMatch(ap.slice(ap.indexOf("const roles = roleRows")), /await get/, "no new Family OS read for the overview");
  assert.equal((ap.match(/await /g) ?? []).length, 5, "the same five awaits as before (params ×2, gate, state, rules + adoption)");
  const a = readFileSync("app/components/FamilyOsAccess.tsx", "utf8");
  const overview = a.slice(a.indexOf("function Overview("), a.indexOf("function PersonRow("));
  assert.doesNotMatch(overview, /onClick|onChange|<input|<form|send\(/, "the overview cards change nothing");
  assert.match(a, /noGuest: "Роли «гость» нет/);
});
