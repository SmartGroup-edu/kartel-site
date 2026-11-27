import Link from "next/link";
import { CrestAuthHeader, CrestImg, crestStyles as s } from "./CrestChrome";
import { notFoundText, type NotFoundLang } from "../../content/notFound";

/**
 * The public 404 (bus 176 P1, the sitemap mockup's rule «Неизвестная страница»): crest style, «На главную» and
 * «Войти». The address exists in neither language, so RU / EN go to that language's home. Also the frame of the
 * public error boundary (`title`, `hint` and `action` replace the 404 copy and the first button).
 */
export default function CrestNotFound({ lang, title, hint, action, code = "404" }: { lang: NotFoundLang; title?: string; hint?: string; action?: React.ReactNode; code?: string | null }) {
  const t = notFoundText[lang];
  return (
    <div className={s.site}>
      <a className={s.skip} href="#main">{lang === "ru" ? "Перейти к содержимому" : "Skip to content"}</a>
      <CrestAuthHeader lang={lang} langHrefs={{ ru: "/ru", en: "/en" }} signin={t.signin} />
      <main className={s.nf} id="main" tabIndex={-1}>
        <div>
          <div className={`${s.nfCrest} ${s.masked}`}><CrestImg sizes="120px" /></div>
          {code && <div className={`${s.num} ${s.metal}`} aria-hidden="true">{code}</div>}
          <h1>{title ?? t.message}</h1>
          <p>{hint ?? t.hint}</p>
          <div className={s.nfBtns}>
            {action ?? <Link className={`${s.btn} ${s.gold} ${s.sheen}`} href={`/${lang}`} prefetch={false}>{t.home}</Link>}
            <Link className={`${s.btn} ${s.ghost}`} href={`/${lang}/family/signin`} prefetch={false}>{t.signin}</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
