// Types and pure helpers only. The family's names live in ./family-private.ts (server-only):
// client components receive them as props from the gated pages, so they never ship in public JS.
export type Generation = "root" | "founder" | "ancestor" | "grandparent" | "elder" | "current" | "next";

export interface TreeNode {
  id: string;
  nameEN: string;
  nameRU: string;
  roleEN: string;
  roleRU: string;
  generation: "root" | "founder" | "ancestor" | "grandparent" | "elder" | "current" | "next";
}

export interface TimelineEvent {
  id: string;
  yearEN: string;
  yearRU: string;
  titleEN: string;
  titleRU: string;
  descEN: string;
  descRU: string;
  /** A memorial for someone who has died, shown as its own block under the entry (cycle 12). */
  memorial?: { en: Memorial; ru: Memorial };
}

/** Rendered as "<name>: <born date>, <place> — <died date>, <place>." then burial, then words. */
export interface Memorial {
  name: string;
  born: [date: string, place: string];
  died: [date: string, place: string];
  burial: string;
  words: string;
}
