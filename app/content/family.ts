// Types and pure helpers only. The family's names live in ./family-private.ts (server-only):
// client components receive them as props from the gated pages, so they never ship in public JS.
export type Generation = "root" | "founder" | "ancestor" | "grandparent" | "elder" | "current" | "next";

export interface FamilyMember {
  name: string;
  description: string;
  generation: Generation;
}

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
}

export interface GenerationGroup {
  key: Generation;
  title: string;
  members: FamilyMember[];
}

export function groupByGeneration(people: FamilyMember[], labels: Record<Generation, string>): GenerationGroup[] {
  const order: Generation[] = ["root", "founder", "ancestor", "grandparent", "elder", "current", "next"];
  return order
    .map((gen) => ({
      key: gen,
      title: labels[gen],
      members: people.filter((p) => p.generation === gen),
    }))
    .filter((g) => g.members.length > 0);
}
