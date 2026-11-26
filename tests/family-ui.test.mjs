// QA-156 (M7, L6, L8, L10) and the bus 157b design review (D1–D11) on the Family OS pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { typograph, typographDict, tx } from "../app/lib/typograph.mjs";
import { ruleMode, ruleBody } from "../app/lib/family-rules.mjs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NB = " ";
const comp = (f) => src(`app/components/${f}`);

test("L8 typograph: no line ends on a short word — the QA-156 cases", () => {
  const cases = [
    ["Служу, а не командую.", `Служу, а${NB}не${NB}командую.`],
    ["Ребёнок: не принято", `Ребёнок: не${NB}принято`],
    ["Убрать со стола", `Убрать со${NB}стола`],
    ["План на завтра — утвердить до 21:00", `План на${NB}завтра${NB}— утвердить до${NB}21:00`],
    ["подводим итоги на совете в воскресенье в 19:00", `подводим итоги на${NB}совете в${NB}воскресенье в${NB}19:00`],
    ["Задачи с прошлого совета", `Задачи с${NB}прошлого совета`],
    ["Лист на холодильнике увидят все дома", `Лист на${NB}холодильнике увидят все${NB}дома`],
    ["Спрашиваю с себя первым", `Спрашиваю с${NB}себя первым`],
    ["войди заново по ссылке из письма", `войди заново по${NB}ссылке из${NB}письма`],
    ["что ещё не отмечено сегодня", `что${NB}ещё${NB}не${NB}отмечено сегодня`],
    ["никто в семье этого не видит, и это не попадает", `никто в${NB}семье этого не${NB}видит, и${NB}это${NB}не${NB}попадает`],
  ];
  for (const [i, o] of cases) assert.equal(typograph(i), o, i);
});

test("L8 typograph: a number stays with its unit or word; signs and dashes; trailing particles", () => {
  assert.equal(typograph("через 7 дней"), `через 7${NB}дней`);
  assert.equal(typograph("~5 мин"), `~5${NB}мин`);
  assert.equal(typograph("< 3 мес"), `<${NB}3${NB}мес`);
  assert.equal(typograph("3 из 7 на этой неделе"), `3${NB}из${NB}7${NB}на${NB}этой неделе`);
  assert.equal(typograph("Файл до 4 МБ"), `Файл до${NB}4${NB}МБ`);
  assert.equal(typograph("только 18 +"), `только 18${NB}+`);
  assert.equal(typograph("Ориентир NHS для 5–18 лет"), `Ориентир NHS для${NB}5–18${NB}лет`);
  assert.equal(typograph("Что же делать"), `Что${NB}же${NB}делать`);
  assert.equal(typograph("Так ли это"), `Так${NB}ли${NB}это`);
  assert.equal(typograph("Сегодня в 19:00 — семейный совет"), `Сегодня в${NB}19:00${NB}— семейный совет`);
});

test("L8 typograph: only spaces change; nothing else, no double work, non-strings pass through", () => {
  const s = "Если потерян телефон или ноутбук: все, включая тебя, войдут заново по ссылке из письма.";
  const out = typograph(s);
  assert.equal(out.replaceAll(NB, " "), s, "same text once no-break spaces read as spaces");
  assert.equal(typograph(out), out, "idempotent");
  assert.equal(typograph(""), ""); assert.equal(typograph("Готово"), "Готово");
  assert.equal(typograph(/** @type {any} */ (null)), null);
  assert.doesNotMatch(typograph("Weekly plan at 8 am"), /[^\s\w]/u, "English words are left alone (only the number rule applies)");
});

test("L8 typographDict / tx: RU strings and function results are typographed; EN and keys untouched; shape kept", () => {
  const T = { EN: { a: "to do in a day", f: (n) => `${n} of 7` }, RU: { a: "Сделать в срок", f: (n) => `${n} из 7`, list: ["в доме", "на улице"], nested: { k: "по делу" } } };
  const ru = tx(T, "RU");
  assert.equal(ru.a, `Сделать в${NB}срок`); assert.equal(ru.f(3), `3${NB}из${NB}7`);
  assert.deepEqual(ru.list, [`в${NB}доме`, `на${NB}улице`]); assert.equal(ru.nested.k, `по${NB}делу`);
  assert.equal(tx(T, "EN"), T.EN, "EN is the dictionary itself");
  assert.equal(tx(T, "RU"), ru, "RU typographed once per dictionary");
  assert.deepEqual(Object.keys(typographDict(T.RU)), Object.keys(T.RU));
});

