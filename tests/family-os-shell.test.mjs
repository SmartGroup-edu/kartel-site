// Bus 171 (Family OS redesign, phase 1): the app shell — sections, names, addresses, the current section, ⌘K search,
// the «Задачи» badge, and the AA contrast of the Family OS palette in light and dark.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { osShellNav, activeOsSection, searchSections, openTaskCount, OS_PATHS } from "../app/lib/family-os-shell.mjs";
import { ratio } from "./theme-contrast.test.mjs";

const ids = (o) => osShellNav({ lang: "RU", ...o }).groups.map((g) => [g.id, g.items.map((i) => i.id)]);

test("route mapping: the old addresses, the new names (RU and EN)", () => {
  const all = osShellNav({ lang: "RU", admin: true, os: true, editor: false, member: true }).groups.flatMap((g) => g.items);
  assert.deepEqual(all.map((i) => [i.href, i.label]), [
    ["/ru/family/os", "Сегодня"], ["/ru/family/os/board", "Задачи"], ["/ru/family/os/calendar", "Календарь"], ["/ru/family/os/council", "Решения"], ["/ru/family/os/review", "Обзор недели"],
    ["/ru/family/os/people", "Люди"], ["/ru/family/os/kodeks", "Документы и правила"], ["/ru/family", "Наследие"],
    ["/ru/family/os/companies", "Компании и проекты"], ["/ru/registry", "Реестр и KARTEL Core"], ["/ru/family/os/access", "Доступ и безопасность"], ["/ru/family/admin", "Редактор наследия"],
  ]);
  const en = osShellNav({ lang: "EN", admin: true, os: true, member: true }).groups.flatMap((g) => g.items);
  assert.deepEqual(en.map((i) => i.label), ["Today", "Tasks", "Calendar", "Decisions", "Weekly review", "People", "Documents and rules", "Heritage", "Companies and projects", "Registry and KARTEL Core", "Access and security", "Heritage editor"]);
  // bus 176 P1: the registry item is the one address outside /family (KARTEL Core and the registry moved behind sign-in)
  assert.ok(en.every((i) => i.href.startsWith("/en/family") || (i.id === "registry" && i.href === "/en/registry")));
});

test("no technical labels on screen: no Kodeks, Council, Board, Week, Access, registry or layers as a name", () => {
  for (const lang of ["RU", "EN"]) {
    const n = osShellNav({ lang, admin: true, os: true, editor: true, member: true });
    const words = [...n.groups.flatMap((g) => [g.label ?? "", ...g.items.map((i) => i.label)]), n.label, n.tabsLabel];
    // bus 176 P1: «Реестр и KARTEL Core» is the one registry name the approved sitemap mockup puts in «Бизнес»
    for (const w of words.filter((x) => !/^(Реестр и KARTEL Core|Registry and KARTEL Core)$/.test(x))) assert.doesNotMatch(w, /^(Access|Board|Council|Week)$|kodeks|кодекс|council|совет|доска|registry|реестр|layers?|сло[йи]/i, w);
  }
});

test("groups: main (Сегодня · Задачи · Календарь · Решения · Обзор недели), Семья, Бизнес, Управление; the phone tab bar is the main group's first four", () => {
  assert.deepEqual(ids({ admin: true, os: true, member: true }), [["main", ["today", "board", "calendar", "council", "review"]], ["family", ["people", "kodeks", "heritage"]], ["business", ["companies", "registry"]], ["settings", ["access", "admin"]]]);
  const n = osShellNav({ lang: "RU", admin: false, os: true, member: true });
  assert.deepEqual(n.tabs.map((t) => t.id), ["today", "board", "calendar", "council"]);
  assert.deepEqual(n.groups.map((g) => g.label), [null, "Семья", "Бизнес"]);
});

