"use client";

/**
 * Non-PII fail-closed notice for the gated Family Heritage area (kartel-site).
 * Rendered by the page guard when a request is not an approved viewer. The edge
 * (proxy.ts) normally redirects first; this is the defense-in-depth fallback that
 * guarantees family PII is never rendered without an approved session.
 *
 * STANDALONE AUTH (R0 decision 2026-11-14): sign-in is an emailed link, not an OIDC bounce.
 * This posts an address to /api/family-auth/request, which answers identically whether or not
 * the address is on the allowlist — so this form must never confirm membership either.
 *
 * Design audit 2026-11-14 (#5, #15, #18, #19): site header/footer, tokens instead of inline
 * styles, designed states (hover, focus, pending/disabled), alert styling for an invalid link,
 * and a way out of the "sent" state.
 */

import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { startAuthentication, browserSupportsWebAuthn, browserSupportsWebAuthnAutofill } from "@simplewebauthn/browser";
import AuthShell from "./AuthShell";
import { H1, EYEBROW, PROSE } from "../lib/typeScale";
import { typographDict } from "../lib/typograph.mjs";

/** The main action and the fallback (mockup v5 sign-in: one filled button, the rest outlined). */
const BTN = "inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius)] px-6 text-base font-medium transition-colors disabled:cursor-wait disabled:opacity-60";
const BTN_FIRST = `${BTN} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]`;
const BTN_SECOND = `${BTN} border border-[var(--border)] bg-[var(--fos-panel)] text-[var(--foreground)] hover:border-[var(--accent)]`;

/** Hash the "different email" link carries back to the form, which then focuses the field. */
const EDIT_HASH = "#family-email";

/** 1 минуту · 2 минуты · 5 минут · 21 минуту — accusative after «действует». */
function ruMinutes(n: number): string {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return "минуту";
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "минуты";
  return "минут";
}

