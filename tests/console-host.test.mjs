import { test } from "node:test";
import assert from "node:assert/strict";
import { consoleRedirectTarget } from "../app/lib/console-host.mjs";

const C = "https://console.kartel.org.uk/";

test("apex /console goes to the console host", () => {
  assert.equal(consoleRedirectTarget("kartel.org.uk", "/console"), C);
  assert.equal(consoleRedirectTarget("www.kartel.org.uk", "/console/x"), C);
});
test("vercel.app aliases that bypass Cloudflare are redirected too", () => {
  assert.equal(consoleRedirectTarget("kartel-site-tau.vercel.app", "/console"), C);
});
test("query string is kept", () => {
  assert.equal(consoleRedirectTarget("kartel.org.uk", "/console", "?a=1"), C + "?a=1");
});
test("the console host itself is not redirected (no loop)", () => {
  assert.equal(consoleRedirectTarget("console.kartel.org.uk", "/console"), null);
  assert.equal(consoleRedirectTarget("CONSOLE.kartel.org.uk:443", "/"), null);
});
test("other paths are untouched, including /family", () => {
  assert.equal(consoleRedirectTarget("kartel.org.uk", "/en/family"), null);
  assert.equal(consoleRedirectTarget("kartel.org.uk", "/consoles"), null);
  assert.equal(consoleRedirectTarget("kartel.org.uk", "/en"), null);
});
test("local dev is exempt", () => {
  assert.equal(consoleRedirectTarget("localhost:3000", "/console"), null);
});