test("hidden, never dead: a section shows only when its page exists for this viewer", () => {
  // a member: no «Доступ и безопасность», no editor
  assert.deepEqual(ids({ admin: false, os: true, member: true }).flatMap(([, x]) => x), ["today", "board", "calendar", "council", "review", "people", "kodeks", "heritage", "companies", "registry"]);
  // the owner who is not a member: those pages answer 404 (QA-156 L7), Кодекс and «Обзор недели» too; the registry's
  // companies need no Family OS data, so the owner keeps them (bus 172 P6)
  assert.deepEqual(ids({ admin: true, os: true, member: false }).flatMap(([, x]) => x), ["today", "people", "heritage", "companies", "registry", "access", "admin"]);
  // an editor: the heritage editor, never access
  assert.ok(ids({ admin: false, os: true, editor: true }).flatMap(([, x]) => x).includes("admin"));
  assert.ok(!ids({ admin: false, os: true, editor: true }).flatMap(([, x]) => x).includes("access"));
  // signed in, not in Family OS: only the heritage page
  assert.deepEqual(ids({ admin: false, os: false, member: false }), [["family", ["heritage"]]]);
  // every item's page exists in the app
  for (const id of Object.keys(OS_PATHS)) {
    const p = OS_PATHS[id];
    const file = p === "" ? "app/[lang]/family/page.tsx" : `app/[lang]/family${p}/page.tsx`;
    assert.ok(readFileSync(file, "utf8").length > 0, file);
  }
});

test("current section: /os/week belongs to Календарь, a person's page to Люди", () => {
  const cases = { "/ru/family/os": "today", "/en/family/os/": "today", "/ru/family/os/board": "board", "/ru/family/os/calendar": "calendar", "/ru/family/os/week": "calendar",
    "/ru/family/os/council": "council", "/ru/family/os/people": "people", "/ru/family/os/people/0b6f7a4e-0000-4000-8000-000000000000": "people",
    "/ru/family/os/kodeks": "kodeks", "/ru/family/os/access": "access", "/ru/family/os/review": "review", "/ru/family/os/companies": "companies", "/ru/family": "heritage", "/ru/family/admin": "admin", "/ru/registry": null, "/ru/family/os/nope": null };
  for (const [p, want] of Object.entries(cases)) assert.equal(activeOsSection(p), want, p);
});

test("⌘K searches the sections only: substring, any case, ё = е", () => {
  const items = osShellNav({ lang: "RU", admin: true, os: true, member: true }).groups.flatMap((g) => g.items);
  assert.deepEqual(searchSections(items, "реш").map((i) => i.id), ["council"]);
  assert.deepEqual(searchSections(items, "ДОКУМ").map((i) => i.id), ["kodeks"]);
  assert.deepEqual(searchSections(items, "без").map((i) => i.id), ["access"]);
  assert.equal(searchSections(items, "").length, items.length);
  assert.deepEqual(searchSections(items, "zzz"), []);
});

test("«Задачи» badge = open tasks: new + accepted + in progress; done and declined do not count; only when > 0", () => {
  assert.equal(openTaskCount(null), 0);
  assert.equal(openTaskCount({ new: [{}, {}], mine: [{ state: "accepted" }, { state: "in_progress" }, { state: "done" }, { state: "reviewed" }, { state: "declined" }] }), 4);
  const withBadge = osShellNav({ lang: "RU", admin: false, os: true, member: true, badges: { board: 3 } });
  assert.equal(withBadge.groups[0].items.find((i) => i.id === "board").badge, 3);
  const none = osShellNav({ lang: "RU", admin: false, os: true, member: true, badges: { board: 0 } });
  assert.equal(none.groups[0].items.find((i) => i.id === "board").badge, undefined);
});