const copy = {
  en: {
    eyebrow: "Family area",
    heading: "Family sign-in",
    body: "Sign in to open the family area. Access is by invitation and the administrator's approval.",
    noAccess: "No access yet? Ask the head of the family to invite you.",
    orCode: "or by email, with a code", orLink: "or by an email link",
    asideLabel: "About the family area",
    asideBrand: "Family office",
    asideTitle: "Family and business, in one calm place.",
    asideBody: "Tasks, decisions, the calendar and the family's documents. What matters today, and who looks after what, at a glance.",
    asideFeatures: ["Sign in without a password", "For the family only", "Every link and code works once"],
    label: "Email address",
    placeholder: "you@example.com",
    cta: "Email me a sign-in link",
    or: "or", pk: "Sign in with a passkey", pkHint: "Face ID, Touch ID or a security key — if you have added one on this device.", pkBusy: "Confirm on your device…", pkFail: "Could not sign in with a passkey — use the email link.",
    sending: "Sending…",
    helper: (min: number) => `We'll email you a sign-in link and a six-digit code. Both work once and expire in ${min} ${min === 1 ? "minute" : "minutes"}.`,
    sentTitle: "Check your email",
    sent: (min: number) => `If that address may access this area, an email is on its way. Check your inbox and spam folder. Tap “Sign in” in the email, or type its code below. The link and the code expire in ${min} ${min === 1 ? "minute" : "minutes"}.`,
    again: "Use a different email",
    back: "Back to the home page",
    ended: "Your session was ended — this happens when the family's owner closes open sessions, for example after a lost phone. Please sign in again with an email link or a passkey.",
    invalid: () => "That link didn’t work. Ask for a new one here: the email will have a link and a code, and the code can be typed on this page.",
    expired: (min: number) => `That link has expired — a link works for ${min} ${min === 1 ? "minute" : "minutes"}. Ask for a new one here.`,
    superseded: () => "This isn’t the latest link — open the newest email. Each new request cancels the earlier links and codes.",
    used: () => "That link has already been used — it works only once. If you are not signed in, ask for a new one here.",
    elsewhereTitle: "This link opened in a different browser",
    elsewhere: () => "Go back to the tab where you asked to sign in and type the code from the email there — the six digits under the “Sign in” button.",
    elsewhereNew: "If that tab is closed, ask for a new link here:",
    ctaHere: "Email me a new link here",
    codeLabel: "Or type the code from the email",
    codeCta: "Sign in with the code",
    codeBusy: "Checking…",
    codeErr: {
      wrong: (left: number) => `That code didn’t match. Attempts left: ${left}.`,
      locked: "Too many wrong attempts. Ask for a new link — it comes with a new code.",
      superseded: "That code is from an earlier email — open the newest one.",
      expired: "That code has expired. Ask for a new link.",
      used: "That code has already been used. If you are not signed in, ask for a new link.",
      no_request: "This browser has no sign-in request. Type the code in the tab where you asked for the link, or ask for a new one.",
      format: "The code is six digits.",
      rate_limited: "Too many attempts. Wait a few minutes and try again.",
      other: "Couldn’t check the code. Use the link in the email, or ask for a new one.",
    },
  },
  ru: {
    eyebrow: "Семейный кабинет",
    heading: "Вход для семьи",
    body: "Войдите, чтобы открыть семейный кабинет. Доступ — по приглашению и после одобрения администратором.",
    noAccess: "Нет доступа? Попросите главу семьи пригласить вас.",
    orCode: "или по письму с кодом", orLink: "или по ссылке на почту",
    asideLabel: "О семейном кабинете",
    asideBrand: "Семейный офис",
    asideTitle: "Семья и бизнес — в одном спокойном месте.",
    asideBody: "Дела, решения, календарь и документы семьи. Сразу видно, что важно сегодня и кто за что отвечает.",
    asideFeatures: ["Вход без пароля", "Только для семьи", "Ссылка и код срабатывают один раз"],
    label: "Адрес электронной почты",
    placeholder: "you@example.com",
    cta: "Прислать ссылку для входа",
    or: "или", pk: "Войти с ключом доступа", pkHint: "Face ID, Touch ID или ключ безопасности — если ключ уже добавлен на этом устройстве.", pkBusy: "Подтверди на устройстве…", pkFail: "Не получилось войти с ключом — войди по ссылке из письма.",
    sending: "Отправляем…",
    helper: (min: number) => `Мы пришлём ссылку для входа и шестизначный код. Они действуют ${min} ${ruMinutes(min)} и срабатывают один раз.`,
    sentTitle: "Проверьте почту",
    sent: (min: number) => `Если у этого адреса есть доступ, письмо уже отправлено. Проверьте входящие и папку «Спам». Нажмите «Войти» в письме или введите код из него ниже. Ссылка и код действуют ${min} ${ruMinutes(min)}.`,
    again: "Указать другой адрес",
    back: "На главную",
    ended: "Сеанс завершён — так бывает, когда владелец семейного раздела закрывает открытые сеансы, например после потери телефона. Войдите снова по ссылке из письма или с ключом доступа.",
    invalid: () => "Ссылка не сработала. Запросите новую здесь: в письме будут ссылка и код, а код можно ввести на этой странице.",
    expired: (min: number) => `Ссылка устарела — она действует ${min} ${ruMinutes(min)}. Запросите новую здесь.`,
    superseded: () => "Это не последняя ссылка — откройте самое новое письмо. Каждый новый запрос отменяет прежние ссылки и коды.",
    used: () => "Эта ссылка уже сработала — второй раз она не открывается. Если вы не вошли, запросите новую здесь.",
    elsewhereTitle: "Эта ссылка открылась в другом браузере",
    elsewhere: () => "Вернитесь во вкладку, где запрашивали вход, и введите там код из письма — шесть цифр под кнопкой «Войти».",
    elsewhereNew: "Если та вкладка закрыта, запросите новую ссылку здесь:",
    ctaHere: "Запросить новую ссылку здесь",
    codeLabel: "Или введите код из письма",
    codeCta: "Войти по коду",
    codeBusy: "Проверяем…",
    codeErr: {
      wrong: (left: number) => `Код не подошёл. Осталось попыток: ${left}.`,
      locked: "Слишком много неверных попыток. Запросите новую ссылку — с ней придёт новый код.",
      superseded: "Это код из более раннего письма — откройте самое новое.",
      expired: "Код устарел. Запросите новую ссылку.",
      used: "Этот код уже использован. Если вы не вошли, запросите новую ссылку.",
      no_request: "В этом браузере нет запроса на вход. Введите код во вкладке, где запрашивали ссылку, или запросите новую.",
      format: "Код — шесть цифр.",
      rate_limited: "Слишком много попыток. Подождите несколько минут и попробуйте снова.",
      other: "Не получилось проверить код. Войдите по ссылке из письма или запросите новую.",
    },
  },
} as const;
const COPY_RU = typographDict(copy.ru); // QA-158 N5

