export type Generation = "root" | "founder" | "ancestor" | "grandparent" | "elder" | "current" | "next";

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
      root: "Roots",
      founder: "Founders",
      ancestor: "Ancestors",
      grandparent: "Grandparents",
      elder: "Elders",
      current: "Present Generation",
      next: "Next Generation",
    } as Record<Generation, string>,
    people: [
      { name: "Piotr Kartel", description: "The earliest known ancestor of the Kartel family.", generation: "root" as Generation },
      { name: "Andrey Petrovich Kartel", description: "Founder of the Kartel lineage.", generation: "founder" as Generation },
      { name: "Poloneya Grigorievna Kartel", description: "Founder of the Kartel lineage.", generation: "founder" as Generation },
      { name: "Aleksandr Andreyevich Kartel", description: "Ancestor of the Kartel family.", generation: "ancestor" as Generation },
      { name: "Lyubov Petrovna Kartel (née Kirey)", description: "Ancestor of the Kartel family.", generation: "ancestor" as Generation },
      { name: "Nikolai Aleksandrovich Kartel", description: "Grandparent of the Kartel family.", generation: "grandparent" as Generation },
      { name: "Valentina Aleksandrovna Kartel (née Mikhal)", description: "Grandparent of the Kartel family.", generation: "grandparent" as Generation },
      { name: "Piotr Nikolaevich Kartel", description: "Representative of the elder generation of the Kartel family. 8 February 1955, Belarus — 3 January 2026, London. Laid to rest at the City of London Cemetery. In cherished memory.", generation: "elder" as Generation },
      { name: "Valentina Cheslavovna Kartel (née Chizhevskaya)", description: "Representative of the older generation of the Kartel family.", generation: "elder" as Generation },
      { name: "Igor Gor Petrovich Kartel", description: "Family representative in London.", generation: "current" as Generation },
      { name: "Diana Zenonovna Kartel (née Subach)", description: "Member of the Kartel family.", generation: "current" as Generation },
      { name: "Dominika Igorevna Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Arina Igorevna Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Igor Kaid Igorevich Kartel", description: "Next generation.", generation: "next" as Generation },
      { name: "Feliks Igorevich Kartel", description: "Next generation.", generation: "next" as Generation },
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
      root: "Корни",
      founder: "Основатели",
      ancestor: "Прародители",
      grandparent: "Дедушки и бабушки",
      elder: "Старшее поколение",
      current: "Настоящее поколение",
      next: "Новое поколение",
    } as Record<Generation, string>,
    people: [
      { name: "Пётр Картель", description: "Самый ранний известный предок рода Картель.", generation: "root" as Generation },
      { name: "Андрей Петрович Картель", description: "Основатель рода Картель.", generation: "founder" as Generation },
      { name: "Полонея Григорьевна Картель", description: "Основательница рода Картель.", generation: "founder" as Generation },
      { name: "Александр Андреевич Картель", description: "Прародитель семьи Картель.", generation: "ancestor" as Generation },
      { name: "Любовь Петровна Картель (Кирей)", description: "Прародительница семьи Картель.", generation: "ancestor" as Generation },
      { name: "Николай Александрович Картель", description: "Дед семьи Картель.", generation: "grandparent" as Generation },
      { name: "Валентина Александровна Картель (Михаль)", description: "Бабушка семьи Картель.", generation: "grandparent" as Generation },
      { name: "Петр Николаевич Картель", description: "Представитель старшего поколения семьи Картель. 8 февраля 1955, Беларусь — 3 января 2026, Лондон. Похоронен на кладбище Сити-оф-Лондон. Светлая память.", generation: "elder" as Generation },
      { name: "Валентина Чеславовна Картель (Чижевская)", description: "Представительница старшего поколения семьи Картель.", generation: "elder" as Generation },
      { name: "Игорь Гор Петрович Картель", description: "Представитель семьи в Лондоне.", generation: "current" as Generation },
      { name: "Диана Зеноновна Картель (Субоч)", description: "Член семьи Картель.", generation: "current" as Generation },
      { name: "Доминика Игоревна Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Арина Игоревна Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Игорь Каид Игоревич Картель", description: "Новое поколение.", generation: "next" as Generation },
      { name: "Феликс Игоревич Картель", description: "Новое поколение.", generation: "next" as Generation },
    ],
  },
};

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
