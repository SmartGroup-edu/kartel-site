import "server-only";

// The Kartel family's names and personal details. SERVER-ONLY (R0 decision 2026-11-14:
// no family names in anything served without sign-in). Importing this from a client component
// fails the build. Only the gated pages /[lang]/family and /[lang]/family/crest read it and
// pass the data down as props, so it reaches the browser only inside an approved session.

import type { Generation, TreeNode, TimelineEvent } from "./family";

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
      "Семья Картель предстаёт здесь как живая линия преемственности — семья, объединённая именем, памятью, ответственностью и осознанным сохранением наследия.",
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

export const FAMILY_TREE_NODES: TreeNode[] = [
  { id: "piotr_root", nameEN: "Piotr Kartel", nameRU: "Пётр Картель", roleEN: "Root", roleRU: "Корни", generation: "root" },
  { id: "andrey", nameEN: "Andrey Petrovich Kartel", nameRU: "Андрей Петрович Картель", roleEN: "Founder", roleRU: "Основатели", generation: "founder" },
  { id: "poloneya", nameEN: "Poloneya Grigorievna Kartel", nameRU: "Полонея Григорьевна Картель", roleEN: "Founder", roleRU: "Основатели", generation: "founder" },
  { id: "aleksandr", nameEN: "Aleksandr Andreyevich Kartel", nameRU: "Александр Андреевич Картель", roleEN: "Ancestor", roleRU: "Прародители", generation: "ancestor" },
  { id: "lyubov", nameEN: "Lyubov Petrovna Kartel (née Kirey)", nameRU: "Любовь Петровна Картель (Кирей)", roleEN: "Ancestor", roleRU: "Прародители", generation: "ancestor" },
  { id: "nikolai", nameEN: "Nikolai Aleksandrovich Kartel", nameRU: "Николай Александрович Картель", roleEN: "Grandparent", roleRU: "Дедушки и бабушки", generation: "grandparent" },
  { id: "valentina_a", nameEN: "Valentina Aleksandrovna Kartel (née Mikhal)", nameRU: "Валентина Александровна Картель (Михаль)", roleEN: "Grandparent", roleRU: "Дедушки и бабушки", generation: "grandparent" },
  { id: "piotr", nameEN: "Piotr Nikolaevich Kartel", nameRU: "Петр Николаевич Картель", roleEN: "Elder generation", roleRU: "Старшее поколение", generation: "elder" },
  { id: "valentina", nameEN: "Valentina Cheslavovna Kartel (née Chizhevskaya)", nameRU: "Валентина Чеславовна Картель (Чижевская)", roleEN: "Elder generation", roleRU: "Старшее поколение", generation: "elder" },
  { id: "igor", nameEN: "Igor Gor Petrovich Kartel", nameRU: "Игорь Гор Петрович Картель", roleEN: "Family representative, London", roleRU: "Представитель семьи, Лондон", generation: "current" },
  { id: "diana", nameEN: "Diana Zenonovna Kartel (née Subach)", nameRU: "Диана Зеноновна Картель (Субоч)", roleEN: "Present generation", roleRU: "Настоящее поколение", generation: "current" },
  { id: "dominika", nameEN: "Dominika Igorevna Kartel", nameRU: "Доминика Игоревна Картель", roleEN: "Next generation", roleRU: "Новое поколение", generation: "next" },
  { id: "arina", nameEN: "Arina Igorevna Kartel", nameRU: "Арина Игоревна Картель", roleEN: "Next generation", roleRU: "Новое поколение", generation: "next" },
  { id: "kaid", nameEN: "Igor Kaid Igorevich Kartel", nameRU: "Игорь Каид Игоревич Картель", roleEN: "Next generation", roleRU: "Новое поколение", generation: "next" },
  { id: "feliks", nameEN: "Feliks Igorevich Kartel", nameRU: "Феликс Игоревич Картель", roleEN: "Next generation", roleRU: "Новое поколение", generation: "next" },
];

