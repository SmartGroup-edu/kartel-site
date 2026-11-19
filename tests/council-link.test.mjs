// Bus 126 — the unlisted council mockup at /m/<24 hex>/: static, noindex, no referrer, outside the family gate and the sitemap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ids = readdirSync(new URL("../public/m/", import.meta.url));

test("one page under public/m/<24 hex>/ — noindex, no referrer, the «макет» line, no external address, no real names", () => {
  assert.equal(ids.length, 1); assert.match(ids[0], /^[0-9a-f]{24}$/);
  const html = src(`public/m/${ids[0]}/index.html`);
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.match(html, /Макет для семейного совета · ничего не сохраняется/);
  assert.equal((html.match(/https?:\/\//g) ?? []).length, 0, "works offline; loads nothing from anywhere");
  for (const role of ["Мама", "Папа", "Сын", "Дочь", "Бабушка"]) assert.ok(html.includes(role), "names are roles");
});

test("served at /m/<id>/ by a rewrite; the proxy skips /m/; headers say noindex + no-referrer; not in the sitemap", () => {
  const cfg = src("next.config.ts");
  assert.match(cfg, /\{ source: "\/m\/:id\(\[0-9a-f\]\{24\}\)", destination: "\/m\/:id\/index\.html" \}/);
  assert.match(cfg, /\{ source: "\/m\/:path\*", headers: \[\{ key: "X-Robots-Tag", value: "noindex, nofollow" \}, \{ key: "Referrer-Policy", value: "no-referrer" \}\] \}/);
  assert.match(src("proxy.ts"), /"\/\(\(\?!_next\|api\|m\/\|sitemap/);
  assert.doesNotMatch(src("app/sitemap.ts"), /\/m\//);
});