export function FamilyGateNotice({
  lang,
  returnTo,
  state,
  ttlMinutes,
  passkeys = false,
  codes = false,
}: {
  /** Passkeys on (bus 98/100): the «Войти с ключом» button and autofill on the email field. */
  passkeys?: boolean;
  /** One-time codes on (bus 165; Family OS configured): the code field after «Прислать ссылку». */
  codes?: boolean;
  lang: "en" | "ru";
  returnTo: string;
  /** Sign-in link lifetime, from FAMILY_LINK_TTL on the server (cycle 6 #2). */
  ttlMinutes: number;
  /** "sent" after a request; the rest name why a link did not sign in (bus 165), or an ended session. */
  state?: "invalid" | "sent" | "ended" | "expired" | "elsewhere" | "superseded" | "used";
}) {
  const c = lang === "ru" ? COPY_RU : copy.en;
  const [pending, setPending] = useState(false);
  // Coming back with the browser's Back button restores the page from cache — un-stick the button.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const signinHref = `/${lang}/family/signin?returnTo=${encodeURIComponent(returnTo)}`;
  // Passkey sign-in (bus 98/100, R3): a visible button, plus the browser's autofill when it supports it.
  const [pkMsg, setPkMsg] = useState("");
  const [pkOk, setPkOk] = useState(false);
  const pkSignIn = async (autofill: boolean) => {
    const post = (u: string, b: unknown = {}) => fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b), credentials: "same-origin", cache: "no-store" });
    try {
      if (!autofill) setPkMsg(c.pkBusy);
      const o = await post("/api/family-auth/passkey/options");
      if (!o.ok) throw new Error("options");
      const { options } = await o.json();
      const response = await startAuthentication({ optionsJSON: options, useBrowserAutofill: autofill });
      setPkMsg(c.pkBusy);
      const v = await post("/api/family-auth/passkey/verify", { response, returnTo });
      if (!v.ok) throw new Error("verify");
      window.location.assign(((await v.json()) as { returnTo: string }).returnTo);
    } catch (e) {
      // Autofill is a quiet offer: whatever ends it (replaced by the button, dismissed, or a browser with no
      // usable key at all — bus 109) says nothing. Only a press of the button reports a failure.
      void e;
      if (!autofill) setPkMsg(c.pkFail);
    }
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

  return (
    <AuthShell lang={lang} aside={<SignInAside c={c} />}>
      <p className={EYEBROW}>{c.eyebrow}</p>

      {state === "sent" ? (
        <>
          <h1 className={`mt-2 ${H1}`}>{c.sentTitle}</h1>
          <p role="status" className={`mt-4 ${PROSE}`}>
            {c.sent(ttlMinutes)}
          </p>
          {codes && <CodeForm c={c} returnTo={returnTo} />}
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
            <a href={`${signinHref}${EDIT_HASH}`} className="inline-flex min-h-11 items-center rounded-sm text-[var(--accent)] hover:text-[var(--accent-hover)]">
              {c.again}
            </a>
            <a href={`/${lang}`} className="inline-flex min-h-11 items-center rounded-sm text-[var(--text-nav)] hover:text-[var(--accent)]">
              ← {c.back}
            </a>
          </div>
        </>
      ) : (
        <>
          {state === "elsewhere" ? (
            <>
              {/* bus 165: not an error — the link is fine, it just opened in another browser. Calm, and it never
                  shows the code: this page cannot know it, and must not be a way to read it. */}
              <h1 className={`mt-2 ${H1}`}>{c.elsewhereTitle}</h1>
              <p data-link-elsewhere="" role="status" className={`mt-4 ${PROSE}`}>{c.elsewhere()}</p>
              <p className="mt-6 text-[15px] text-[var(--muted)]">{c.elsewhereNew}</p>
            </>
          ) : (
            <>
              <h1 className={`mt-2 ${H1}`}>{c.heading}</h1>
              <p className={`mt-4 ${PROSE}`}>{c.body}</p>
            </>
          )}

          {state === "ended" && (
            <p data-session-ended="" role="status" className="mt-6 rounded-lg border border-[var(--border)] px-4 py-3 text-[15px] text-[var(--foreground)]">
              {c.ended}
            </p>
          )}

          {(state === "invalid" || state === "expired" || state === "superseded" || state === "used") && (
            <p
              data-link-failed={state}
              role="alert"
              className="mt-6 rounded-lg border border-[var(--destructive)] px-4 py-3 text-[15px] text-[var(--foreground)]"
            >
              {state === "expired" ? c.expired(ttlMinutes) : state === "superseded" ? c.superseded() : state === "used" ? c.used() : c.invalid()}
            </p>
          )}

          {/* bus 172 P5 (mockup v5): the passkey is the main button when this browser can use one; the email — a link
              and a six-digit code — is the fallback below it. Without passkeys the email form is the main action. */}
          {pkFirst && (
            <div data-passkey-signin="" className="mt-8">
              <button type="button" onClick={() => pkSignIn(false)} className={`w-full ${BTN_FIRST}`}>
                <KeyRound aria-hidden="true" className="h-[18px] w-[18px]" />
                {c.pk}
              </button>
              <p className="mt-2 text-center text-[14px] leading-relaxed text-[var(--muted)]">{c.pkHint}</p>
              <p role="status" aria-live="polite" className="mt-2 text-[15px] text-[var(--foreground)]">{pkMsg}</p>
              <p className="my-5 flex items-center gap-3 text-[14px] text-[var(--muted)]" aria-hidden="true"><span className="h-px flex-1 bg-[var(--border)]" />{codes ? c.orCode : c.orLink}<span className="h-px flex-1 bg-[var(--border)]" /></p>
            </div>
          )}

          <form
            method="post"
            action="/api/family-auth/request"
            className={`${pkFirst ? "mt-0" : "mt-8"} flex flex-col gap-3`}
            onSubmit={() => setPending(true)}
            aria-busy={pending}
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <label htmlFor="family-email" className="text-[15px] font-medium text-[var(--foreground)]">
              {c.label}
            </label>
            <input
              ref={emailRef}
              id="family-email"
              aria-describedby="family-email-help"
              name="email"
              type="email"
              required
              autoComplete={passkeys ? "email webauthn" : "email"}
              spellCheck={false}
              placeholder={c.placeholder}
              className="h-12 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 text-base text-[var(--foreground)] placeholder:text-[var(--muted-light)] transition-colors hover:border-[var(--muted)]"
            />
            <p id="family-email-help" className="-mt-1 text-[14px] leading-relaxed text-[var(--muted)]">
              {c.helper(ttlMinutes)}
            </p>
            <button
              type="submit"
              disabled={pending}
              className={pkFirst ? BTN_SECOND : BTN_FIRST}
            >
              {pending ? c.sending : state === "elsewhere" ? c.ctaHere : c.cta}
            </button>
          </form>

          <p className="mt-6 text-[14px] leading-relaxed text-[var(--muted)]">{c.noAccess}</p>

          <p className="mt-8 text-[15px]">
            <a href={`/${lang}`} className="inline-flex min-h-11 items-center rounded-sm text-[var(--text-nav)] hover:text-[var(--accent)]">
              ← {c.back}
            </a>
          </p>
        </>
      )}
    </AuthShell>
  );
}