test("the shell: every icon-only button has a name; the tab bar is a nav of links (keyboard reachable); focus ring kept", () => {
  const s = readFileSync("app/components/FamilyOsShell.tsx", "utf8");
  for (const b of s.match(/<button(?:=>|[^>])*>/g) ?? []) {
    const named = /aria-label=|data-cmdk=""|role="combobox"/.test(b) || /type="button" onClick=\{\(\) => setPalette\(true\)\} aria-keyshortcuts/.test(b);
    assert.ok(named, b);
  }
  assert.match(s, /<nav aria-label=\{tabsLabel\} data-fos-tabbar=""/);
  assert.match(s, /<Link prefetch=\{false\} href=\{x\.href\} aria-current=\{on \? "page" : undefined\} data-tab=\{x\.id\}/);
  assert.doesNotMatch(s, /tabIndex=\{-1\}[^>]*data-tab|outline-none[^"]*focus-visible/, "no tab is taken out of the tab order");
  assert.match(readFileSync("app/globals.css", "utf8"), /\[data-fos\] :is\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible \{\s*outline-color: var\(--fos-gold-line\);/);
});

const css = readFileSync("app/globals.css", "utf8");
const block = (sel) => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `${sel} block present`);
  const body = css.slice(i, css.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]));
};

for (const [sel, name] of [[":root:not(.hc) [data-fos]", "light"], [':root:not(.hc) [data-fos][data-theme="dark"]', "dark"]]) {
  test(`Family OS palette (${name}): text ≥ 4.5:1 (AA) on the page, panels and soft fills; controls ≥ 3:1`, () => {
    const t = block(sel);
    const fails = [];
    const need = (fg, bg, min) => { const r = ratio(t[fg], t[bg]); if (!(r >= min)) fails.push(`${fg}/${bg} ${r.toFixed(2)}`); };
    for (const fg of ["foreground", "text-body", "text-secondary", "muted", "accent", "ok", "fos-amber", "destructive", "fos-blue", "fos-plum"])
      for (const bg of ["fos-bg", "fos-panel", "fos-panel-2"]) need(fg, bg, 4.5);
    for (const [fg, bg] of [["on-accent", "accent"], ["fos-on-accent-2", "fos-accent-2"], ["fos-on-amber", "fos-amber"], ["accent", "accent-soft"], ["ok", "ok-soft"],
      ["fos-amber", "warn-soft"], ["fos-blue", "fos-blue-soft"], ["fos-plum", "fos-plum-soft"], ["destructive", "fos-red-soft"], ["fos-brief-text", "fos-brief-from"], ["fos-brief-text", "fos-brief-to"],
      ["fos-on-primary", "fos-primary"], ["fos-on-ok", "ok"], ["accent", "accent-soft"], ["foreground", "accent-soft"]]) need(fg, bg, 4.5);
    for (const bg of ["fos-panel", "fos-panel-2"]) need("fos-control", bg, 3);
    // bus 174: the gold lines (focus ring, selected borders, bars, icons) and the hero ring are non-text UI → ≥ 3:1
    for (const bg of ["fos-bg", "fos-panel", "fos-panel-2", "accent-soft"]) need("fos-gold-line", bg, 3);
    for (const bg of ["fos-brief-from", "fos-brief-to"]) need("fos-brief-ring", bg, 3);
    assert.deepEqual(fails, []);
  });
}

test("Family OS palette: radii 14/16, Playfair + Manrope (text 350, lead 300), high contrast keeps its AAA tokens", () => {
  assert.match(css, /\[data-fos\] \{\s*--radius: 14px;\s*--fos-radius: 16px;\s*font-weight: 350;\s*\}/);
  assert.match(css, /\[data-fos\] h1 \+ p:not\(\[role\]\) \{\s*font-weight: 300;/);
  assert.match(css, /--font-serif: "Playfair Display", Georgia/); assert.match(css, /--font-sans: "Manrope", /);
  const hc = css.slice(css.indexOf(":root.hc [data-fos] {"), css.indexOf("}", css.indexOf(":root.hc [data-fos] {")));
  assert.doesNotMatch(hc, /--(foreground|accent|muted|background|border):/, "HC text tokens are not overridden");
});

test("os/week is kept and reached from Календарь (and still from the council)", () => {
  assert.match(readFileSync("app/components/FamilyCalendar.tsx", "utf8"), /href=\{`\$\{base\}\/week`\} data-week-link=""/);
  assert.match(readFileSync("app/components/FamilyCouncil.tsx", "utf8"), /family\/os\/week`\} data-week-link=""/);
});
