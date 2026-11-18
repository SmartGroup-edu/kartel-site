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

test("theme menu: Светлая / Тёмная / Системная + «Высокий контраст», stored per device; the boot script applies both before paint", () => {
  const menu = readFileSync("app/components/ThemeToggle.tsx", "utf8");
  for (const s of ["Светлая", "Тёмная", "Системная", "Высокий контраст"]) assert.ok(menu.includes(s), s);
  assert.match(menu, /role="menuitemradio"/); assert.match(menu, /role="menuitemcheckbox"/);
  const hook = readFileSync("app/components/useTheme.ts", "utf8");
  assert.match(hook, /CONTRAST_KEY = "kartel-contrast"/); assert.match(hook, /localStorage\.setItem\(CONTRAST_KEY/);
  const layout = readFileSync("app/[lang]/layout.tsx", "utf8");
  assert.match(layout, /kartel-contrast/); assert.match(layout, /classList\.add\('hc'\)/);
});
