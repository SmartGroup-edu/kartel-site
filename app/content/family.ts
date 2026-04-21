export type Generation = "elder" | "current" | "next";

export interface FamilyMember {
  name: string;
  description: string;
  generation: Generation;
}

export interface GenerationGroup {
  key: Generation;
  title: string;
  members: FamilyMember[];
}

export const familyContent = {
  EN: {
    title: "The Kartel Family",
    intro:
      "The Kartel family is presented here as a living line of continuity: a family joined by name, memory, responsibility, and the conscious preservation of legacy.",
    homeLabel: "Home",
    familyLabel: "Family",
    footerMotto: "Virtus et Potestas",
    footerCopy: "The Kartel Family. London.",
    generationLabels: {
      elder: "Elders",
      current: "Present Generation",
      next: "Next Generation",
    } as Record<Generation, string>,
    people: [
      { name: "Igor Gor Kartel", description: "Family representative in London.", generation: "current" as Generation },
      { name: "Diana Kartel", description: "Member of the Kartel family.", generation: "current" as Generation },
      { name: "Dominika Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Arina Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Igor Kaid Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Feliks Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Piotr Kartel", description: "Representative of the older generation of the Kartel family.", generation: "elder" as Generation },
      { name: "Valentina Kartel", description: "Representative of the older generation of the Kartel family.", generation: "elder" as Generation },
    ],
  },
  RU: {
    title: "Семья Картель",
    intro:
      "Семья Картель — это линия преемственности, объединённая именем, памятью и наследием.",
    homeLabel: "Главная",
    familyLabel: "Семья",
    footerMotto: "Virtus et Potestas",
    footerCopy: "Семья Картель. Лондон.",
    generationLabels: {
      elder: "Старшее поколение",
      current: "Настоящее поколение",
      next: "Новое поколение",
    } as Record<Generation, string>,
    people: [
      { name: "Игорь Гор Картель", description: "Представитель семьи в Лондоне.", generation: "current" as Generation },
      { name: "Диана Картель", description: "Член семьи Картель.", generation: "current" as Generation },
      { name: "Доминика Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Арина Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Игорь Каид Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Феликс Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Петр Картель", description: "Представитель старшего поколения семьи Картель.", generation: "elder" as Generation },
      { name: "Валентина Картель", description: "Представительница старшего поколения семьи Картель.", generation: "elder" as Generation },
    ],
  },
};

export function groupByGeneration(people: FamilyMember[], labels: Record<Generation, string>): GenerationGroup[] {
  const order: Generation[] = ["elder", "current", "next"];
  return order
    .map((gen) => ({
      key: gen,
      title: labels[gen],
      members: people.filter((p) => p.generation === gen),
    }))
    .filter((g) => g.members.length > 0);
}
