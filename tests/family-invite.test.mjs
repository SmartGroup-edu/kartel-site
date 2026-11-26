// bus 172 P4: the invite wizard's rules (app/lib/family-invite.mjs) and its letter preview, held to the relay's real
// renderer. Synthetic people only.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkStep1, invitePlan, accessPreview, grantScopes, inviteLetter, pendingCards, firstWord } from "../app/lib/family-invite.mjs";

let renderFamilyEmail;
before(async () => {
  Object.assign(process.env, { RELAY_NO_LISTEN: "1", RELAY_SECRET: process.env.RELAY_SECRET ?? "x".repeat(40), BREVO_API_KEY: process.env.BREVO_API_KEY ?? "test-key" });
  ({ renderFamilyEmail } = await import("../relay/server.mjs"));
});

const people = [
  { id: "a1", email: "anna@example.test", name_ru: "Анна", name_en: "Anna", kind: "adult" },
  { id: "c1", email: "vera@example.test", name_ru: "Вера", name_en: "Vera", kind: "child" },
];
const draft = (x = {}) => ({ name_ru: "Борис", name_en: "Boris", email: "Boris@Example.test ", role: "adult", children: [], parents: [], scopes: ["routines"], ...x });

test("step 1: names must pass the relay's first-name rule; email shape and uniqueness; a parent/relative needs a child", () => {
  assert.deepEqual(checkStep1(draft(), { people }), []);
  assert.deepEqual(checkStep1(draft({ name_ru: "", name_en: "B0ris" }), { people }), ["name_ru", "name_en"]);
  assert.deepEqual(checkStep1(draft({ email: "nope" }), { people }), ["email"]);
  assert.deepEqual(checkStep1(draft({ email: " ANNA@example.test" }), { people }), ["email_taken"]);
  assert.deepEqual(checkStep1(draft({ role: "parent" }), { people }), ["children"]);
  assert.deepEqual(checkStep1(draft({ role: "relative", children: ["c1"], scopes: [] }), { people }), ["scopes"]);
  assert.deepEqual(checkStep1(draft({ role: "guest" }), { people }), ["role"], "no guest role");
  assert.equal(firstWord("  Анна Мария "), "Анна");
});

test("plan: the person (address lowercased) and the grants the role needs, the new id left to fill", () => {
  assert.deepEqual(invitePlan(draft()), { person: { email: "boris@example.test", name_ru: "Борис", name_en: "Boris", kind: "adult" }, grants: [] });
  assert.deepEqual(invitePlan(draft({ role: "parent", children: ["c1"], scopes: ["health"] })).grants,
    [{ guardian_id: null, child_id: "c1", relation: "parent", scopes: ["routines", "health"] }], "a parent always has the routines");
  assert.deepEqual(invitePlan(draft({ role: "relative", children: ["c1"], scopes: ["education"] })).grants,
    [{ guardian_id: null, child_id: "c1", relation: "relative", scopes: ["education"] }], "a relative: only what was chosen");
  const kid = invitePlan(draft({ role: "child", parents: ["a1"], scopes: [] }));
  assert.equal(kid.person.kind, "child");
  assert.deepEqual(kid.grants, [{ guardian_id: "a1", child_id: null, relation: "parent", scopes: ["routines"] }]);
  assert.deepEqual(grantScopes(draft({ role: "parent", scopes: ["documents", "routines", "education"] })), ["routines", "education", "documents"], "canonical order");
});

test("preview: the menu rules (a child: Мой день + Календарь only; never «Доступ»), and sensitive areas named", () => {
  const on = (d) => accessPreview(d, { people, lang: "RU" }).sections.filter((s) => s.on).map((s) => s.key);
  assert.deepEqual(on(draft({ role: "child" })), ["myday", "calendar"]);
  assert.deepEqual(on(draft()), ["today", "board", "calendar", "council", "people", "docs"]);
  assert.ok(accessPreview(draft(), { people, lang: "RU" }).sections.some((s) => s.key === "access" && !s.on), "nobody invited gets «Доступ и безопасность»");
  const p = accessPreview(draft({ role: "parent", children: ["c1"], scopes: ["health", "documents"] }), { people, lang: "RU" });
  assert.deepEqual(p.areas, [{ child: "Вера", scopes: ["routines", "health", "documents"], sensitive: ["health", "documents"] }]);
});

test("the letter preview is the relay's invite letter, word for word (RU and EN)", () => {
  for (const [lang, rl] of [["RU", "ru"], ["EN", "en"]]) {
    const mine = inviteLetter(lang, "Борис", "2026-11-26");
    const real = renderFamilyEmail({ kind: "invite", lang: rl, firstName: "Борис", date: "2026-11-26", link: "https://kartel.org.uk/ru/family/os", settingsLink: "https://kartel.org.uk/ru/family/os/people/00000000-0000-4000-8000-000000000000#letters" });
    assert.equal(mine.subject, real.subject, lang);
    for (const k of ["hello", "dateLine", "lead", "button", "off", "offLink"]) assert.ok(real.html.includes(mine[k].replace(/"/g, "&quot;")) || real.text.includes(mine[k]), `${lang} ${k}: ${mine[k]}`);
  }
});

test("«Ждут ответа»: not signed in and not cancelled; cancel only where the service can cancel", () => {
  const row = (id, x = {}) => ({ id, name_ru: id, name_en: id, kind: "adult", signed_in: null, invite: null, ...x });
  const adoption = { people: [row("in", { signed_in: { first_on: "2026-11-01", last_on: "2026-11-26" } }), row("none"), row("sent", { invite: { on_date: "2026-11-26", sent: true, sent_at: "x", cancelled: false } }),
    row("gone", { invite: { on_date: "2026-11-26", sent: false, sent_at: null, cancelled: true } }), row("old", { invite: { on_date: "2026-11-20", sent: true, sent_at: "x" } })] };
  const cards = pendingCards({ adoption, listed: { none: "not_listed" } });
  assert.deepEqual(cards.map((c) => c.id), ["none", "sent", "old"]);
  assert.deepEqual(cards.map((c) => c.canCancel), [false, true, false], "no invitation, or a service from before P4: no «Отменить»");
  assert.deepEqual(cards.map((c) => c.access), ["not_listed", "unknown", "unknown"]);
  assert.equal(pendingCards({ adoption: null, listed: {} }), null, "/adoption did not answer: no cards, not an empty list");
});

test("the access-list check is owner-only, same-origin, read-only", () => {
  const src = readFileSync(new URL("../app/api/family-invite/route.ts", import.meta.url), "utf8");
  assert.match(src, /isFamilyAdmin\(session\.cpifSubjectId\)/);
  assert.match(src, /req\.headers\.get\("origin"\) !== familyEnv\.siteOrigin\(\)/);
  assert.match(src, /sessionEndedByOwner/);
  assert.doesNotMatch(src, /\b(set|update|patch|put)\w*\(/i, "nothing is written");
  assert.doesNotMatch(src, /export async function (GET|PUT|PATCH|DELETE)/);
});
