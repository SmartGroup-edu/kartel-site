// The eight elements of the Kartel coat of arms: names, meanings (EN + RU) and where each sits on crest.jpeg.
// One source for the public crest page (CrestHome, bus 176 P1) and the Кодекс thumbnails (FamilyKodeks, bus 86).
// The texts are the ones the crest explorer has carried since R0's act of 2026-11-14.

export interface HeraldicElement {
  id: string;
  labelEN: string;
  labelRU: string;
  descEN: string;
  descRU: string;
  // Position as % of crest.jpeg (900×1000), verified on a 10% grid 2026-11-15 (motto on the ribbon's left tail, 28/72: the centre of the ribbon is all lettering — checked on a 1% grid). The image renders
  // at its natural aspect (no crop), so the percentages map 1:1.
  x: number;
  y: number;
  // Icon SVG path
  icon: string;
}

export const CREST_ELEMENTS: HeraldicElement[] = [
  {
    id: "coronet",
    labelEN: "Coronet",
    labelRU: "Корона",
    descEN:
      "The coronet crowns the composition, pointing the way upward — toward the heights a person can reach through actions and faith. Not a mark of birthright, but a sign of the true qualities of a ruler: wisdom, justice, willpower, and faith in destiny. Authority granted not by blood, but by merit.",
    descRU:
      "Корона венчает композицию, задавая направление — к вершинам, которых человек способен достичь своими поступками и верой. Это не признак происхождения, а знак качеств истинного правителя: мудрости, справедливости, силы воли и веры в предназначение. Власть, даруемая не по крови, а по достоинству.",
    x: 50,
    y: 29,
    icon: "M12 2l3 7h-6l3-7zm-8 7l2-4 2 4H4zm12 0l2-4 2 4h-4z",
  },
  {
    id: "fleurdelis",
    labelEN: "Fleur-de-lis",
    labelRU: "Лилии",
    descEN:
      "Three heraldic fleur-de-lis embody purity of intention and nobility of spirit. Elegant, restrained, and strict in form, they extend the symbolism of the coronet from the side of moral virtues — a reminder that the summit belongs to those who demand the most from themselves.",
    descRU:
      "Три геральдические лилии воплощают чистоту помыслов и возвышенность духа. Изящные и строгие по форме, они продолжают образ короны со стороны нравственных добродетелей — напоминание о том, что вершина принадлежит тем, кто предъявляет самые высокие требования прежде всего к себе.",
    x: 50,
    y: 19,
    icon: "M12 2C12 2 8 8 8 12c0 2.2 1.8 4 4 4s4-1.8 4-4c0-4-4-10-4-10z",
  },
  {
    id: "swords",
    labelEN: "Swords",
    labelRU: "Мечи",
    descEN:
      "Two symmetrical swords rise behind the shield with blades pointing upward, symbolising readiness to stand between danger and what is dear. They express the right to act — when action becomes the only possible answer. This right is passed down as part of the family heritage.",
    descRU:
      "Два симметричных меча за щитом, клинки направлены вверх — готовность встать между опасностью и тем, что дорого. Мечи выражают право на действие, когда поступок становится единственным возможным ответом. Это право передается дальше как часть семейного наследия.",
    x: 22,
    y: 57,
    icon: "M12 2v16m-3-13l3-3 3 3m-6 10l3 3 3-3",
  },
  {
    id: "griffin",
    labelEN: "Griffin",
    labelRU: "Грифон",
    descEN:
      "At the heart of the shield walks a griffin — embodying strength, protection, and foresight. Combining the lion and the eagle into one form, it unites earthly and celestial, tangible and intangible. Depicted in motion with head held high, the griffin never sleeps and is always ready to act, led by its heart and unwavering sense of duty.",
    descRU:
      "Сердце щита занимает шествующий грифон — олицетворение силы, защиты и дальновидности. Объединяя льва и орла, он сливает земное и небесное, осязаемое и бестелесное. Изображён в движении, с поднятой головой — тот, кто никогда не спит и готов действовать, ведомый сердцем и чувством долга.",
    x: 47,
    y: 55,
    icon: "M12 4a4 4 0 014 4v2a2 2 0 01-2 2h-4a2 2 0 01-2-2V8a4 4 0 014-4zm-3 14l3-2 3 2v2H9v-2z",
  },
  {
    id: "staff",
    labelEN: "Staff",
    labelRU: "Жезл",
    descEN:
      "In its raised paw, the griffin holds a staff reminiscent of a shepherd's crook — alluding to Christian faith and spiritual authority. Not dominion, but service: to principles, beliefs, values, God, and one's calling. The attribute of those who bear responsibility and guide others beside them.",
    descRU:
      "В поднятой лапе грифона — жезл, близкий по форме к посоху пастыря. Он отсылает к христианской вере и духовной власти, указывающей не на господство, а на служение — принципам, убеждениям, ценностям, Богу и своему предназначению. Атрибут тех, кто привык брать на себя ответственность.",
    x: 35,
    y: 42,
    icon: "M7 2v20M5 4h4M5 8h4",
  },
  {
    id: "wings",
    labelEN: "Wings",
    labelRU: "Крылья",
    descEN:
      "Wings extend on either side of the shield, embodying silent and invisible divine protection. They echo the heraldic tradition of the Eastern European lands of the family's ancestors — present-day Belarus, Ukraine and western Russia — and stand for freedom of spirit, courage and readiness to defend family, honour and heritage.",
    descRU:
      "Крылья по обеим сторонам щита воплощают безмолвное и незримое Божественное покровительство. Они перекликаются с геральдической традицией восточноевропейских земель, где жили предки семьи, — современной Беларуси, Украины и западных областей России — и олицетворяют свободу духа, мужество и готовность защитить семью, честь и наследие.",
    x: 20,
    y: 22,
    icon: "M2 12c3-6 8-8 10-8M22 12c-3-6-8-8-10-8",
  },
  {
    id: "keys",
    labelEN: "Crossed keys",
    labelRU: "Ключи",
    descEN:
      "Two crossed keys at the base of the shield — a symbol of ecclesiastical authority rooted in the Apostle Peter, and a sign of deep knowledge. Their intersection forms a cross, affirming belief in one's own strength. A reminder that every person holds the keys to their own destiny.",
    descRU:
      "Два скрещённых ключа у основания щита — символ церковной власти, восходящий к апостолу Петру, и знак глубоких знаний. Их пересечение образует крест, утверждая веру в собственные силы. Напоминание о том, что каждый человек владеет ключами от собственной судьбы.",
    x: 50,
    y: 73,
    icon: "M8 11l-5 5m0 0l2 2m-2-2l-2 2m7-7l5-5m0 0l-2-2m2 2l2-2",
  },
  {
    id: "motto",
    labelEN: "Motto",
    labelRU: "Девиз",
    descEN:
      "'Virtus et Potestas' — Strength and Power. The core around which the entire image of the Kartel family is built. Strength is the ability to go all the way, following the call of the heart. Power is the measure of maturity, confidence, and acknowledgment of the heights attained. The motto awakens the inner will — to act decisively and live in accordance with what one believes is right.",
    descRU:
      "«Virtus et Potestas» — Сила и Власть. Стержень, вокруг которого выстраивается весь образ семьи Картель. Сила — это способность идти до конца, следуя зову сердца. Власть — мерило зрелости и признания достигнутых высот. Девиз призван пробуждать внутреннюю волю — действовать решительно и жить в соответствии с тем, что считаешь правильным.",
    x: 28,
    y: 72,
    icon: "M4 19h16M6 15h12M8 11h8",
  },
];

/** Marker positions (% of crest.jpeg) for reuse as crops — the Кодекс page thumbnails (bus 86). */
export const CREST_MARKERS: Record<string, { x: number; y: number; icon: string }> = Object.fromEntries(CREST_ELEMENTS.map((e) => [e.id, { x: e.x, y: e.y, icon: e.icon }]));
