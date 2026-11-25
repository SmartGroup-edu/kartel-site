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
import { startAuthentication, browserSupportsWebAuthn, browserSupportsWebAuthnAutofill } from "@simplewebauthn/browser";
import AuthShell from "./AuthShell";
import { H1, EYEBROW, PROSE } from "../lib/typeScale";
import { typographDict } from "../lib/typograph.mjs";

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
    eyebrow: "Family Heritage",
    heading: "Members only",
    body: "The Family Heritage area requires sign-in and administrator approval.",
    label: "Email address",
    placeholder: "you@example.com",
    cta: "Email me a sign-in link",
    or: "or", pk: "Sign in with a passkey", pkHint: "Face ID, Touch ID or a security key — if you have added one on this device.", pkBusy: "Confirm on your device…", pkFail: "Could not sign in with a passkey — use the email link.",
    sending: "Sending…",
    helper: (min: number) => `We'll email you a one-time sign-in link. It works once, only in this browser, and expires in ${min} ${min === 1 ? "minute" : "minutes"}.`,
    sentTitle: "Check your email",
    sent: (min: number) => `If that address may access this area, a sign-in link is on its way. Check your inbox and spam folder. The link works once, only in this browser, and expires in ${min} ${min === 1 ? "minute" : "minutes"}.`,
    again: "Use a different email",
    back: "Back to the coat of arms",
    ended: "Your session was ended — this happens when the family's owner closes open sessions, for example after a lost phone. Please sign in again with an email link or a passkey.",
    invalid: (min: number) => `That link didn’t work. A link works for ${min} ${min === 1 ? "minute" : "minutes"}, only in the browser where you asked for it, and only the latest one counts. Ask for a new one here, then open the email on this same device.`,
  },
  ru: {
    eyebrow: "Семейное наследие",
    heading: "Только для участников",
    body: "Раздел «Семейное наследие» доступен после входа и одобрения администратором.",
    label: "Адрес электронной почты",
    placeholder: "you@example.com",
    cta: "Прислать ссылку для входа",
    or: "или", pk: "Войти с ключом доступа", pkHint: "Face ID, Touch ID или ключ безопасности — если ключ уже добавлен на этом устройстве.", pkBusy: "Подтверди на устройстве…", pkFail: "Не получилось войти с ключом — войди по ссылке из письма.",
    sending: "Отправляем…",
    helper: (min: number) => `Мы пришлём одноразовую ссылку для входа. Она действует ${min} ${ruMinutes(min)}, срабатывает один раз и только в этом браузере.`,
    sentTitle: "Проверьте почту",
    sent: (min: number) => `Если у этого адреса есть доступ, ссылка уже отправлена. Проверьте входящие и папку «Спам». Ссылка действует ${min} ${ruMinutes(min)}, срабатывает один раз и только в этом браузере.`,
    again: "Указать другой адрес",
    back: "К гербу",
    ended: "Сеанс завершён — так бывает, когда владелец семейного раздела закрывает открытые сеансы, например после потери телефона. Войдите снова по ссылке из письма или с ключом доступа.",
    invalid: (min: number) => `Ссылка не сработала. Она действует ${min} ${ruMinutes(min)}, только в том браузере, где её запросили, и только самая последняя. Запросите новую здесь и откройте письмо на этом же устройстве.`,
  },
} as const;
const COPY_RU = typographDict(copy.ru); // QA-158 N5

export function FamilyGateNotice({
  lang,
  returnTo,
  state,
  ttlMinutes,
  passkeys = false,
}: {
  /** Passkeys on (bus 98/100): the «Войти с ключом» button and autofill on the email field. */
  passkeys?: boolean;
  lang: "en" | "ru";
  returnTo: string;
  /** Sign-in link lifetime, from FAMILY_LINK_TTL on the server (cycle 6 #2). */
  ttlMinutes: number;
  /** "invalid" after a failed or expired link; "sent" after a request. */
  state?: "invalid" | "sent" | "ended";
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
  // Arriving from "Use a different email": put the cursor in the field.
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.location.hash === EDIT_HASH) emailRef.current?.focus();
  }, []);

  return (
    <AuthShell lang={lang}>
      <p className={EYEBROW}>{c.eyebrow}</p>

      {state === "sent" ? (
        <>
          <h1 className={`mt-2 ${H1}`}>{c.sentTitle}</h1>
          <p role="status" className={`mt-4 ${PROSE}`}>
            {c.sent(ttlMinutes)}
          </p>
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
          <h1 className={`mt-2 ${H1}`}>{c.heading}</h1>
          <p className={`mt-4 ${PROSE}`}>{c.body}</p>

          {state === "ended" && (
            <p data-session-ended="" role="status" className="mt-6 rounded-lg border border-[var(--border)] px-4 py-3 text-[15px] text-[var(--foreground)]">
              {c.ended}
            </p>
          )}

          {state === "invalid" && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-[var(--destructive)] px-4 py-3 text-[15px] text-[var(--foreground)]"
            >
              {c.invalid(ttlMinutes)}
            </p>
          )}

          <form
            method="post"
            action="/api/family-auth/request"
            className="mt-8 flex flex-col gap-3"
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
              className="h-12 rounded-lg bg-[var(--accent)] px-6 text-base font-medium text-[var(--on-accent)] transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? c.sending : c.cta}
            </button>
          </form>

          {passkeys && pkOk && (
            <div data-passkey-signin="" className="mt-6">
              <p className="flex items-center gap-3 text-[14px] text-[var(--muted)]" aria-hidden="true"><span className="h-px flex-1 bg-[var(--border)]" />{c.or}<span className="h-px flex-1 bg-[var(--border)]" /></p>
              <button type="button" onClick={() => pkSignIn(false)} className="mt-4 h-12 w-full rounded-lg border border-[var(--accent)] px-6 text-base font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/5">{c.pk}</button>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">{c.pkHint}</p>
              <p role="status" aria-live="polite" className="mt-2 text-[15px] text-[var(--foreground)]">{pkMsg}</p>
            </div>
          )}

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
