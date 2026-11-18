// Stage 3d (bus 86, plan «Наставник · Кодекс» §3, §6.1; R0 decisions 18.11.2026). Pure, unit-tested.
//
// - Кодекс: the family's eight principles, one per crest element. Ratified by R0 on 18.11.2026 in the
//   plan §3 wording, so version 1 is seeded `approved`. Later edits are new versions by a parent.
// - Принцип недели: one principle per week; a parent may pick it, otherwise round-robin.
// - Признание: «<имя> — <принцип>: <текст>». Seen by the recipient, the sender and the recipient's
//   parents only. Never counted, liked or ranked.
// - Бережный счёт: «N из M на этой неделе» instead of a streak (ICO Children's Code: streaks are a nudge).
import { occursOn, addDays } from "./recur.mjs";

/** Crest element ids match the site's crest explorer markers (mantling has no marker on the crest). */
export const KODEKS_V1 = {
  principles: [
    { element: "griffin", element_ru: "Грифон", meaning: "сила, защита, дальновидность, долг", principle: "Береги своих. Сильный защищает, а не обижает", practice: "Помочь младшему или заступиться" },
    { element: "staff", element_ru: "Жезл", meaning: "служение, ответственность, ориентир для других", principle: "Служу, а не командую. Беру ответственность первым", practice: "Сделать дело без напоминания" },
    { element: "keys", element_ru: "Ключи", meaning: "знание и вера; ключи от своей судьбы", principle: "Учусь каждый день. Двери открывает тот, кто готов", practice: "Чтение, урок, новый навык" },
    { element: "wings", element_ru: "Крылья", meaning: "покровительство, свобода духа, мужество", principle: "Ты не один. Прошу помощи и поддерживаю других", practice: "Спросить «как ты?» и выслушать" },
    { element: "mantling", element_ru: "Намёт", meaning: "доблесть, стойкость, верность долгу", principle: "Держу слово. Обещал — сделал", practice: "Закрыть принятую задачу" },
    { element: "coronet", element_ru: "Корона", meaning: "власть по достоинству, мудрость, справедливость", principle: "Достоинство — в поступках. Справедлив и честен", practice: "Признать ошибку и исправить" },
    { element: "fleurdelis", element_ru: "Лилии", meaning: "чистота помыслов, высокие требования к себе", principle: "Спрашиваю с себя первым", practice: "Вечером один вопрос себе" },
    { element: "swords", element_ru: "Мечи", meaning: "готовность защитить, право на действие", principle: "Смелость поступить правильно", practice: "Сделать правильное, даже если трудно" },
  ],
  motto: "Virtus et Potestas. Сила — идти до конца, власть — зрелость, которую признают по поступкам.",
};
export const KODEKS_V1_APPROVED_ON = "2026-11-18";
export const ELEMENTS = KODEKS_V1.principles.map((p) => p.element);

/** A new version's body: exactly 8 principles on the 8 elements, in the same order; short plain text. */
export function validKodeks(body) {
  if (!body || !Array.isArray(body.principles) || body.principles.length !== 8) return false;
  const okText = (s, max) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
  return body.principles.every((p, i) => p && p.element === ELEMENTS[i] && okText(p.principle, 160) && okText(p.practice, 160) && okText(p.meaning, 200) && okText(p.element_ru, 40))
    && okText(body.motto, 300);
}

/** Monday of the week of `date` (YYYY-MM-DD, Europe/London local date). */
export function mondayOf(date) {
  const d = new Date(`${date}T12:00:00Z`);
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}

const ROUND_ROBIN_FROM = "2026-11-16"; // the Monday of the week the Кодекс was ratified → principle 1
/** The week's principle index: a parent's pick for that week, otherwise round-robin from 16.11.2026. */
export function principleOfWeek(weekStart, pick) {
  if (Number.isInteger(pick) && pick >= 0 && pick < 8) return { index: pick, picked: true };
  const weeks = Math.round((Date.parse(`${weekStart}T12:00:00Z`) - Date.parse(`${ROUND_ROBIN_FROM}T12:00:00Z`)) / (7 * 86400_000));
  return { index: ((weeks % 8) + 8) % 8, picked: false };
}

/**
 * «N из M на этой неделе»: M = the days of this week (Mon–Sun) the routine is due and not paused, N = the
 * ones done. A missed day is never a "lost streak"; nothing here looks back beyond the week.
 */
export function weekCount(rule, dtstart, done, today, skip = () => false) {
  const mon = mondayOf(today);
  let n = 0, m = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    if (d < dtstart || !occursOn(rule, dtstart, d) || skip(d)) continue;
    m++;
    if (done.has(d)) n++;
  }
  return { done: n, of: m };
}

/** Which count a person sees: children always the weekly count; an adult chooses (default weekly). */
export const countModeFor = (person, pref) => (person?.kind === "child" ? "week" : pref === "streak" ? "streak" : "week");

/** The recipient's parents: adults with an active parent grant on the recipient. */
const parentOf = (me, childId, grants) => grants.some((g) => !g.revoked_at && g.relation === "parent" && g.guardian_id === me.id && g.child_id === childId);

/** A recognition is seen by its sender, its recipient and the recipient's parents — nobody else. */
export function canSeeRecognition(me, rec, grants) {
  if (!me || !rec) return false;
  return me.id === rec.from_id || me.id === rec.to_id || parentOf(me, rec.to_id, grants);
}

export const RECOGNITION_MAX = 200;
export const RECOGNITIONS_PER_DAY = 5;

/** WOOP (optional): Мечта / Лучший результат / Главное препятствие / План «если — то». Each ≤ 300. */
export const WOOP_KEYS = ["wish", "outcome", "obstacle", "plan"];
export function cleanWoop(w) {
  if (w === null) return null;
  if (!w || typeof w !== "object") return undefined;
  const out = {};
  for (const k of WOOP_KEYS) {
    const v = w[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string" || v.length > 300) return undefined;
    if (v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : null;
}

/** «После чего?»: free text ≤ 60 or another routine of the same person (never itself). */
export function cleanAnchor(b, ownRoutineIds, selfId) {
  const textA = typeof b?.anchor_text === "string" ? b.anchor_text.trim() : "";
  const rid = typeof b?.anchor_routine_id === "string" ? b.anchor_routine_id : "";
  if (textA && rid) return { error: "one_anchor" };
  if (textA) return textA.length <= 60 ? { anchor_text: textA, anchor_routine_id: null } : { error: "bad_anchor" };
  if (rid) return ownRoutineIds.includes(rid) && rid !== selfId ? { anchor_text: null, anchor_routine_id: rid } : { error: "bad_anchor" };
  return { anchor_text: null, anchor_routine_id: null };
}