type Copy = typeof copy.en | typeof COPY_RU;

/** The left panel of the v5 sign-in, from 900 px: what the family area is. Words only — no names, figures or tasks. */
function SignInAside({ c }: { c: Copy }) {
  return (
    <aside
      aria-label={c.asideLabel}
      className="hidden flex-col rounded-[var(--fos-radius)] bg-gradient-to-br from-[var(--fos-brief-from)] to-[var(--fos-brief-to)] p-10 text-[var(--fos-brief-text)] min-[900px]:flex lg:p-12"
    >
      <p className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-[10px] border border-current font-serif text-[17px] font-semibold">K</span>
        <span className="flex flex-col leading-tight"><b className="tracking-[0.14em] text-[14px]">KARTEL</b><span className="text-[14px]">{c.asideBrand}</span></span>
      </p>
      <p className="mt-auto max-w-[30rem] pt-16 font-serif text-[40px] font-semibold leading-[1.05] tracking-[-0.015em] lg:text-[46px]">{c.asideTitle}</p>
      <p className="mt-4 max-w-[28rem] text-[16px] leading-[1.5]">{c.asideBody}</p>
      <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
        {c.asideFeatures.map((f) => (
          <li key={f} className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--fos-brief-ring)]" />{f}</li>
        ))}
      </ul>
    </aside>
  );
}
type CodeError = keyof Copy["codeErr"];