test("L8 wiring: every Family OS screen reads its words through tx(); principle and task titles are typographed for display", () => {
  for (const f of ["FamilyOs.tsx", "FamilyBoard.tsx", "FamilyCouncil.tsx", "FamilyCalendar.tsx", "FamilyKodeks.tsx", "FamilyOsPerson.tsx", "FamilyOsAccess.tsx", "FamilyRules.tsx", "FamilyPrefs.tsx", "FamilyRoutines.tsx", "FamilyPersonExtras.tsx", "FamilyHealth.tsx", "FamilyBody.tsx", "FamilyAdoption.tsx", "FamilyPasskeys.tsx", "FamilyWeek.tsx", "FamilyOsDown.tsx", "FamilyToday.tsx", "FamilyOsShell.tsx", "FamilyInvite.tsx", "FamilyOnboarding.tsx"]) {
    assert.match(comp(f), /tx\(T, lang\)|tx\(OS_DOWN_T, lang\)/, `${f} reads RU copy through the typographer`);
  }
  const k = comp("FamilyKodeks.tsx");
  assert.match(k, /\{ty\(principle\.principle, lang\)\}/); assert.match(k, /\{ty\(p\.principle, lang\)\}/);
  assert.match(k, /defaultValue=\{p\.principle\}/, "the edit form keeps the raw wording");
  assert.match(comp("FamilyBoard.tsx"), /\{ty\(task\.title, c\.lang\)\}/);
});

