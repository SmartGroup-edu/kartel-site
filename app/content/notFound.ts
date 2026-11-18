// 404 copy, shared by app/global-not-found.tsx (unmatched URLs) and app/[lang]/not-found.tsx
// (notFound() inside a route), so both read the same words in each language (cycle 5 #1).
export const notFoundText = {
  en: {
    title: "Page not found",
    message: "This page does not exist.",
    hint: "The address may be mistyped, or the page has moved.",
    home: "Coat of arms",
    registry: "Registry",
  },
  ru: {
    title: "Страница не найдена",
    message: "Такой страницы нет.",
    hint: "Возможно, в адресе опечатка или страница переехала.",
    home: "Герб",
    registry: "Реестр",
  },
} as const;

export type NotFoundLang = keyof typeof notFoundText;

/** Family OS (bus 97 item 6): the gate answers «not found» for pages a member may not see, so the copy
 *  says both; a reference code ties the report to one server log line. «Ты», as everywhere in Family OS. */
export const familyRefText = {
  en: {
    message: "This page does not exist, or it is not open to you.",
    hint: "If you think it should be, tell the family admin and give this code:",
    error: "Something went wrong on this page. Please try again; if it happens again, give this code:",
    code: "Reference code",
    home: "Today",
    heritage: "Heritage",
  },
  ru: {
    message: "Такой страницы нет, или она тебе недоступна.",
    hint: "Если она должна открываться, напиши владельцу семейного раздела и назови код:",
    error: "На этой странице что-то пошло не так. Попробуй ещё раз; если повторится — назови код:",
    code: "Код обращения",
    home: "Сегодня",
    heritage: "Наследие",
  },
} as const;
