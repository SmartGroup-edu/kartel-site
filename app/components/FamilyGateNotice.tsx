"use client";

/**
 * Non-PII fail-closed sign-in for the gated family area, «Семейный кабинет» (kartel-site).
 * Rendered by the sign-in page, and by the page guard when a request is not an approved viewer. The edge
 * (proxy.ts) normally redirects first; this is the defense-in-depth fallback that guarantees family PII is never
 * rendered without an approved session.
 *
 * STANDALONE AUTH (R0 decision 2026-11-14): sign-in is a passkey, or an emailed link + six-digit code — not an OIDC
 * bounce. The email form posts to /api/family-auth/request, which answers identically whether or not the address is
 * on the allowlist, so this page must never confirm membership either.
 *
 * bus 176 P1: the look, copy and states of the R0-approved mockup bus/assets/2026-11-27-signin-v2-APPROVED.html
 * (centred), on the real states: start · no passkey on this device · confirming on the device · passkey failed ·
 * email sent (6-cell code) · wrong code · too many attempts · link expired · link used · not the latest link ·
 * opened in another browser · session ended · welcome on success. The aside is the crest over the heraldic hatching —
 * no business wording. Every existing behaviour stays: passkey autofill on the email field, the link's nonce cookie
 * (set by the request route, read by /verify), and every error the routes return.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startAuthentication, browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, WebAuthnAbortService } from "@simplewebauthn/browser";
import { typographDict } from "../lib/typograph.mjs";
import { CrestImg, CrestAuthHeader, crestStyles as s } from "./crest/CrestChrome";
import CrestAside from "./crest/CrestAside";

/** Hash the "different email" link carries back to the form, which then focuses the field. */
const EDIT_HASH = "#family-email";
/** The address typed in this tab, kept for «Прислать письмо ещё раз» only (sessionStorage: this tab, this session). */
const RESEND_KEY = "kartel-signin-email";

/** 1 минуту · 2 минуты · 5 минут · 21 минуту — accusative after «действует». */
function ruMinutes(n: number): string {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return "минуту";
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "минуты";
  return "минут";
}
const enMinutes = (n: number) => `${n} ${n === 1 ? "minute" : "minutes"}`;