test("M7: every OS page renders one shared «не отвечает» state (never notFound) inside the family layout (D11)", () => {
  const pages = { "os/page.tsx": "today", "os/people/page.tsx": "people", "os/board/page.tsx": "board", "os/council/page.tsx": "council", "os/calendar/page.tsx": "calendar", "os/kodeks/page.tsx": "kodeks", "os/week/page.tsx": "week", "os/people/[id]/page.tsx": "person", "os/access/page.tsx": "access" };
  for (const [p, key] of Object.entries(pages)) {
    const s = src(`app/[lang]/family/${p}`);
    assert.match(s, new RegExp(`if \\(state\\.status !== "ok"\\)[^\\n]*<FamilyOsDown lang=\\{L\\} status=\\{state\\.status\\} title=\\{OS_DOWN_TITLE\\.${key}\\[L\\]\\} />`), p);
    assert.doesNotMatch(s, /state\.status !== "ok" \|\|/, `${p}: a silent service is not a 404`);
  }
  const d = comp("FamilyOsDown.tsx");
  assert.match(d, /error: "Раздел «Семья» сейчас не отвечает\. Попробуй через минуту\."/, "the Today/People text, reused");
  assert.match(d, /<h1 id="os-down-h" className=\{H1\}>\{title\}<\/h1>/, "L6: the state has an H1");
  // bus 171: the Family OS shell (os/layout.tsx) is the family layout around it — with «Выйти» and the sections
  // from osDownNav while the service is silent.
  assert.doesNotMatch(d, /<FamilyChrome /);
  const lay = src("app/[lang]/family/os/layout.tsx");
  assert.match(lay, /if \(state\.status !== "ok"\) \{[\s\S]*?const down = osDownNav\(session\.cpifSubjectId\);/);
  assert.match(comp("FamilyOsShell.tsx"), /action="\/api\/family-auth\/logout"/, "«Выйти» is in the shell");
  const c = comp("FamilyChrome.tsx");
  assert.match(c, /navItems=\{familyNav\(lang\)\}/, "«Выйти» is in the family header");
  assert.match(c, /<FamilySubNav lang=\{lang\} admin=\{nav\.admin\} editor=\{nav\.editor\} os=\{nav\.os\} member=\{nav\.member \?\? true\} child=\{nav\.child \?\? false\} \/>/);
  const n = src("app/lib/family-os-down.ts");
  assert.match(n, /return \{ admin: isFamilyAdmin\(subject\), editor: familyRole\(subject\) === "editor", os: true \};/);
  assert.doesNotMatch(comp("FamilyOs.tsx"), /не отвечает|not answering/, "one copy of the text");
});

test("D11: the family 404 keeps the family layout for a signed-in family viewer; the site 404 is unchanged", () => {
  const nf = src("app/[lang]/family/not-found.tsx");
  assert.match(nf, /if \(decision === "allow" && session\)/, "only an approved session gets the family chrome");
  assert.match(nf, /<NotFoundView lang=\{lang\} refCode=\{ref\} family=\{family\} \/>/);
  const v = comp("NotFoundView.tsx");
  assert.match(v, /if \(family\) return \(\s*<FamilyChrome /);
  assert.match(v, /<SiteHeader /, "the global 404 still has the plain header");
  assert.match(src("app/global-not-found.tsx"), /<NotFoundView lang=\{lang\} \/>/);
});

test("L6: an H1 above the one line for the owner (Доска/Совет/Календарь) and an outsider (Сегодня/Люди)", () => {
  assert.match(comp("FamilyBoard.tsx"), /\{!board \? <div className="max-w-4xl"><h1 className=\{H1\}>\{t\.title\}<\/h1><p role="status"/);
  assert.match(comp("FamilyCouncil.tsx"), /\{!council \? <><h1 className=\{H1\}>\{t\.title\}<\/h1><p role="status"/);
  assert.match(comp("FamilyCalendar.tsx"), /\{!cal \? <><h1 className=\{H1\}>\{t\.title\}<\/h1><p role="status"/);
  assert.match(comp("FamilyOs.tsx"), /<h1 id="os-outsider-h" className=\{H1\}>\{t\.people\}<\/h1>/);
  assert.match(src("app/[lang]/family/os/page.tsx"), /<h1 id="os-outsider-h"[^>]*>\{title\}<\/h1>/, "«Сегодня» for an outsider (bus 171)");
  assert.match(src("app/[lang]/family/error.tsx"), /<h1 className=\{H1\}>/, "the error page has its H1");
});

test("L6 heading order + D7: the board has one people list; H2 strip → H3 name, no accordion; tasks live in the Kanban (bus 172 P2)", () => {
  const b = comp("FamilyBoard.tsx");
  assert.doesNotMatch(b, /<details|data-accordion/, "the per-person accordion list is gone");
  const strip = b.slice(b.indexOf("function Strip("), b.indexOf("/**\n * The Kanban"));
  const order = ["<h2 id=\"strip-h\"", "<h3 className={`${OS_H3}"].map((x) => strip.indexOf(x));
  assert.ok(order.every((i) => i > 0), "strip H2, card H3");
  assert.deepEqual([...order].sort((a, c) => a - c), order);
  // bus 172 P2: the tasks are in the four Kanban columns at every width — the strip is a summary, never a second task list
  assert.doesNotMatch(strip, /<KCard |<Card |data-strip-toggle/, "no second per-person task list");
  assert.match(b, /<section aria-label=\{t\.kanbanAria\} className="mt-6">/);
  assert.doesNotMatch(b, /function Lanes\(|function ListView\(/, "one task layout");
});

test("D2: one H2 style for every section heading, one H3 style for block titles", () => {
  const files = readdirSync(new URL("../app/components", import.meta.url)).filter((f) => /^Family(Os|Board|Council|Calendar|Kodeks|OsPerson|OsAccess|Rules|Prefs|Routines|PersonExtras|Health|Body|Adoption|Passkeys)\b.*\.tsx$/.test(f));
  assert.ok(files.length >= 14);
  let seen = 0;
  for (const f of files) {
    const s = comp(f);
    const cls = (tag) => new RegExp(`<${tag}\\b[^>]*?className=(\\{(?:\`[^\`]*\`|[^}])*\\}|"[^"]*")`, "g");
    for (const m of s.matchAll(cls("h2"))) {
      seen++;
      if (/id="drawer-h"/.test(m[0])) continue; // the task drawer's dialog title
      if (/text-\[15px\] font-medium text-\[var\(--text-secondary\)\]/.test(m[1]) && f === "FamilyCalendar.tsx") continue; // day labels in the calendar list (docs/family-os-design.md)
      // bus 159: OS_H2 only — the site H2 (burgundy) is no longer a section heading on an OS page.
      // bus 172 P3: or a mockup v5 card's title (CARD_H — the same small ink title as the cards on «Сегодня», bus 171).
      assert.match(m[1], /^\{(OS_H2|`\$\{OS_H2\}[^`]*`|headingClass|CARD_H)\}$/, `${f}: ${m[0].slice(0, 90)}`);
    }
    for (const m of s.matchAll(cls("h3"))) assert.match(m[1], /OS_H3|headingClass|H3\b/, `${f}: ${m[0].slice(0, 90)}`);
    assert.doesNotMatch(s, /import \{[^}]*\bH2\b[^}]*\} from "\.\.\/lib\/typeScale"/, `${f}: no site H2 on an OS page`);
  }
  assert.ok(seen >= 30, `the scan saw the section headings (${seen})`);
});

test("bus 159 #1: section H2 is ink, ~22 px, below the burgundy H1; H3 sits below H2; HC keeps the ink", () => {
  const ui = src("app/lib/family-ui.ts");
  const h2 = ui.match(/export const OS_H2 = "([^"]+)";/)?.[1] ?? "", h3 = ui.match(/export const OS_H3 = "([^"]+)";/)?.[1] ?? "";
  assert.match(h2, /font-serif/); assert.match(h2, /text-\[var\(--foreground\)\]/); assert.doesNotMatch(h2, /--accent/, "maroon is for the page title and primary buttons");
  assert.match(h3, /text-\[var\(--foreground\)\]/); assert.doesNotMatch(h3, /--accent/);
  const px = (s) => [...s.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
  assert.deepEqual(px(h2), [22, 24]); assert.ok(Math.max(...px(h3)) < Math.min(...px(h2)), "H3 smaller than H2 at every width");
  // contrast: --foreground on --background in light, dark and both high-contrast sets (text ≥ 4.5:1; it is far above)
  const css = src("app/globals.css");
  assert.ok((css.match(/--foreground:/g) ?? []).length >= 4, "every theme defines the ink");
});

test("bus 159 #2: «Принцип недели» on Today is a card label, not an H2; Today's first H2 is a section", () => {
  const k = comp("FamilyKodeks.tsx");
  const today = k.slice(k.indexOf("export function TodayPrinciple"), k.indexOf("export function", k.indexOf("export function TodayPrinciple") + 10));
  assert.doesNotMatch(today, /<h[1-6]\b/, "no heading inside the principle card");
  assert.match(today, /<p id="principle-h" className=\{`\$\{CARD_LABEL\} flex items-center gap-1\.5`\}><KodeksIcon size=\{16\} \/>\{t\.week\}<\/p>/);
  assert.match(today, /<section aria-labelledby="principle-h"/, "the region keeps its name");
  assert.match(src("app/lib/family-ui.ts"), /export const CARD_LABEL = "text-\[14px\] font-medium text-\[var\(--muted\)\]";/);
});

test("bus 159 #3: gold rule = goals and plans — sprint goals, the goal card, WOOP; recorded in the design notes", () => {
  const ui = src("app/lib/family-ui.ts");
  assert.match(ui, /RULE_GOALS = "border-l-2 border-\[var\(--pillar-growth\)\] pl-4"/);
  const b = comp("FamilyBoard.tsx");
  assert.equal((b.match(/data-goals-rule="" className=\{`mt-\d divide-y divide-\[var\(--border\)\] \$\{RULE_GOALS\}`\}/g) ?? []).length, 2, "board sprint panel + council sprint goals");
  assert.match(comp("FamilyWeek.tsx"), /aria-labelledby="w-goals" data-goals-rule="" className="border-l-2 border-\[var\(--pillar-growth\)\] pl-3/, "the Week sheet's sprint goals");
  const x = comp("FamilyPersonExtras.tsx");
  assert.match(x, /<li data-goal=\{g\.status\} className="py-4">\s*<div className=\{RULE_GOALS\}>/, "each goal card");
  assert.match(x, /<WoopFields t=\{t\} prefix="woop" className="sm:col-span-2" \/>/, "the add form's WOOP keeps its own rule (ruled defaults to true)");
  assert.match(x, /values=\{w\} ruled=\{false\} \/>/, "inside a card: no second rule");
  assert.doesNotMatch(x, /border-\[var\(--pillar-growth\)\]/, "one gold rule class: RULE_GOALS");
  const notes = src("docs/family-os-design.md");
  assert.match(notes, /gold \(`--pillar-growth`, `RULE_GOALS`\) — \*\*goals and plans\*\*/);
  assert.doesNotMatch(notes, /open question for the next review/);
});

test("bus 159 #4: WOOP reads as label/value pairs — <dl>, small muted <dt>, body-text <dd>", () => {
  const x = comp("FamilyPersonExtras.tsx");
  const w = x.slice(x.indexOf("function GoalWoop"), x.indexOf("function GoalRow"));
  assert.match(w, /<dl className="grid gap-3">/);
  assert.match(w, /<div key=\{k\} data-woop-pair=\{k\}><dt className=\{CARD_LABEL\}>\{t\.woopKeys\[k\]\}<\/dt><dd className="mt-0\.5 text-\[16px\] leading-snug text-\[var\(--foreground\)\]">\{w\[k\]\}<\/dd><\/div>/);
  assert.doesNotMatch(w, /className="contents"/, "a real pair wrapper, not display: contents");
});

test("D3: one button scale — ≥ 44 px, primary filled for a form's submit, secondary outline elsewhere", () => {
  const ui = src("app/lib/family-ui.ts");
  assert.match(ui, /const BTN = "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-\[15px\] font-medium/);
  assert.match(ui, /BTN_PRIMARY = `\$\{BTN\} bg-\[var\(--accent\)\]/); assert.match(ui, /BTN_SECONDARY = `\$\{BTN\} border border-\[var\(--border\)\]/);
  const body = comp("FamilyBody.tsx");
  assert.match(body, /<button type="submit" data-body-save="" className=\{BTN_PRIMARY\}>/, "«Сохранить» in «Вес и питание» is primary, as in «Письма и паузы»");
  assert.match(body, /<button type="submit" data-body-goal-save="" className=\{BTN_PRIMARY\}>/);
  assert.match(body, /data-body-goal-edit="" onClick=\{\(\) => setEditGoal\(true\)\} className=\{btn\}/);
  assert.match(comp("FamilyPersonExtras.tsx"), /<button type="button" className=\{btn\} onClick=\{make\}>/, "«Создать ссылку» is an action, not a submit");
  assert.match(comp("FamilyPasskeys.tsx"), /data-passkey-add="" onClick=\{add\} disabled=\{busy\} className=\{btn\}/);
  assert.match(comp("FamilyHealth.tsx"), /data-evening-save="" className=\{BTN_PRIMARY\}/);
  for (const f of ["FamilyBoard.tsx", "FamilyCouncil.tsx", "FamilyCalendar.tsx", "FamilyPrefs.tsx", "FamilyPersonExtras.tsx", "FamilyOsAccess.tsx", "FamilyRules.tsx", "FamilyKodeks.tsx", "FamilyHealth.tsx", "FamilyBody.tsx", "FamilyPasskeys.tsx", "FamilyRoutines.tsx", "FamilyOsPerson.tsx", "FamilyAdoption.tsx"]) {
    assert.doesNotMatch(comp(f), /const (btn|primary) = "/, `${f}: no local button style`);
  }
});

test("D4: destructive actions are danger-styled, set apart, and still ask first; «Выключить» is a real button", () => {
  assert.match(src("app/lib/family-ui.ts"), /BTN_DANGER = `\$\{BTN\} border border-\[var\(--destructive\)\] bg-\[var\(--background\)\] text-\[var\(--destructive\)\]/, "outline + destructive text, no fill");
  const body = comp("FamilyBody.tsx");
  assert.match(body, /<div data-body-danger="" className=\{DANGER_ROW\}>/);
  assert.match(body, /data-body-delete="" onClick=\{\(\) => \{ setMsg\(""\); setAsk\(true\); \}\} className=\{BTN_DANGER\}/, "delete only opens the confirm");
  assert.match(body, /data-body-delete-yes="" onClick=\{wipe\} className=\{BTN_DANGER\}/);
  assert.ok(body.indexOf("data-body-export") < body.indexOf("data-body-danger"), "export sits above, in the safe row");
  assert.match(body, /\{!ask && <button type="button" data-body-off="" onClick=\{\(\) => toggle\(false\)\} className=\{btn\}>/, "«Выключить» is a secondary button");
  const a = comp("FamilyOsAccess.tsx");
  assert.match(a, /data-grant-revoke="" className=\{BTN_DANGER\} onClick=\{\(\) => setAsk\(true\)\}/);
  assert.match(a, /data-grant-revoke-yes="" className=\{BTN_DANGER\} onClick=\{\(\) => run\(send\("DELETE", `grants\/\$\{g\.id\}`\)\)\}/);
  const e = comp("FamilyAdoption.tsx");
  assert.match(e, /<div data-end-all="" className=\{DANGER_ROW\}>/);
  assert.match(e, /data-end-all-ask="" onClick=\{\(\) => \{ setMsg\(""\); setAsk\(true\); \}\} className=\{BTN_DANGER\}/);
  assert.match(e, /data-end-all-yes="" onClick=\{go\} className=\{BTN_DANGER\}/);
  const k = comp("FamilyPasskeys.tsx");
  assert.match(k, /data-end-sessions-ask="" onClick=\{\(\) => \{ setMsg\(""\); setAsk\(true\); \}\} className=\{BTN_DANGER\}/);
  assert.match(k, /data-end-sessions-yes="" onClick=\{go\} className=\{BTN_DANGER\}/);
  assert.match(k, /data-passkey-revoke="" onClick=\{\(\) => setMode\("confirm"\)\} className=\{`\$\{BTN_DANGER\} sm:ml-auto`\}/);
  assert.match(k, /data-passkey-confirm="" onClick=\{\(\) => act\(post\(`\/api\/family-os\/passkeys\/\$\{k\.id\}\/revoke`\)\)\} className=\{BTN_DANGER\}/);
  // the theme sets --destructive in every mode (light, dark, both high-contrast sets) and in the Family OS light and dark
  // palettes (bus 171; high contrast keeps the site's AAA value there)
  assert.equal((src("app/globals.css").match(/--destructive:/g) ?? []).length, 6);
});

test("D1: «Правила» — one 3-state radio group per rule mapped onto enabled/dry_run; «Включено» asks first", () => {
  assert.equal(ruleMode({ enabled: false, dry_run: true }), "off");
  assert.equal(ruleMode({ enabled: false, dry_run: false }), "off", "off wins: a contradictory pair shows as one state");
  assert.equal(ruleMode({ enabled: true, dry_run: true }), "dry");
  assert.equal(ruleMode({ enabled: true, dry_run: false }), "send");
  assert.deepEqual(ruleBody("off"), { enabled: false, dry_run: true });
  assert.deepEqual(ruleBody("dry"), { enabled: true, dry_run: true });
  assert.deepEqual(ruleBody("send"), { enabled: true, dry_run: false });
  for (const m of ["off", "dry", "send"]) assert.equal(ruleMode(ruleBody(m)), m, "round trip");
  const r = comp("FamilyRules.tsx");
  assert.doesNotMatch(r, /type="checkbox"/, "no more two checkboxes");
  assert.match(r, /<input type="radio" name=\{group\} value=\{k\} className="sr-only" checked=\{mode === k\} onChange=\{\(\) => choose\(k\)\} \/>/, "native radios: arrow keys, one tab stop");
  assert.match(r, /<legend className="sr-only">\{t\.modeLabel\}: \{name\}<\/legend>/);
  assert.match(r, /mode: \{ off: "Выкл", dry: "Пробный", send: "Включено" \}/);
  assert.match(r, /chip: \{ off: "Выключено", dry: "Только запись", send: "Письма уходят" \}/);
  assert.match(r, /<span data-rule-state=\{mode\}/, "the badge mirrors the one state");
  assert.match(r, /if \(next === "send" && !confirmed\) \{ setAsk\(true\); return; \}/);
  assert.match(r, /send\(r\.id, ruleBody\(next\)\)/);
  assert.match(r, /has-\[:focus-visible\]:outline/, "visible focus on the segment");
  const svc = src("family-os/server.mjs");
  assert.match(svc, /b\.enabled !== undefined && typeof b\.enabled !== "boolean"\) \|\| \(b\.dry_run !== undefined && typeof b\.dry_run !== "boolean"\)/, "the service takes both flags");
});

test("D5: sub-nav at 390 px — edge fade by mask, scroll-snap, active tab one fade-width in", () => {
  const n = comp("FamilySubNav.tsx");
  assert.match(n, /snap-x snap-proximity scroll-px-8/); assert.match(n, /<li key=\{x\.id\} className="shrink-0 snap-start">/);
  assert.match(n, /const FADE = 32;/, "scroll-px-8 = 32 px = FADE");
  assert.match(n, /maskImage: `linear-gradient\(to right/, "a mask, so light, dark and high contrast behave the same");
  assert.match(n, /ul\.scrollLeft = Math\.max\(0, ul\.scrollLeft \+ \(r\.left - u\.left\) - FADE\);/);
});

test("D6: the person page has the same index as «Доступы»; not pills; sticky beside the reading column ≥ 1280 px", () => {
  const j = comp("FamilyJumpNav.tsx");
  assert.doesNotMatch(j, /rounded-full/); assert.match(j, /rounded-md/);
  assert.match(j, /xl:sticky xl:top-28/);
  assert.match(comp("FamilyOsAccess.tsx"), /<FamilyJumpNav kind="access" label=\{t\.jump\}/);
  const p = comp("FamilyOsPerson.tsx");
  assert.match(p, /<FamilyJumpNav kind="person" label=\{t\.jump\} items=\{jump\} aside \/>/);
  assert.match(p, /xl:grid-cols-\[minmax\(0,56rem\)_14rem\]/); assert.match(p, /min-w-0 max-w-4xl xl:col-start-1/, "the reading width stays");
  for (const id of ["routines", "documents", "guardians"]) assert.match(p, new RegExp(`<section id="${id}" aria-labelledby`));
  assert.match(comp("FamilyPersonExtras.tsx"), /<section id="notes" aria-labelledby="notes-h"/);
});

test("D8: a left rule means values (grey), private (червлень) or goals (gold, bus 159); documents on Today wear the private rule", () => {
  const ui = src("app/lib/family-ui.ts");
  assert.match(ui, /RULE_VALUES = "border-l-2 border-\[var\(--pillar-kodeks\)\] pl-4"/);
  assert.match(ui, /RULE_PRIVATE = "border-l-2 border-\[var\(--pillar-health\)\] pl-4"/);
  assert.match(comp("FamilyOs.tsx"), /data-reminders=\{id\} className=\{`mt-10 \$\{RULE_PRIVATE\}`\}/);
  const k = comp("FamilyKodeks.tsx");
  assert.match(k, /data-principle-week=\{principle\.index\} className=\{`mt-8 flex gap-4 \$\{RULE_VALUES\}`\}/);
  assert.match(k, /data-recognition="" className=\{`mt-10 \$\{RULE_VALUES\}`\}/);
  assert.match(comp("FamilyHealth.tsx"), /border-l-2 border-\[var\(--pillar-health\)\]/);
  const notes = src("docs/family-os-design.md");
  assert.match(notes, /left rule/i); assert.match(notes, /values and principles/); assert.match(notes, /private and sensitive/);
});

test("D9: the weight chart labels its first and last points — value + «кг», neutral, in the text colour", () => {
  const b = comp("FamilyBody.tsx");
  assert.match(b, /data-body-trend-label=\{n === 0 \? "first" : "last"\}/);
  assert.match(b, /fontSize="15" fill="var\(--foreground\)"/, "≥ 14 px at phone width; readable in dark and high contrast");
  assert.match(b, /label=\{\(v\) => `\$\{dec\(v\)\} \$\{t\.kg\}`\}/, "just the value: no arrows, no signs, no «минус»");
});

test("D10: the disabled «Вечерняя отметка» says why and how to switch it on", () => {
  const p = comp("FamilyPrefs.tsx");
  assert.match(p, /disabled=\{!p\.email_on\} aria-describedby=\{p\.email_on \? undefined : `evening-off-\$\{personId\}`\}/);
  assert.match(p, /\{!p\.email_on && <p id=\{`evening-off-\$\{personId\}`\} data-evening-why=""/);
  assert.match(p, /eveningWhy: "Выключена, пока выключены письма семьи\. Отметь «Присылать письма семьи» выше, чтобы её включить\."/);
});

test("L10: the editor panel's jump links are at least 44 × 44", () => {
  const a = comp("FamilyAdmin.tsx");
  assert.match(a, /<a href="#people-h" className=\{`inline-flex min-h-11 min-w-11 items-center justify-center/);
  assert.match(a, /<a href="#entries-h" className=\{`inline-flex min-h-11 min-w-11 items-center justify-center/);
});
