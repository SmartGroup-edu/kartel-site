// The public coat of arms page (bus 176 P1), copy as in the R0-approved mockup
// bus/assets/2026-11-27-home-crest-v6-APPROVED.html. Heraldry only: no business, family-office, project or people
// wording — those live behind the family sign-in (R0 2026-11-27). The element texts come from app/content/crest.ts.
// RU strings are typographed once (non-breaking spaces after short words and before dashes).
import { typographDict, typographRuFields } from "../lib/typograph.mjs";
import { CREST_ELEMENTS } from "./crest";

export type CrestLang = "en" | "ru";

const HOME = {
  ru: {
    nav: { explore: "Герб", colours: "Цвета", motto: "Девиз", faq: "Вопросы" },
    signin: "Войти", menu: "Меню", sections: "Разделы", langGroup: "Язык / Language", skip: "Перейти к содержимому", brandHome: "KARTEL — на главную",
    eyebrow: "Фамильный герб · Лондон", h1: "Фамильный герб Картель", mottoTr: "Сила и Власть",
    lead: "Грифон, корона, мечи, лилии, крылья и скрещённые ключи — каждый элемент герба несёт свой смысл. Исследуйте их ниже.",
    cta1: "Войти в семейный кабинет", cta2: "Исследовать герб", scroll: "Листайте",
    exEyebrow: "Символика", exTitle: "Исследуйте герб", exSub: "Нажмите на точку на гербе или выберите элемент, чтобы узнать его значение.", exTabs: "Элементы герба",
    colEyebrow: "Геральдика", colTitle: "Четыре цвета герба",
    faqEyebrow: "Вопросы", faqTitle: "Частые вопросы о гербе",
    m1t: "Сила", m1: "Способность идти до конца, следуя зову сердца и своим убеждениям.",
    m2t: "Власть", m2: "Мерило зрелости, уверенности и признания достигнутых высот.",
    famTitle: "Для членов семьи", famText: "Семейный кабинет — дела, календарь, решения и документы семьи. Вход только по приглашению.",
    fam: ["Вход без пароля — Face ID или Touch ID", "Код на почту как запасной способ", "Только для приглашённых"],
    famEnter: "Вход для семьи", otherLang: "English", copy: "© Семья Картель · Лондон",
    prev: "← Назад", next: "Далее →",
    alt: "Фамильный герб Картель: золотой и серебряный грифон с жезлом на чёрно-красном щите, корона, крылья, скрещённые мечи и ключи, лента с девизом Virtus et Potestas",
    altEx: "Герб Картель — интерактивный просмотр элементов",
  },
  en: {
    nav: { explore: "Coat of arms", colours: "Colours", motto: "Motto", faq: "Questions" },
    signin: "Sign in", menu: "Menu", sections: "Sections", langGroup: "Language / Язык", skip: "Skip to content", brandHome: "KARTEL — home",
    eyebrow: "Family coat of arms · London", h1: "The Kartel Coat of Arms", mottoTr: "Strength and Power",
    lead: "Griffin, coronet, swords, fleur-de-lis, wings and crossed keys — every element of the arms carries its own meaning. Explore them below.",
    cta1: "Sign in to the family area", cta2: "Explore the arms", scroll: "Scroll",
    exEyebrow: "Symbolism", exTitle: "Explore the coat of arms", exSub: "Tap a point on the crest or choose an element to learn its meaning.", exTabs: "Elements of the arms",
    colEyebrow: "Heraldry", colTitle: "The four colours of the arms",
    faqEyebrow: "Questions", faqTitle: "Frequently asked questions",
    m1t: "Strength", m1: "The ability to go all the way, following the call of the heart and one's convictions.",
    m2t: "Power", m2: "The measure of maturity, confidence and acknowledgment of the heights attained.",
    famTitle: "For family members", famText: "The family area holds the family's tasks, calendar, decisions and documents. By invitation only.",
    fam: ["Passwordless sign-in — Face ID or Touch ID", "Email code as a fallback", "Invited members only"],
    famEnter: "Family sign-in", otherLang: "Русский", copy: "© The Kartel family · London",
    prev: "← Previous", next: "Next →",
    alt: "The Kartel family coat of arms: a gold and silver griffin holding a staff on a black and red shield, with coronet, wings, crossed swords and keys, and a ribbon bearing the motto Virtus et Potestas",
    altEx: "The Kartel coat of arms — interactive view of its elements",
  },
};

/** Gold, black, silver, red: name, heraldic tincture, swatch, meaning, sheen on the swatch. */
const COLOURS = {
  ru: [
    { name: "Золото", tincture: "Or", swatch: "var(--metal)", meaning: "Благородство, мудрость, просвещение", sheen: true },
    { name: "Чёрный", tincture: "Sable", swatch: "linear-gradient(160deg,#1c1c1c,#050505)", meaning: "Воля, стойкость, дисциплина", sheen: false },
    { name: "Серебро", tincture: "Argent", swatch: "linear-gradient(135deg,#8d8d8a,#f4f4f2 45%,#bdbdb9 60%,#7d7d79)", meaning: "Истина, добродетель, искренность", sheen: true },
    { name: "Красный", tincture: "Gules", swatch: "linear-gradient(160deg,#c2262f,#6e1219)", meaning: "Отвага, страсть, лидерство, сила духа", sheen: false },
  ],
  en: [
    { name: "Gold", tincture: "Or", swatch: "var(--metal)", meaning: "Nobility, wisdom, enlightenment", sheen: true },
    { name: "Black", tincture: "Sable", swatch: "linear-gradient(160deg,#1c1c1c,#050505)", meaning: "Willpower, endurance, discipline", sheen: false },
    { name: "Silver", tincture: "Argent", swatch: "linear-gradient(135deg,#8d8d8a,#f4f4f2 45%,#bdbdb9 60%,#7d7d79)", meaning: "Truth, virtue, sincerity", sheen: true },
    { name: "Red", tincture: "Gules", swatch: "linear-gradient(160deg,#c2262f,#6e1219)", meaning: "Courage, passion, leadership, strength of spirit", sheen: false },
  ],
};

