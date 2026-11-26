# Family OS — design notes

The rules every Family OS page follows (`app/[lang]/family/os/**`, `app/components/Family*.tsx`). Baseline: the
approved council mockup — formal, serif titles, radius 8 / 6, no pills, no tinted surfaces. Source of the rules:
QA-156, the bus 157b design review (D1–D11) and R0's decisions of 25.11 (bus 159). The class strings live in
`app/lib/family-ui.ts`; tests in `tests/family-ui.test.mjs`.

## Colour of type (R0 25.11)
- Burgundy (`--accent`) is for the page title only — «Привет, …», a person's name, the page H1 — and for primary
  buttons. Section headings and everything below them are ink.

## Headings (D2, R0 25.11)
- A section of a page is an **H2** — `OS_H2` (serif, ink, 22 px → 24 px from `lg`). One style on every OS page.
- A titled block inside a section is an **H3** — `OS_H3` (serif, ink, 18 px → 19 px). Card titles too.
- Below that, small uppercase column labels (the board) are H4.
- A card's own label is not a heading: «Принцип недели» on Today and the WOOP keys are `CARD_LABEL` (14 px, muted).
- Not section headings, on purpose: the task drawer's dialog title, the board's «Нужно твоё решение» banner (a
  line), the day labels of the calendar list, and the A4 «Неделя семьи» sheet (its own print scale).
- Every page has exactly one H1, also when it shows only one line (not a member, «не отвечает»).

## Buttons (D3, D4)
- One size: at least 44 px tall, 15 px text, 16 px side padding.
- **Primary** (`BTN_PRIMARY`, filled): a form's submit, or the «yes» of a non-destructive confirm. One per form.
- **Secondary** (`BTN_SECONDARY`, outline): every other action. No text-link buttons.
- **Danger** (`BTN_DANGER`, destructive text + outline, never a fill): deletes or cuts something off — «Удалить все
  записи», «Отозвать», «Завершить сеансы», «Завершить все сеансы». Always behind a confirm step; in the confirm the
  safe choice comes first and has the focus. A danger action stands apart from safe ones (`DANGER_ROW`: its own
  row under a hairline, or pushed to the far end of the row).

## Containers (D8)
- A **left rule** means one of three things only:
  - grey (`--pillar-kodeks`, `RULE_VALUES`) — **values and principles**: «Принцип недели», «Признание», recognitions;
  - червлень (`--pillar-health`, `RULE_PRIVATE`) — **private and sensitive**: «Здоровье», «Вес и питание», documents;
  - gold (`--pillar-growth`, `RULE_GOALS`) — **goals and plans** (R0 25.11): sprint goals (board, council, the
    «Неделя семьи» sheet), each goal card on a person's page, and WOOP. Inside a goal card the WOOP plan sits under
    the card's rule (no second rule); in the «add a goal» form the WOOP fieldset has its own.
- When a goal sits in a private section (the weight goal in «Вес и питание»), the private rule wins.
- Items are plain lists (routines, documents rows) or cards (tasks). A card is a hairline border, radius 8, no fill.
- WOOP shows label/value pairs as a `<dl>`: the key is a small muted label, the answer is body text.

## States
- Family OS silent: one shared «Раздел «Семья» сейчас не отвечает. Попробуй через минуту.» (`FamilyOsDown`) on every
  OS page, with the page's own H1, inside the family layout — never a 404.
- The family 404 keeps the family layout (sub-nav + «Выйти») for a signed-in family viewer.
- A disabled control carries a line saying why it is off and how to turn it on.

## Navigation
- Sub-nav: one line; on a phone it scrolls with an edge fade (a mask, so all themes match) and snaps to tab starts;
  the current tab sits one fade-width in from the edge.
- Long pages («Доступы», a person's page) open with an «На этой странице» index of bordered links; on a person's
  page it stands as a sticky column beside the reading column from 1280 px.

## Russian typography (L8)
- RU interface copy goes through `tx(T, lang)` (`app/lib/typograph.mjs`): a no-break space after short
  prepositions, conjunctions and particles, before «же/ли/бы», between a number and its unit, and before a dash.
- Text people type is shown as typed, except task titles and the Кодекс wording, which are typographed for display
  only (spaces become no-break spaces; nothing else changes).

## Redesign v5 (bus 171, R0 approved the mockup 26.11.2026) — phase 1 of 6
Phase 1 is in: tokens, the app shell, «Сегодня». Pages restyled in later phases keep the rules above until their phase.
- **Tokens** live in `app/globals.css` under `[data-fos]` (light, `.dark`, high contrast). The existing names
  (`--accent`, `--background`, `--muted`, …) are re-pointed inside Family OS; the extra roles are `--fos-*` (page,
  panels, control edge, the brighter green, amber, blue, plum, shadows, the day banner). Radii 14 / 16, headings in
  `ui-serif, "New York", Georgia` (600), body in the site sans. AA is tested in `tests/family-os-shell.test.mjs`; high
  contrast keeps its AAA tokens. Dark: dark text on green fills (white on the mockup's green is 3.4:1).
- **Shell** (`FamilyOsShell`, rendered once by `app/[lang]/family/os/layout.tsx`): 248 px sidebar on desktop, top bar +
  bottom tab bar below 900 px, ⌘K = search over the sections. Sections and names come from
  `app/lib/family-os-shell.mjs`; addresses unchanged, no technical names (no Кодекс/Совет/Доска/Неделя/Access on screen).
  A section shows only when its page exists for the viewer. Pages no longer draw a header, sub-nav or footer.
- **«Сегодня»** (`FamilyToday`, model in `app/lib/family-today.mjs`): built from existing reads only; a child's model has
  no adult blocks and the page does not fetch the family board for a child. Card titles inside «Сегодня» are small sans
  H2s (the mockup), not `OS_H2`.