const copy = {
  en: {
    back: "Home", home: "KARTEL — home", langGroup: "Language / Язык",
    mottoTr: "Strength and Power", aside: "The Kartel coat of arms",
    feat: (codes: boolean) => ["Passwordless sign-in", "For the family only", codes ? "Each link and code works once" : "Each link works once"],
    eyebrow: "Family area",
    heading: "Family sign-in",
    body: "Sign in to open the family area. Access is by invitation, with approval from the head of the family.",
    pk: "Sign in with Face ID or Touch ID",
    pkHint: "Or another passkey, if one is already added on this device.",
    orCode: "or by email, with a code", orLink: "or by an email link",
    label: "Email address",
    placeholder: "you@example.com",
    help: (min: number, codes: boolean) => codes
      ? `We'll email you a sign-in link and a six-digit code. Both expire in ${enMinutes(min)} and work once.`
      : `We'll email you a sign-in link. It expires in ${enMinutes(min)} and works once.`,
    cta: (codes: boolean) => (codes ? "Email me a link and code" : "Email me a sign-in link"),
    sending: "Sending…",
    checkEmail: "Check the email address",
    noAccess: "No access yet? Ask the head of the family to invite you.",
    pkBusyTitle: "Confirm on your device",
    pkBusy: "Look at the camera or use your fingerprint. The confirmation window comes from your device, not this site.",
    cancel: "Cancel",
    pkFail: (codes: boolean) => `Couldn't sign in with a passkey. Try again, or sign in by email${codes ? " with a code" : ""}.`,
    retry: "Try again",
    noPk: (codes: boolean) => `This device doesn't support Face ID or Touch ID sign-in — sign in by email${codes ? " with a code" : ""}.`,
    sentTitle: "Check your email",
    sent: (min: number, codes: boolean) => codes
      ? `If that address has access, an email is on its way. Check your inbox and spam. Tap “Sign in” in the email — or type the code below. The code expires in ${enMinutes(min)}.`
      : `If that address has access, an email is on its way. Check your inbox and spam, and tap “Sign in” in the email. The link expires in ${enMinutes(min)}.`,
    codeLabel: "Code from the email",
    digit: (i: number) => `Digit ${i} of 6`,
    codeCta: "Sign in with the code",
    codeBusy: "Checking…",
    again: "Use a different email",
    resend: "Send the email again",
    ended: "Your session was ended. This happens when the head of the family closes open sessions — for example, after a lost phone. Please sign in again.",
    invalid: "That link didn’t work. Ask for a new one here: the email will have a link and a code, and the code can be typed on this page.",
    expired: (min: number) => `That link has expired — a link works for ${enMinutes(min)}. Ask for a new one here.`,
    superseded: "This isn’t the latest link — open the newest email. Each new request cancels the earlier links and codes.",
    used: "That link has already been used — it works only once. If you aren't signed in, ask for a new one.",
    elsewhereTitle: "This link opened in a different browser",
    elsewhere: "Go back to the tab where you asked to sign in and type the code from the email there — the six digits under the “Sign in” button.",
    elsewhereNew: "If that tab is closed, ask for a new email here:",
    ctaHere: "Send a new email here",
    welcome: "Welcome",
    welcomeSub: "Opening the family area…",
    codeErr: {
      wrong: (left: number) => `That code didn't match. Attempts left: ${left}.`,
      locked: "Too many wrong attempts. Ask for a new email — it comes with a new code.",
      superseded: "That code is from an earlier email — open the newest one.",
      expired: "That code has expired. Ask for a new email.",
      used: "That code has already been used. If you aren't signed in, ask for a new email.",
      no_request: "This browser has no sign-in request. Type the code in the tab where you asked for the email, or ask for a new one.",
      format: "The code is six digits.",
      rate_limited: "Too many attempts. Wait a few minutes and try again.",
      other: "Couldn’t check the code. Use the link in the email, or ask for a new one.",
    },
  },
  ru: {
    back: "На главную", home: "KARTEL — на главную", langGroup: "Язык / Language",
    mottoTr: "Сила и Власть", aside: "Фамильный герб Картель",
    feat: (codes: boolean) => ["Вход без пароля", "Только для семьи", codes ? "Ссылка и код срабатывают один раз" : "Ссылка срабатывает один раз"],
    eyebrow: "Семейный кабинет",
    heading: "Вход для семьи",
    body: "Войдите, чтобы открыть семейный кабинет. Доступ — по приглашению и после одобрения главой семьи.",
    pk: "Войти с Face ID или Touch ID",
    pkHint: "Или другим ключом доступа, если он уже добавлен на этом устройстве.",
    orCode: "или по письму с кодом", orLink: "или по ссылке на почту",
    label: "Адрес электронной почты",
    placeholder: "you@example.com",
    help: (min: number, codes: boolean) => codes
      ? `Пришлём ссылку для входа и шестизначный код. Они действуют ${min} ${ruMinutes(min)} и срабатывают один раз.`
      : `Пришлём ссылку для входа. Она действует ${min} ${ruMinutes(min)} и срабатывает один раз.`,
    cta: (codes: boolean) => (codes ? "Прислать ссылку и код" : "Прислать ссылку для входа"),
    sending: "Отправляем…",
    checkEmail: "Проверьте адрес почты",
    noAccess: "Нет доступа? Попросите главу семьи пригласить вас.",
    pkBusyTitle: "Подтвердите на устройстве",
    pkBusy: "Посмотрите в камеру или приложите палец. Окно подтверждения открыла система — не этот сайт.",
    cancel: "Отменить",
    pkFail: (codes: boolean) => `Не получилось войти с ключом доступа. Попробуйте ещё раз или войдите по ${codes ? "письму с кодом" : "ссылке из письма"}.`,
    retry: "Попробовать ещё раз",
    noPk: (codes: boolean) => `Это устройство не поддерживает вход по Face ID или Touch ID — войдите по ${codes ? "письму с кодом" : "ссылке из письма"}.`,
    sentTitle: "Проверьте почту",
    sent: (min: number, codes: boolean) => codes
      ? `Если у этого адреса есть доступ, письмо уже в пути. Проверьте «Входящие» и «Спам». Нажмите «Войти» в письме — или введите код ниже. Код действует ${min} ${ruMinutes(min)}.`
      : `Если у этого адреса есть доступ, письмо уже в пути. Проверьте «Входящие» и «Спам» и нажмите «Войти» в письме. Ссылка действует ${min} ${ruMinutes(min)}.`,
    codeLabel: "Код из письма",
    digit: (i: number) => `Цифра ${i} из 6`,
    codeCta: "Войти по коду",
    codeBusy: "Проверяем…",
    again: "Указать другой адрес",
    resend: "Прислать письмо ещё раз",
    ended: "Сеанс завершён. Так бывает, когда глава семьи закрывает открытые сеансы — например, после потери телефона. Войдите снова.",
    invalid: "Ссылка не сработала. Запросите новую здесь: в письме будут ссылка и код, а код можно ввести на этой странице.",
    expired: (min: number) => `Ссылка устарела — она действует ${min} ${ruMinutes(min)}. Запросите новую здесь.`,
    superseded: "Это не последняя ссылка — откройте самое новое письмо. Каждый новый запрос отменяет прежние ссылки и коды.",
    used: "Эта ссылка уже сработала — второй раз она не открывается. Если вы не вошли, запросите новую.",
    elsewhereTitle: "Ссылка открылась в другом браузере",
    elsewhere: "Вернитесь во вкладку, где запрашивали вход, и введите там код из письма — шесть цифр под кнопкой «Войти».",
    elsewhereNew: "Если та вкладка закрыта, запросите новое письмо здесь:",
    ctaHere: "Прислать новое письмо сюда",
    welcome: "Добро пожаловать",
    welcomeSub: "Открываем семейный кабинет…",
    codeErr: {
      wrong: (left: number) => `Код не подошёл. Осталось попыток: ${left}.`,
      locked: "Слишком много неверных попыток. Запросите новое письмо — в нём будет новый код.",
      superseded: "Это код из более раннего письма — откройте самое новое.",
      expired: "Код устарел. Запросите новое письмо.",
      used: "Этот код уже использован. Если вы не вошли, запросите новое письмо.",
      no_request: "В этом браузере нет запроса на вход. Введите код во вкладке, где запрашивали письмо, или запросите новое.",
      format: "Код — шесть цифр.",
      rate_limited: "Слишком много попыток. Подождите несколько минут и попробуйте снова.",
      other: "Не получилось проверить код. Войдите по ссылке из письма или запросите новое письмо.",
    },
  },
} as const;
const COPY_RU = typographDict(copy.ru); // QA-158 N5
type Copy = typeof copy.en | typeof COPY_RU;

