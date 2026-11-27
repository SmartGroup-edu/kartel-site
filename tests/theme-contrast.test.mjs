// «Системная» theme + «Высокий контраст» (bus 84/97 item 2): AAA tokens, per-device storage, boot script.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");
const block = (sel) => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `${sel} block present`);
  const body = css.slice(i, css.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]));
};
const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const TEXT = ["foreground", "accent", "muted", "muted-light", "text-body", "text-secondary", "text-nav", "drop-cap", "destructive", "ok", "sprint"];
const PAIRS = [["on-accent", "accent"], ["destructive-foreground", "destructive"], ["band-accent", "band-bg"], ["foreground", "ok-soft"], ["ok", "ok-soft"],
  ["foreground", "warn-soft"], ["foreground", "accent-soft"], ["accent", "accent-soft"], ["sprint", "sprint-soft"], ["foreground", "sprint-soft"]];

for (const [sel, pillar] of [[":root.hc:not(.dark)", "#000000"], [":root.dark.hc", "#ffffff"]]) {
  test(`high contrast ${sel}: every text token ≥ 7:1 (AAA) on background and surface; borders ≥ 3:1; pillars → ${pillar}`, () => {
    const t = block(sel);
    const fails = [];
    for (const k of TEXT) for (const bg of ["background", "surface"]) if (ratio(t[k], t[bg]) < 7) fails.push(`${k}/${bg} ${ratio(t[k], t[bg]).toFixed(2)}`);
    for (const [fg, bg] of PAIRS) if (ratio(t[fg], t[bg]) < 7) fails.push(`${fg}/${bg} ${ratio(t[fg], t[bg]).toFixed(2)}`);
    for (const k of ["border", "warn-border", "wait-border"]) for (const bg of ["background", "surface"]) if (ratio(t[k], t[bg]) < 3) fails.push(`${k}/${bg} ${ratio(t[k], t[bg]).toFixed(2)}`);
    assert.deepEqual(fails, []);
    for (const k of ["rhythm", "health", "growth", "kodeks"]) assert.equal(t[`pillar-${k}`], pillar, k);
  });
}

test("theme menu (bus 176 P2): Светлая / Тёмная / Как в системе + «Высокий контраст»; stored in cookies; the boot script applies both before paint", () => {
  const menu = readFileSync("app/components/ThemeToggle.tsx", "utf8");
  for (const s of ["Светлая", "Тёмная", "Как в системе", "Высокий контраст"]) assert.ok(menu.includes(s), s);
  assert.match(menu, /role="menuitemradio"/); assert.match(menu, /role="menuitemcheckbox"/);
  const hook = readFileSync("app/components/useTheme.ts", "utf8");
  assert.match(hook, /writeCookie\(CONTRAST_COOKIE, c\)/); assert.match(hook, /writeCookie\(THEME_COOKIE, t\)/);
  assert.doesNotMatch(hook, /localStorage\.setItem/, "the choice is a cookie now, not localStorage");
  for (const f of ["app/[lang]/layout.tsx", "app/global-not-found.tsx"]) assert.match(readFileSync(f, "utf8"), /__html: themeBootScript\((false)?\)/, f);
});

/** Run the boot script against a fake document: `cookie` is the document.cookie string, `ls` the legacy localStorage. */
async function boot({ cookie = "", ls = {}, dark = false, more = false, https = true } = {}) {
  const { themeBootScript } = await import("../app/lib/theme.mjs");
  const classes = new Set(), written = [];
  let meta = null;
  const document = {
    get cookie() { return cookie; },
    set cookie(v) { written.push(v); const [kv] = v.split(";"); cookie = cookie ? `${cookie}; ${kv}` : kv; },
    documentElement: { classList: { add: (c) => classes.add(c) } },
    querySelector: () => ({ setAttribute: (_k, v) => { meta = v; } }),
  };
  const matchMedia = (q) => ({ matches: q.includes("dark") ? dark : q.includes("contrast") ? more : false });
  new Function("document", "localStorage", "matchMedia", "location", themeBootScript())(document, { getItem: (k) => ls[k] ?? null }, matchMedia, { protocol: https ? "https:" : "http:" });
  return { classes: [...classes].sort(), written, meta };
}

