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
import AuthShell from "./AuthShell";
import { H1, EYEBROW, PROSE } from "../lib/typeScale";

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
    sending: "Sending…",
    helper: (min: number) => `We'll email you a one-time sign-in link. It works once, only in this browser, and expires in ${min} ${min === 1 ? "minute" : "minutes"}.`,
    sentTitle: "Check your email",
    sent: (min: number) => `If that address may access this area, a sign-in link is on its way. Check your inbox and spam folder. The link works once, only in this browser, and expires in ${min} ${min === 1 ? "minute" : "minutes"}.`,
    again: "Use a different email",
    back: "Back to the coat of arms",
    invalid: "That link didn’t work. A link works for 10 minutes, only in the browser where you asked for it, and only the latest one counts. Ask for a new one here, then open the email on this same device.",
  },
  ru: {
    eyebrow: "Семейное наследие",
    heading: "Только для участников",
    body: "Раздел «Семейное наследие» доступен после входа и одобрения администратором.",
    label: "Адрес электронной почты",
    placeholder: "you@example.com",
    cta: "Прислать ссылку для входа",
    sending: "Отправляем…",
    helper: (min: number) => `Мы пришлём одноразовую ссылку для входа. Она действует ${min} ${ruMinutes(min)}, срабатывает один раз и только в этом браузере.`,
    sentTitle: "Проверьте почту",
    sent: (min: number) => `Если у этого адреса есть доступ, ссылка уже отправлена. Проверьте входящие и папку «Спам». Ссылка действует ${min} ${ruMinutes(min)}, срабатывает один раз и только в этом браузере.`,
    again: "Указать другой адрес",
    back: "К гербу",
    invalid: "Ссылка не сработала. Она действует 10 минут, только в том браузере, где её запросили, и только самая последняя. Запросите новую здесь и откройте письмо на этом же устройстве.",
  },
} as const;

export function FamilyGateNotice({
  lang,
  returnTo,
  state,
  ttlMinutes,
}: {
  lang: "en" | "ru";
  returnTo: string;
  /** Sign-in link lifetime, from FAMILY_LINK_TTL on the server (cycle 6 #2). */
  ttlMinutes: number;
  /** "invalid" after a failed or expired link; "sent" after a request. */
  state?: "invalid" | "sent";
}) {
  const c = copy[lang];
  const [pending, setPending] = useState(false);
  // Coming back with the browser's Back button restores the page from cache — un-stick the button.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const signinHref = `/${lang}/family/signin?returnTo=${encodeURIComponent(returnTo)}`;
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

          {state === "invalid" && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-[var(--destructive)] px-4 py-3 text-[15px] text-[var(--foreground)]"
            >
              {c.invalid}
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
              autoComplete="email"
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
