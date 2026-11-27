/**
 * Family board avatars (bus 84 §10, bus 85 M2). Pure; tested in tests/family-avatars.test.mjs.
 * Colour: fixed per person id (a hash, so adding someone never recolours the rest) from 8 colours that all
 * keep white text ≥ 5.2:1. Letters: the first letter of the display name in the UI language; two letters
 * only when another member shares that first letter — then the first pair that is unique in the family.
 */
export const AVATAR_COLOURS = ["#7b1e2d", "#8a4b2a", "#3b4a7a", "#5d4a7a", "#8a5a00", "#5a4636", "#6b3a5e", "#6b5530"];

const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const avatarColour = (id) => AVATAR_COLOURS[hash(id) % AVATAR_COLOURS.length];

/** @param {{ id: string, name: string }[]} people  → Map(id → { text, bg }) */
export function avatars(people) {
  const up = (s) => s.toLocaleUpperCase("ru");
  const words = (p) => p.name.trim().split(/\s+/).filter(Boolean);
  const first = (p) => up(p.name.trim().charAt(0) || "?");
  const out = new Map(), taken = new Set();
  // single letters where nobody shares them
  for (const p of people) if (!people.some((o) => o.id !== p.id && first(o) === first(p))) { out.set(p.id, first(p)); taken.add(first(p)); }
  // shared first letter: the first unique pair, in a stable order (by id)
  for (const p of [...people].filter((x) => !out.has(x.id)).sort((a, b) => a.id.localeCompare(b.id))) {
    const w = words(p), last = w.at(-1) ?? "";
    const cands = [w[0]?.[0] + (w[1]?.[0] ?? ""), w[0]?.[0] + last[0], (w[1]?.[0] ?? "") + last[0], ...w.slice(1).map((x) => w[0][0] + x[1]), p.name.trim().slice(0, 2)]
      .filter((c) => c && c.length === 2).map((c) => up(c[0]) + c[1].toLocaleLowerCase("ru"));
    const pick = cands.find((c) => !taken.has(c)) ?? cands[0] ?? first(p);
    out.set(p.id, pick); taken.add(pick);
  }
  return new Map(people.map((p) => [p.id, { text: out.get(p.id), bg: avatarColour(p.id) }]));
}
