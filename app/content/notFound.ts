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