export const FAMILY_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: "origins",
    yearEN: "Origins",
    yearRU: "Истоки",
    titleEN: "The Kartel Name",
    titleRU: "Имя Картель",
    descEN: "The family name Kartel carries within it an echo of strength and unity — a name that became the foundation of identity and memory across generations.",
    descRU: "Фамилия Картель несёт в себе отголосок силы и единства — имя, ставшее основой идентичности и памяти на протяжении поколений.",
  },
  {
    id: "root",
    yearEN: "Roots",
    yearRU: "Корни",
    titleEN: "Piotr Kartel",
    titleRU: "Пётр Картель",
    descEN: "The earliest known ancestor of the Kartel family — the root from which the entire lineage descends.",
    descRU: "Самый ранний известный предок рода Картель — корень, от которого происходит весь род.",
  },
  {
    id: "founders",
    yearEN: "Founders",
    yearRU: "Основатели",
    titleEN: "Andrey Petrovich & Poloneya Grigorievna Kartel",
    titleRU: "Андрей Петрович и Полонея Григорьевна Картель",
    descEN: "The generation that carried forward the family from its earliest root — building the foundation of the Kartel lineage.",
    descRU: "Поколение, продолжившее род от его самого раннего корня — заложившее основу рода Картель.",
  },
  {
    id: "ancestors",
    yearEN: "Ancestors",
    yearRU: "Прародители",
    titleEN: "Aleksandr Andreyevich & Lyubov Petrovna Kartel (née Kirey)",
    titleRU: "Александр Андреевич и Любовь Петровна Картель (Кирей)",
    descEN: "The generation that carried forward the founders' legacy — strengthening the family line and its values.",
    descRU: "Поколение, продолжившее дело основателей — укрепившее семейную линию и её ценности.",
  },
  {
    id: "grandparents",
    yearEN: "Grandparents",
    yearRU: "Дедушки и бабушки",
    titleEN: "Nikolai Aleksandrovich & Valentina Aleksandrovna Kartel (née Mikhal)",
    titleRU: "Николай Александрович и Валентина Александровна Картель (Михаль)",
    descEN: "The grandparent generation carried forward the family values and traditions, bridging the past and the present.",
    descRU: "Поколение дедушек и бабушек передало семейные ценности и традиции, связав прошлое с настоящим.",
  },
  {
    id: "elders",
    yearEN: "Elder Generation",
    yearRU: "Старшее поколение",
    titleEN: "Piotr Nikolaevich & Valentina Cheslavovna Kartel (née Chizhevskaya)",
    titleRU: "Пётр Николаевич и Валентина Чеславовна Картель (Чижевская)",
    descEN: "The elder generation laid the foundation of values, discipline, and faith that would define the family for decades to come.",
    descRU: "Старшее поколение заложило фундамент ценностей, дисциплины и веры, определивших семью на десятилетия вперёд.",
  },
  {
    id: "london",
    yearEN: "London",
    yearRU: "Лондон",
    titleEN: "A New Chapter in London",
    titleRU: "Новая глава в Лондоне",
    descEN: "The family established its presence in London — bringing heritage, ambition, and the conscious continuation of legacy to a new horizon.",
    descRU: "Семья обосновалась в Лондоне — привнеся наследие, амбиции и осознанное продолжение традиций на новый горизонт.",
  },
  {
    id: "present",
    yearEN: "Present",
    yearRU: "Настоящее",
    titleEN: "Igor Gor Petrovich & Diana Zenonovna Kartel (née Subach)",
    titleRU: "Игорь Гор Петрович и Диана Зеноновна Картель (Субоч)",
    descEN: "The present generation carries forward the family name with purpose — building, creating, and preserving what matters most.",
    descRU: "Настоящее поколение продолжает семейное имя с целеустремлённостью — созидая, строя и сохраняя самое важное.",
  },
  {
    id: "next",
    yearEN: "Next Generation",
    yearRU: "Новое поколение",
    titleEN: "Dominika, Arina, Igor Kaid & Feliks",
    titleRU: "Доминика, Арина, Игорь Каид и Феликс",
    descEN: "The next generation — the living continuation of the Kartel legacy. Each carrying the name forward into a future yet to be written.",
    descRU: "Новое поколение — живое продолжение наследия Картель. Каждый несёт имя вперёд, в будущее, которое ещё предстоит написать.",
  },
  {
    id: "crest",
    yearEN: "The Coat of Arms",
    yearRU: "Герб",
    titleEN: "Virtus et Potestas",
    titleRU: "Virtus et Potestas",
    descEN: "The creation of the family coat of arms — a heraldic symbol uniting all generations under one motto: Strength and Power.",
    descRU: "Создание фамильного герба — геральдического символа, объединяющего все поколения под одним девизом: Сила и Власть.",
  },
];

/** Name list shown on the gated crest page. */
export const CREST_NAMES = {
  ru: [
      "Игорь Гор Картель", "Диана Картель", "Доминика Картель", "Арина Картель",
      "Игорь Каид Картель", "Феликс Картель", "Петр Картель", "Валентина Картель",
  ],
  en: [
      "Igor Gor Kartel", "Diana Kartel", "Dominika Kartel", "Arina Kartel",
      "Igor Kaid Kartel", "Feliks Kartel", "Piotr Kartel", "Valentina Kartel",
  ],
};