test("boot script: the cookie decides; «как в системе» (or no choice) follows the OS; theme-color follows", async () => {
  assert.deepEqual((await boot({ cookie: "kartel-theme=dark" })).classes, ["dark"]);
  assert.equal((await boot({ cookie: "kartel-theme=dark" })).meta, "#0a0908");
  assert.deepEqual((await boot({ cookie: "kartel-theme=light", dark: true })).classes, []);
  assert.equal((await boot({ cookie: "kartel-theme=light", dark: true })).meta, "#ffffff");
  assert.deepEqual((await boot({ cookie: "kartel-theme=system", dark: true })).classes, ["dark"]);
  assert.deepEqual((await boot({ dark: true })).classes, ["dark"], "default follows the system");
  assert.deepEqual((await boot({})).classes, []);
  assert.deepEqual((await boot({ cookie: "x=1; kartel-contrast=high; kartel-theme=dark" })).classes, ["dark", "hc"]);
  assert.deepEqual((await boot({ more: true })).classes, ["hc"], "no stored contrast: follow prefers-contrast");
  assert.deepEqual((await boot({ cookie: "kartel-contrast=normal", more: true })).classes, []);
});

test("boot script: a legacy localStorage choice is copied into the cookie once (Secure on https); a cookie beats localStorage", async () => {
  const r = await boot({ ls: { "kartel-theme": "dark", "kartel-contrast": "high" } });
  assert.deepEqual(r.classes, ["dark", "hc"]);
  assert.deepEqual(r.written, ["kartel-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure", "kartel-contrast=high; Path=/; Max-Age=31536000; SameSite=Lax; Secure"]);
  assert.deepEqual((await boot({ ls: { "kartel-theme": "dark" }, https: false })).written, ["kartel-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax"]);
  const c = await boot({ cookie: "kartel-theme=light", ls: { "kartel-theme": "dark" } });
  assert.deepEqual([c.classes, c.written.length], [[], 0]);
  assert.deepEqual((await boot({ ls: { "kartel-theme": "<script>" } })).written, [], "junk is not copied");
});

test("server render (bus 176 P2): the Family OS layout reads the cookie and the shell carries it as data-theme (body too, for dialogs)", async () => {
  const { parseTheme } = await import("../app/lib/theme.mjs");
  assert.deepEqual(["light", "dark", "system", undefined, "x"].map(parseTheme), ["light", "dark", "system", "system", "system"]);
  const l = readFileSync("app/[lang]/family/os/layout.tsx", "utf8");
  assert.match(l, /const theme = parseTheme\(\(await cookies\(\)\)\.get\(THEME_COOKIE\)\?\.value\);/);
  assert.match(l, /<FamilyOsShell [^>]*theme=\{theme\}>/);
  const s = readFileSync("app/components/FamilyOsShell.tsx", "utf8");
  assert.match(s, /<div data-fos="" data-theme=\{theme\}/);
  assert.match(s, /document\.body\.setAttribute\("data-theme", theme\)/);
  assert.match(s, /useTheme\(serverTheme\)/); assert.match(s, /<ThemeToggle placement="up" initial=\{theme\} \/>/);
  assert.match(css, /:root\.dark:not\(\.hc\) \[data-fos\],\n:root:not\(\.hc\) \[data-fos\]\[data-theme="dark"\] \{/);
});

test("⌘K (bus 176 P2): «Тема: светлая / тёмная / как в системе» are commands after the sections; the current one is marked", async () => {
  const s = readFileSync("app/components/FamilyOsShell.tsx", "utf8");
  for (const x of ["Тема: светлая", "Тема: тёмная", "Тема: как в системе", "Theme: light", "Theme: dark", "Theme: match system"]) assert.ok(s.includes(x), x);
  assert.match(s, /if \("theme" in x\) setTheme\(x\.theme\); else router\.push\(x\.href\);/);
  assert.match(s, /<span className="sr-only">, \{t\.current\}<\/span>/);
  const { searchSections } = await import("../app/lib/family-os-shell.mjs");
  const cmds = [{ label: "Тема: светлая" }, { label: "Тема: тёмная" }, { label: "Тема: как в системе" }];
  assert.equal(searchSections(cmds, "тема").length, 3);
  assert.deepEqual(searchSections(cmds, "темн").map((x) => x.label), ["Тема: тёмная"], "ё-insensitive");
});

test("print beats high contrast: the print block also targets the .hc selectors (same specificity, later in the file)", () => {
  const p = css.indexOf("@media print");
  assert.ok(p > css.indexOf(":root.dark.hc {"), "print comes after the HC blocks");
  assert.match(css.slice(p), /:root\.hc:not\(\.dark\),\s*:root\.dark\.hc \{/);
});

test("bus 101: high contrast is visible with the menu closed (a mark on the button + its label) and checked in the menu", () => {
  const m = readFileSync("app/components/ThemeToggle.tsx", "utf8");
  assert.match(m, /\{contrast === "high" && \(\s*<svg data-hc-mark=""/);
  assert.match(m, /aria-label=\{contrast === "high" \? `\$\{t\.open\} · \$\{t\.on\}` : t\.open\}/);
  assert.match(m, /role="menuitemcheckbox" aria-checked=\{contrast === "high"\}/);
});
