/**
 * Server side of the «не отвечает» state (QA-156 M7). With Family OS silent we cannot ask it who is a member,
 * so the sub-nav shows the member tabs (every one of them leads to the same calm state) plus what the local
 * allowlists say: «Доступы» for the owner, «Редактор» for the owner and an editor. Server-only (family-gate).
 */
import { isFamilyAdmin, familyRole } from "./family-gate";
import type { FamilyChromeNav } from "../components/FamilyChrome";

export function osDownNav(subject: string): FamilyChromeNav {
  return { admin: isFamilyAdmin(subject), editor: familyRole(subject) === "editor", os: true };
}

/** The H1 of each OS page in the «не отвечает» state — the page's own name, as in its tab title. */
export const OS_DOWN_TITLE = {
  today: { EN: "Today", RU: "Сегодня" },
  people: { EN: "People", RU: "Люди" },
  board: { EN: "Family board", RU: "Семейная доска" },
  council: { EN: "Family council", RU: "Семейный совет" },
  calendar: { EN: "Calendar", RU: "Календарь" },
  kodeks: { EN: "The Kartel family code", RU: "Кодекс семьи Картель" },
  week: { EN: "Family week", RU: "Неделя семьи" },
  person: { EN: "Family", RU: "Семья" },
  access: { EN: "People and access", RU: "Люди и доступы" },
} as const;