type LinkState = "invalid" | "sent" | "ended" | "expired" | "elsewhere" | "superseded" | "used";

const ICON = {
  key: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3m-3 3 3 3m-6 0 2 2" /></svg>,
  mail: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  warn: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef9a9a" strokeWidth="2" aria-hidden="true"><path d="M12 3 2 21h20L12 3z" /><path d="M12 10v5M12 18h.01" /></svg>,
  info: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e0b76e" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></svg>,
  face: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e0b76e" strokeWidth="1.6" aria-hidden="true"><path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2" /><path d="M9 9v1M15 9v1M12 9v4h-1M9 16c1.6 1.3 4.4 1.3 6 0" /></svg>,
};

function Alert({ kind, children, ...rest }: { kind: "err" | "info"; children: React.ReactNode } & Record<`data-${string}`, string>) {
  return (
    <div className={`${s.alert} ${kind === "err" ? s.alertErr : s.alertInfo}`} role={kind === "err" ? "alert" : "status"} {...rest}>
      {kind === "err" ? ICON.warn : ICON.info}<span>{children}</span>
    </div>
  );
}

/** After a passkey or a code signs in: the crest and «Добро пожаловать», then the page the person came for. */
function goWelcome(setWelcome: (v: boolean) => void, to: string) {
  setWelcome(true);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(() => window.location.assign(to), reduce ? 0 : 1100);
}