/**
 * bus 165: «Или введите код из письма». In the tab that asked, so it carries this browser's nonce cookie —
 * whatever browser the letter's button opens. Posts to the same /verify path as the link (one firewall rule).
 */
function CodeForm({ c, returnTo }: { c: Copy; returnTo: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ kind: CodeError; left?: number } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(code.replace(/\D/g, ""))) return setErr({ kind: "format" });
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
      if (r.ok && j.ok && j.returnTo) return window.location.assign(j.returnTo);
      const kind = (j.error && j.error in c.codeErr ? j.error : "other") as CodeError;
      setErr({ kind: kind === "wrong" && typeof j.left !== "number" ? "other" : kind, left: j.left });
    } catch {
      setErr({ kind: "other" });
    }
    setBusy(false);
  };
  const msg = err ? (err.kind === "wrong" ? c.codeErr.wrong(err.left ?? 0) : c.codeErr[err.kind]) : "";
  return (
    <form onSubmit={submit} data-signin-code="" className="mt-8 flex flex-col gap-3" aria-busy={busy}>
      <label htmlFor="family-code" className="text-[15px] font-medium text-[var(--foreground)]">
        {c.codeLabel}
      </label>
      <input
        id="family-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-invalid={err ? true : undefined}
        aria-describedby="family-code-msg"
        className="h-12 w-full max-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 text-lg tracking-[0.3em] tabular-nums text-[var(--foreground)] transition-colors hover:border-[var(--muted)]"
      />
      <p id="family-code-msg" role={err ? "alert" : undefined} aria-live="polite" className="min-h-[1.5em] text-[15px] text-[var(--foreground)]">
        {msg}
      </p>
      <button
        type="submit"
        disabled={busy}
        className={BTN_FIRST}
      >
        {busy ? c.codeBusy : c.codeCta}
      </button>
    </form>
  );
}
