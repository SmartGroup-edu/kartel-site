// Bus 63: one family sub-nav on every family page; greeting from the Family OS profile.
import { test } from "node:test";
import assert from "node:assert/strict";
import { familySubNav, greeting } from "../app/lib/family-nav.mjs";

const ids = (o) => familySubNav(o).map((x) => x.id);

test("sub-nav: member sees Heritage · Today · People; admin also Access and Editor", () => {
  assert.deepEqual(ids({ lang: "RU", admin: false, os: true }), ["heritage", "today", "people", "council", "calendar"]);
  assert.deepEqual(ids({ lang: "RU", admin: true, os: true }), ["heritage", "today", "people", "council", "calendar", "access", "admin"]);
  assert.deepEqual(familySubNav({ lang: "RU", admin: false, os: true }).map((x) => x.label), ["Наследие", "Сегодня", "Люди", "Совет", "Календарь"]);
  assert.deepEqual(familySubNav({ lang: "EN", admin: true, os: true }).map((x) => x.href), ["/en/family", "/en/family/os", "/en/family/os/people", "/en/family/os/council", "/en/family/os/calendar", "/en/family/os/access", "/en/family/admin"]);
});

test("sub-nav: Family OS off or not a member → no OS items; a single item → no row at all", () => {
  assert.deepEqual(ids({ lang: "EN", admin: false, os: false }), []);
  assert.deepEqual(ids({ lang: "EN", admin: true, os: false }), ["heritage", "admin"]);
});

test("greeting: profile name; no name → no dangling comma; never an email", () => {
  assert.equal(greeting("RU", "Анна"), "Привет, Анна");
  assert.equal(greeting("EN", "Anna"), "Good to see you, Anna");
  for (const n of [null, "", "  ", undefined]) {
    assert.equal(greeting("RU", n), "Привет"); assert.equal(greeting("EN", n), "Good to see you");
  }
  assert.equal(greeting("EN", "someone@example.test"), "Good to see you");
  assert.doesNotMatch(greeting("RU", null), /,\s*$/);
});