/** The visible FAQ and the FAQPage JSON-LD read the same list (the texts of the pre-176 home's FAQ). */
const FAQ = {
  ru: [
    { q: "Что представляет собой герб семьи Картель?", a: "Герб Картель — геральдическая композиция, созданная для семьи Картель из Лондона. В ней грифон, скрещённые ключи, корона, мечи, лилии, крылья и латинский девиз «Virtus et Potestas» (Сила и Власть)." },
    { q: "Что означает Virtus et Potestas?", a: "«Virtus et Potestas» переводится с латыни как «Сила и Власть». Сила — способность идти за своими убеждениями до конца, власть — мерило зрелости, уверенности и признания достигнутых высот." },
    { q: "Что символизирует грифон в гербе Картель?", a: "Грифон объединяет льва (земная сила) и орла (небесное зрение), олицетворяя силу, защиту, дальновидность и единство противоположностей. Изображён в движении — знак постоянной готовности действовать." },
    { q: "Что означают скрещённые ключи в гербе Картель?", a: "Скрещённые ключи у основания щита символизируют знание, священную тайну и союз разума и веры. Исторически связаны с апостолом Петром: каждый владеет ключами от собственной судьбы." },
    { q: "Какие геральдические цвета у герба Картель?", a: "Четыре геральдических цвета: золото (благородство, мудрость), чёрный (воля, стойкость, дисциплина), серебро (истина, добродетель, искренность) и красный (отвага, страсть, лидерство, сила духа)." },
  ],
  en: [
    { q: "What is the Kartel coat of arms?", a: "The Kartel coat of arms is a heraldic composition created for the Kartel family, based in London. It features a griffin, crossed keys, coronet, swords, fleur-de-lis, wings, and the Latin motto 'Virtus et Potestas' (Strength and Power)." },
    { q: "What does Virtus et Potestas mean?", a: "'Virtus et Potestas' translates from Latin as 'Strength and Power.' In the Kartel family context, strength is the ability to follow one's convictions to the end, while power signifies maturity, confidence, and acknowledgment of the heights attained." },
    { q: "What does the griffin symbolize in the Kartel coat of arms?", a: "The griffin combines the lion (earthly strength) and the eagle (celestial vision), representing strength, protection, foresight, and the union of opposites. It is depicted in motion with head held high and wings spread, symbolizing perpetual readiness to act." },
    { q: "What do the crossed keys represent in the Kartel coat of arms?", a: "The crossed keys at the base of the shield symbolize knowledge, sacred mystery, and the union between reason and faith. Historically linked to the Apostle Peter, they represent the idea that every person holds the keys to their own destiny." },
    { q: "What are the heraldic colours of the Kartel coat of arms?", a: "The coat of arms uses four heraldic colours: gold/or (nobility, wisdom, enlightenment), sable/black (willpower, endurance, discipline), argent/silver (truth, virtue, sincerity), and gules/red (courage, passion, leadership, strength of spirit)." },
  ],
};

/** Page metadata, as in the mockup's <head> (title, description, keywords, OG). */
export const CREST_META = {
  ru: {
    title: "Фамильный герб Картель — Virtus et Potestas",
    description: "Фамильный герб Картель: грифон, скрещённые ключи, корона, мечи, лилии и крылья, латинский девиз Virtus et Potestas (Сила и Власть).",
    ogDescription: "Грифон, корона, мечи, лилии, крылья и скрещённые ключи — значение каждого элемента герба семьи Картель.",
    keywords: ["герб Картель", "геральдика Картель", "грифон", "Virtus et Potestas", "фамильный герб Картель"],
    imageName: "Фамильный герб Картель",
    imageCaption: "Фамильный герб Картель — Virtus et Potestas",
    imageDescription: "Геральдический герб с грифоном, скрещёнными ключами, короной, мечами и девизом Virtus et Potestas (Сила и Власть).",
  },
  en: {
    title: "The Kartel Coat of Arms — Virtus et Potestas",
    description: "The Kartel family coat of arms: a griffin, crossed keys, coronet, swords, fleur-de-lis and wings, with the Latin motto Virtus et Potestas (Strength and Power).",
    ogDescription: "Griffin, coronet, swords, fleur-de-lis, wings and crossed keys — the meaning of every element of the Kartel family coat of arms.",
    keywords: ["Kartel coat of arms", "Kartel heraldry", "griffin", "Virtus et Potestas", "Kartel family crest"],
    imageName: "The Kartel family coat of arms",
    imageCaption: "The Kartel family coat of arms — Virtus et Potestas",
    imageDescription: "A heraldic coat of arms featuring a griffin, crossed keys, coronet, swords, and the motto Virtus et Potestas (Strength and Power).",
  },
};

export const crestHome = { ru: typographDict(HOME.ru), en: HOME.en };
export const crestColours = { ru: typographDict(COLOURS.ru), en: COLOURS.en };
export const crestFaq = { ru: typographDict(FAQ.ru), en: FAQ.en };
/** Raw (untypographed) FAQ text for the JSON-LD: search engines get plain spaces. */
export const crestFaqPlain = FAQ;
export const crestElements = typographRuFields(CREST_ELEMENTS);

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
