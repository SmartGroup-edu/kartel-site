"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import CrestNotFound from "../components/crest/CrestNotFound";
import { crestStyles as s } from "../components/crest/CrestChrome";

// Route error boundary (bus 176 P1): the crest frame of the public 404 — a retry button, «Войти», no site menu.
// The family area has its own boundary (app/[lang]/family/error.tsx) with a reference code.
const text = {
  en: { heading: "Something went wrong", message: "The page could not be shown. Please try again.", cta: "Try again" },
  ru: { heading: "Что-то пошло не так", message: "Страницу не удалось показать. Пожалуйста, попробуйте ещё раз.", cta: "Повторить" },
};

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ lang: string }>();
  const lang = params?.lang === "ru" ? "ru" : "en";
  const t = text[lang];

  useEffect(() => {
    console.error("Runtime error:", error);
  }, [error]);

  return (
    <CrestNotFound
      lang={lang}
      code={null}
      title={t.heading}
      hint={t.message}
      action={<button type="button" onClick={reset} className={`${s.btn} ${s.gold} ${s.sheen}`}>{t.cta}</button>}
    />
  );
}
