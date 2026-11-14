/**
 * Non-PII fail-closed notice for the gated Family Heritage area (kartel-site).
 * Rendered by the page guard when a request is not an approved viewer. The edge
 * (proxy.ts) normally redirects first; this is the defense-in-depth fallback that
 * guarantees family PII is never rendered without an approved session.
 *
 * STANDALONE AUTH (R0 decision 2026-11-14): sign-in is an emailed link, not an OIDC bounce.
 * This posts an address to /api/family-auth/request, which answers identically whether or not
 * the address is on the allowlist — so this form must never confirm membership either.
 */

const copy = {
  en: {
    heading: "Members only",
    body: "The Family Heritage area requires sign-in and administrator approval.",
    label: "Email address",
    cta: "Email me a sign-in link",
    sent: "If that address may access this area, a sign-in link is on its way. It expires in 10 minutes and only works in this browser.",
    invalid: "That link is no longer valid. Request a new one below.",
  },
  ru: {
    heading: "Только для участников",
    body: "Раздел «Семейное наследие» доступен после входа и одобрения администратором.",
    label: "Адрес электронной почты",
    cta: "Прислать ссылку для входа",
    sent: "Если у этого адреса есть доступ, ссылка уже отправлена. Она действует 10 минут и работает только в этом браузере.",
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
  return (
    <main style={{ maxWidth: "34rem", margin: "0 auto", padding: "6rem 1.5rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>{c.heading}</h1>
      <p style={{ lineHeight: 1.6, opacity: 0.8 }}>{c.body}</p>

      {state === "sent" ? (
        <p style={{ marginTop: "2rem", lineHeight: 1.6 }}>{c.sent}</p>
      ) : (
        <>
          {state === "invalid" && (
            <p style={{ marginTop: "1.5rem", lineHeight: 1.6, opacity: 0.9 }}>{c.invalid}</p>
          )}
          <form
            method="post"
            action="/api/family-auth/request"
            style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <label htmlFor="family-email" style={{ fontSize: "0.9rem", opacity: 0.8 }}>
              {c.label}
            </label>
            <input
              id="family-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              spellCheck={false}
              style={{
                padding: "0.7rem 0.9rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--line, #d8d4c8)",
                fontSize: "1rem",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "0.7rem 1.6rem",
                borderRadius: "0.5rem",
                background: "var(--accent, #7a5c2e)",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              {c.cta}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