export function FamilyGateNotice({
  lang,
  returnTo,
  state,
  ttlMinutes,
  passkeys = false,
  codes = false,
  langHrefs,
}: {
  /** Passkeys on (bus 98/100): the passkey button and autofill on the email field. */
  passkeys?: boolean;
  /** One-time codes on (bus 165; Family OS configured): the six-cell code after «Прислать ссылку и код». */
  codes?: boolean;
  lang: "en" | "ru";
  returnTo: string;
  /** Sign-in link lifetime, from FAMILY_LINK_TTL on the server (cycle 6 #2). */
  ttlMinutes: number;
  /** "sent" after a request; the rest name why a link did not sign in (bus 165), or an ended session. */
  state?: LinkState;
  /** RU / EN addresses of this same page (query kept); defaults to the bare sign-in page. */
  langHrefs?: Record<"en" | "ru", string>;
}) {
  const c: Copy = lang === "ru" ? COPY_RU : copy.en;
  const [pending, setPending] = useState(false);
  const [welcome, setWelcome] = useState(false);
  // Coming back with the browser's Back button restores the page from cache — un-stick the button.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const signinHref = `/${lang}/family/signin?returnTo=${encodeURIComponent(returnTo)}`;

  // Passkey sign-in (bus 98/100, R3): a visible button, plus the browser's autofill when it supports it. The button is
  // drawn from the first render when passkeys are on; a browser without WebAuthn gets «нет Face ID» after mount.
  const [pkOk, setPkOk] = useState(passkeys);
  const [pk, setPk] = useState<"idle" | "busy" | "fail">("idle");
  const pkSignIn = async (autofill: boolean) => {
    const post = (u: string, b: unknown = {}) => fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b), credentials: "same-origin", cache: "no-store" });
    try {
      if (!autofill) setPk("busy");
      const o = await post("/api/family-auth/passkey/options");
      if (!o.ok) throw new Error("options");
      const { options } = await o.json();
      const response = await startAuthentication({ optionsJSON: options, useBrowserAutofill: autofill });
      setPk("busy");
      const v = await post("/api/family-auth/passkey/verify", { response, returnTo });
      if (!v.ok) throw new Error("verify");
      goWelcome(setWelcome, ((await v.json()) as { returnTo: string }).returnTo);
    } catch (e) {
      // Autofill is a quiet offer: whatever ends it (replaced by the button, dismissed, or a browser with no usable key
      // at all — bus 109) says nothing. «Отменить» goes back quietly too. Only a failed press of the button reports.
      const aborted = e instanceof Error && (e.name === "AbortError" || /abort|cancel/i.test(e.message));
      if (!autofill) setPk(aborted ? "idle" : "fail");
      else setPk((p) => (p === "busy" ? "fail" : p));
    }
  };
  const cancelPk = () => {
    WebAuthnAbortService.cancelCeremony();
    setPk("idle");
  };
  useEffect(() => {
    if (!passkeys || state === "sent") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser capability, known only after mount
    setPkOk(browserSupportsWebAuthn());
    let live = true;
    browserSupportsWebAuthnAutofill().then((yes) => { if (yes && live) pkSignIn(true); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page
  }, [passkeys, state]);
  const pkFirst = passkeys && pkOk;

  // Arriving from "Use a different email": put the cursor in the field.
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.location.hash === EDIT_HASH) emailRef.current?.focus();
  }, []);
  const [emailBad, setEmailBad] = useState(false);

  const head = (title: string = c.heading, body: string | null = c.body) => (
    <>
      <div className={`${s.mcrest} ${s.masked}`}><CrestImg sizes="110px" /></div>
      <span className={s.eyebrow}>{c.eyebrow}</span>
      <h1>{title}</h1>
      {body !== null && <p className={s.lede}>{body}</p>}
    </>
  );

  const pkBlock = (retry = false) => (
    <div data-passkey-signin="" style={{ marginTop: retry ? 18 : 28 }}>
      <button type="button" onClick={() => pkSignIn(false)} className={`${s.btn} ${s.wide} ${s.gold} ${s.sheen}`}>
        {ICON.key}<span>{retry ? c.retry : c.pk}</span>
      </button>
      {!retry && <p className={s.hint}>{c.pkHint}</p>}
      <p className={s.or} aria-hidden="true">{codes ? c.orCode : c.orLink}</p>
    </div>
  );

  const emailForm = (primary: boolean, cta: string = c.cta(codes)) => (
    <form
      method="post"
      action="/api/family-auth/request"
      className={s.stack}
      noValidate
      onSubmit={(e) => {
        const v = emailRef.current?.value.trim() ?? "";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
          e.preventDefault();
          setEmailBad(true);
          emailRef.current?.focus();
          return;
        }
        try { sessionStorage.setItem(RESEND_KEY, v); } catch {}
        setPending(true);
      }}
      aria-busy={pending}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <div>
        <label htmlFor="family-email" className={s.label}>{c.label}</label>
        <input
          ref={emailRef}
          id="family-email"
          className={s.inp}
          aria-describedby={emailBad ? "family-email-err family-email-help" : "family-email-help"}
          aria-invalid={emailBad ? true : undefined}
          name="email"
          type="email"
          required
          autoComplete={passkeys ? "email webauthn" : "email"}
          spellCheck={false}
          placeholder={c.placeholder}
          onInput={() => emailBad && setEmailBad(false)}
        />
        {emailBad && <p id="family-email-err" className={`${s.msg} ${s.msgErr}`} role="alert">{c.checkEmail}</p>}
        <p id="family-email-help" className={s.help}>{c.help(ttlMinutes, codes)}</p>
      </div>
      <button type="submit" disabled={pending} className={`${s.btn} ${s.wide} ${primary ? `${s.gold} ${s.sheen}` : s.ghostFill}`}>
        {ICON.mail}<span>{pending ? c.sending : cta}</span>
      </button>
    </form>
  );
  const foot = <p className={s.note2}>{c.noAccess}</p>;

  let body: React.ReactNode;
  if (pk === "busy") {
    body = (
      <>
        {head(c.pkBusyTitle, null)}
        <div className={s.pk} role="status" aria-live="polite">
          <div className={s.ring}>{ICON.face}</div>
          <p className={s.lede} style={{ maxWidth: 340 }}>{c.pkBusy}</p>
          <button type="button" className={`${s.btn} ${s.wide} ${s.ghostFill}`} style={{ marginTop: 22, maxWidth: 220 }} onClick={cancelPk}>{c.cancel}</button>
        </div>
      </>
    );
  } else if (state === "sent") {
    body = (
      <>
        {head(c.sentTitle, null)}
        <p role="status" className={s.lede}>{c.sent(ttlMinutes, codes)}</p>
        {codes && <CodeForm c={c} returnTo={returnTo} onSuccess={(to) => goWelcome(setWelcome, to)} />}
        <div className={s.links}>
          <a className={s.acc} href={`${signinHref}${EDIT_HASH}`}>{c.again}</a>
          <Resend c={c} returnTo={returnTo} fallback={`${signinHref}${EDIT_HASH}`} />
        </div>
      </>
    );
  } else if (state === "elsewhere") {
    // bus 165: not an error — the link is fine, it just opened in another browser. Calm, and it never shows the code:
    // this page cannot know it, and must not be a way to read it.
    body = (
      <>
        {head(c.elsewhereTitle, null)}
        <p data-link-elsewhere="" role="status" className={s.lede}>{c.elsewhere}</p>
        <p className={s.help} style={{ marginTop: 22 }}>{c.elsewhereNew}</p>
        {emailForm(true, c.ctaHere)}
      </>
    );
  } else {
    const failed = state === "invalid" || state === "expired" || state === "superseded" || state === "used";
    body = (
      <>
        {head()}
        {state === "ended" && <Alert kind="info" data-session-ended="">{c.ended}</Alert>}
        {failed && (
          <Alert kind="err" data-link-failed={state}>
            {state === "expired" ? c.expired(ttlMinutes) : state === "superseded" ? c.superseded : state === "used" ? c.used : c.invalid}
          </Alert>
        )}
        {pk === "fail" && <Alert kind="err" data-passkey-failed="">{c.pkFail(codes)}</Alert>}
        {passkeys && !pkOk && <Alert kind="info" data-no-passkey="">{c.noPk(codes)}</Alert>}
        {/* The passkey is the main button when this browser can use one; the email (a link and a six-digit code) is the
            fallback below it. Without passkeys the email form is the main action. */}
        {pkFirst ? pkBlock(pk === "fail") : <div style={{ marginTop: 22 }} />}
        {emailForm(!pkFirst)}
        {foot}
      </>
    );
  }

  const L = lang === "ru";
  return (
    <div className={s.site}>
      <a className={s.skip} href="#main">{L ? "Перейти к содержимому" : "Skip to content"}</a>
      <CrestAuthHeader lang={lang} langHrefs={langHrefs ?? { ru: "/ru/family/signin", en: "/en/family/signin" }} back={c.back} />
      <div className={s.page}>
        <CrestAside label={c.aside} mottoTr={c.mottoTr} features={c.feat(codes)} />
        <main className={s.main} id="main" tabIndex={-1}>
          <div className={`${s.card} ${s.fade}`} key={`${state ?? "start"}-${pk}`}>{body}</div>
        </main>
      </div>
      {welcome && (
        <div className={s.welcome} role="status" aria-live="polite" data-welcome="">
          <div>
            <div className={s.masked}><CrestImg sizes="160px" /></div>
            <h2>{c.welcome}</h2>
            <p>{c.welcomeSub}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** «Прислать письмо ещё раз»: posts the address typed in this tab again; without one, back to the form. */
function Resend({ c, returnTo, fallback }: { c: Copy; returnTo: string; fallback: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage exists only in the browser
    try { setEmail(sessionStorage.getItem(RESEND_KEY)); } catch {}
  }, []);
  if (!email) return <Link href={fallback} prefetch={false}>{c.resend}</Link>;
  return (
    <form method="post" action="/api/family-auth/request" onSubmit={() => setBusy(true)} style={{ display: "contents" }}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="email" value={email} />
      <button type="submit" disabled={busy} data-resend="">{busy ? c.sending : c.resend}</button>
    </form>
  );
}

type CodeError = keyof Copy["codeErr"];

/**
 * bus 165: the code from the email. In the tab that asked, so it carries this browser's nonce cookie — whatever
 * browser the letter's button opens. Posts to the same /verify path as the link (one firewall rule).
 * bus 176: six cells (paste, ← →, Backspace, and the phone's one-time-code autofill into the first cell); the last
 * digit sends the code.
 */
function CodeForm({ c, returnTo, onSuccess }: { c: Copy; returnTo: string; onSuccess: (to: string) => void }) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ kind: CodeError; left?: number } | null>(null);
  const cells = useRef<(HTMLInputElement | null)[]>([]);
  const locked = err?.kind === "locked";
  useEffect(() => { cells.current[0]?.focus({ preventScroll: true }); }, []);

  const submit = async (code: string) => {
    if (busy) return;
    if (!/^[0-9]{6}$/.test(code)) return setErr({ kind: "format" });
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/family-auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, returnTo }),
        credentials: "same-origin",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; returnTo?: string; error?: string; left?: number };
      if (r.ok && j.ok && j.returnTo) return onSuccess(j.returnTo);
      const kind = (j.error && j.error in c.codeErr ? j.error : "other") as CodeError;
      setErr({ kind: kind === "wrong" && typeof j.left !== "number" ? "other" : kind, left: j.left });
      if (kind !== "locked") {
        setDigits(["", "", "", "", "", ""]);
        window.setTimeout(() => cells.current[0]?.focus(), 0);
      }
    } catch {
      setErr({ kind: "other" });
    }
    setBusy(false);
  };

  /** Put `text` (digits only) into the cells from `at`; send when all six are filled. */
  const fill = (at: number, text: string) => {
    const d = text.replace(/\D/g, "");
    const next = [...digits];
    if (!d) { next[at] = ""; setDigits(next); return; }
    for (let i = 0; i < d.length && at + i < 6; i++) next[at + i] = d[i];
    setDigits(next);
    const end = Math.min(at + d.length, 5);
    cells.current[next.every(Boolean) ? 5 : end]?.focus();
    if (next.every(Boolean)) void submit(next.join(""));
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      cells.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) cells.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 5) cells.current[i + 1]?.focus();
  };

  const msg = err ? (err.kind === "wrong" ? c.codeErr.wrong(err.left ?? 0) : c.codeErr[err.kind]) : "";
  const bad = err?.kind === "wrong" || locked;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(digits.join("")); }} data-signin-code="" style={{ marginTop: 26 }} aria-busy={busy}>
      <p className={s.label} id="family-code-label">{c.codeLabel}</p>
      <div className={`${s.otp} ${bad ? s.bad : ""}`} role="group" aria-labelledby="family-code-label" aria-describedby="family-code-msg">
        {digits.map((v, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i === 3 && <span className={s.dash} aria-hidden="true">–</span>}
            <input
              ref={(n) => { cells.current[i] = n; }}
              id={i === 0 ? "family-code" : undefined}
              name={i === 0 ? "code" : undefined}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={i === 0 ? 6 : 1}
              aria-label={c.digit(i + 1)}
              aria-invalid={bad ? true : undefined}
              disabled={locked}
              value={v}
              className={v ? s.f : undefined}
              onChange={(e) => fill(i, e.target.value)}
              onKeyDown={(e) => onKey(e, i)}
              onPaste={(e) => { const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (t) { e.preventDefault(); fill(i, t); } }}
              onFocus={(e) => e.target.select()}
            />
          </span>
        ))}
      </div>
      <p id="family-code-msg" role={err ? "alert" : undefined} aria-live="polite" className={`${s.msg} ${err ? s.msgErr : ""}`}>{msg}</p>
      <button type="submit" disabled={busy || locked} className={`${s.btn} ${s.wide} ${s.gold} ${s.sheen}`}>
        {busy ? c.codeBusy : c.codeCta}
      </button>
    </form>
  );
}
