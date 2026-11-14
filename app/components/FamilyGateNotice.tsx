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

import { useEffect, useState } from "react";
import AuthShell from "./AuthShell";

const copy = {
  en: {
    eyebrow: "Family Heritage",
    heading: "Members only",
    body: "The Family Heritage area requires sign-in and administrator approval.",
    label: "Email address",
    placeholder: "you@example.com",
    cta: "Email me a sign-in link",
    sending: "Sending…",
    sentTitle: "Check your email",
    sent: "If that address may access this area, a sign-in link is on its way. It expires in 10 minutes and only works in this browser.",
    again: "Use a different address",
    back: "Back to KARTEL",
    invalid: "That link is no longer valid. Request a new one below.",
  },
  ru: {
    eyebrow: "Семейное наследие",
    heading: "Только для участников",
    body: "Раздел «Семейное наследие» доступен после входа и одобрения администратором.",
    label: "Адрес электронной почты",
    placeholder: "you@example.com",
    cta: "Прислать ссылку для входа",
    sending: "Отправляем…",
    sentTitle: "Проверьте почту",
    sent: "Если у этого адреса есть доступ, ссылка уже отправлена. Она действует 10 минут и работает только в этом браузере.",
    again: "Указать другой адрес",
    back: "Вернуться на KARTEL",
    invalid: "Ссылка больше недействительна. Запросите новую ниже.",
  },
} as const;

export function FamilyGateNotice({
  lang,
  returnTo,
  state,
}: {
  lang: "en" | "ru";
  returnTo: string;
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

  return (
    <AuthShell lang={lang}>
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">{c.eyebrow}</p>

      {state === "sent" ? (
        <>
          <h1 className="mt-2 font-serif text-3xl text-[var(--foreground)]">{c.sentTitle}</h1>
          <p role="status" className="mt-3 text-base leading-relaxed text-[var(--text-body)]">
            {c.sent}
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href={signinHref} className="rounded-sm py-1 text-[var(--accent)] hover:text-[var(--accent-hover)]">
              {c.again}
            </a>
            <a href={`/${lang}`} className="rounded-sm py-1 text-[var(--text-nav)] hover:text-[var(--accent)]">
              ← {c.back}
            </a>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-2 font-serif text-3xl text-[var(--foreground)]">{c.heading}</h1>
          <p className="mt-3 text-base leading-relaxed text-[var(--text-body)]">{c.body}</p>

          {state === "invalid" && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-[var(--destructive)] px-4 py-3 text-sm text-[var(--foreground)]"
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
            <label htmlFor="family-email" className="text-sm font-medium text-[var(--foreground)]">
              {c.label}
            </label>
            <input
              id="family-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              spellCheck={false}
              placeholder={c.placeholder}
              className="h-12 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 text-base text-[var(--foreground)] placeholder:text-[var(--muted-light)] transition-colors hover:border-[var(--muted)]"
            />
            <button
              type="submit"
              disabled={pending}
              className="h-12 rounded-lg bg-[var(--accent)] px-6 text-base font-medium text-[var(--on-accent)] transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? c.sending : c.cta}
            </button>
          </form>

          <p className="mt-8 text-sm">
            <a href={`/${lang}`} className="rounded-sm py-1 text-[var(--text-nav)] hover:text-[var(--accent)]">
              ← {c.back}
            </a>
          </p>
        </>
      )}
    </AuthShell>
  );
}
