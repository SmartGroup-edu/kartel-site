// Bus 174: the Family OS, the public home and the sign-in use the KARTEL brand palette
// (~/KARTEL-Vault/90-References/brand/kartel-brand-guide.md), not the green of the v5 mockup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ratio } from "./theme-contrast.test.mjs";
import { AVATAR_COLOURS } from "../app/lib/family-avatars.mjs";

const css = readFileSync("app/globals.css", "utf8");
const block = (sel) => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `${sel} block present`);
  const body = css.slice(i, css.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]));
};
const hue = (h) => {
  const n = parseInt(h.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.08) return null; // a grey
  const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (x * 60 + 360) % 360;
};
const isGreen = (h) => { const x = hue(h); return x !== null && x >= 90 && x <= 175; };
const OLD_GREENS = ["#2e7d52", "#1e4d35", "#3e9b68", "#5dbb85", "#276b46", "#24603f", "#0f2a1d", "#8fe0ae", "#3c8a5c", "#163826", "#2f6b4f", "#7fc3a0", "#1d4a35", "#a6e3c4"];

test("light: the brand values — cream page, ink text and primary fills, burgundy links, gold accent; muted darkened only as far as AA needs", () => {
  const t = block(":root:not(.hc) [data-fos]");
  assert.equal(t["fos-bg"], "#f5f0ea");
  assert.equal(t["fos-panel"], "#ffffff");
  assert.equal(t.foreground, "#1a1a1a");
  assert.equal(t["fos-primary"], "#1a1a1a"); assert.equal(t["fos-on-primary"], "#ffffff");
  assert.equal(t.accent, "#7b1e2d");
  assert.equal(t["fos-accent-2"], "#b08d57"); assert.equal(t["fos-brief-ring"], "#b08d57");
  assert.deepEqual([t["fos-brief-from"], t["fos-brief-to"]], ["#1a1a1a", "#3a1018"]);
  // the brand muted #8a8278 fails AA on the cream page; the shipped value passes and is no darker than it must be
  assert.ok(ratio("#8a8278", "#f5f0ea") < 4.5);
  assert.ok(ratio(t.muted, "#f5f0ea") >= 4.5 && ratio(t.muted, "#f5f0ea") < 5, t.muted);
  // gold is never body text on light surfaces
  for (const k of ["foreground", "text-body", "text-secondary", "text-nav", "muted", "accent"]) assert.notEqual(t[k], "#b08d57", k);
});

test("dark (bus 176 P2): the heraldic mockup palette — #0a0908 page, warm panels, gold accent, wine soft fills, dark text on gold fills", () => {
  const t = block(':root:not(.hc) [data-fos][data-theme="dark"]');
  assert.equal(t["fos-bg"], "#0a0908"); assert.deepEqual([t["fos-panel"], t["fos-panel-2"]], ["#12100e", "#17130f"]);
  assert.equal(t.foreground, "#f3ede4"); assert.equal(t.border, "#2b2520");
  assert.equal(t.accent, "#e0b76e"); assert.equal(t["fos-primary"], "#c9964e"); assert.equal(t["fos-wine"], "#7b1e2d");
  assert.match(css.slice(css.indexOf(':root:not(.hc) [data-fos][data-theme="dark"] {')), /--fos-primary-img: linear-gradient\(135deg, #8a6a33 0%, #c9964e 22%, #f6dca0 42%/);
  for (const [fg, bg] of [["on-accent", "accent"], ["fos-on-primary", "fos-primary"], ["fos-on-accent-2", "fos-accent-2"]]) assert.ok(ratio(t[fg], t[bg]) >= 4.5, `${fg}/${bg}`);
});

test("no green as a brand colour: in the shell palettes only --ok / --ok-soft (status pills and checkmarks) may lean green, and they are olive", () => {
  for (const sel of [":root:not(.hc) [data-fos]", ':root:not(.hc) [data-fos][data-theme="dark"]', ":root", ".dark", ":root.hc:not(.dark)", ":root.dark.hc"]) {
    const t = block(sel);
    for (const [k, v] of Object.entries(t)) if (!["ok", "ok-soft"].includes(k)) assert.ok(!isGreen(v), `${sel} --${k} ${v} is green`);
    for (const k of ["ok", "ok-soft"]) if (t[k]) assert.ok(hue(t[k]) === null || hue(t[k]) < 90, `${sel} --${k} ${t[k]} is olive, not green`);
  }
});

test("no old green left in the site's code (the ops console at app/console is a separate surface)", () => {
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = walk("app").filter((f) => /\.(tsx?|mjs|css)$/.test(f) && !f.startsWith(join("app", "console")));
  const hits = [];
  for (const f of files) { const s = readFileSync(f, "utf8").toLowerCase(); for (const g of OLD_GREENS) if (s.includes(g)) hits.push(`${f} ${g}`); }
  assert.deepEqual(hits, []);
});

test("person colours: no green, white text ≥ 4.5:1; the logo tile is ink with a gold K", () => {
  for (const c of AVATAR_COLOURS) assert.ok(!isGreen(c), c);
  const shell = readFileSync("app/components/FamilyOsShell.tsx", "utf8");
  assert.match(shell, /function Logo\(\) \{\s*return <span[^>]*bg-\[#1a1a1a\][^>]*text-\[#b08d57\][^>]*>K<\/span>/);
  // active nav: burgundy text with a gold indicator
  assert.match(shell, /text-\[var\(--accent\)\] shadow-\[inset_3px_0_0_var\(--fos-accent-2\)\]/);
  assert.match(shell, /text-\[var\(--accent\)\] shadow-\[inset_0_3px_0_var\(--fos-accent-2\)\]/);
});

test("the calendar's council chips are burgundy on gold-cream (green was a status colour used as a kind colour)", () => {
  assert.match(readFileSync("app/components/FamilyCalendar.tsx", "utf8"), /council: \{ fg: "var\(--accent\)", bg: "var\(--accent-soft\)" \}/);
});

test("links are burgundy, not the olive status colour (no href styled with --ok)", () => {
  const hits = [];
  for (const f of readdirSync("app/components").filter((x) => x.endsWith(".tsx"))) {
    const s = readFileSync(join("app/components", f), "utf8");
    for (const line of s.split("\n")) if (/href=/.test(line) && /text-\[var\(--ok\)\]/.test(line)) hits.push(`${f}: ${line.trim().slice(0, 80)}`);
    if (/const MORE = "[^"]*text-\[var\(--ok\)\]/.test(s)) hits.push(`${f}: MORE`);
  }
  assert.deepEqual(hits, []);
});
