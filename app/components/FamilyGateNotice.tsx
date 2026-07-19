/**
 * Non-PII fail-closed notice for the gated Family Heritage area (kartel-site).
 * Rendered by the page guard when a request is not an approved viewer. The edge
 * (proxy.ts) normally redirects first; this is the defense-in-depth fallback that
 * guarantees family PII is never rendered without an approved session.
 */

const copy = {
  en: {
    heading: "Members only",
    body: "The Family Heritage area requires sign-in and administrator approval.",
    cta: "Sign in",
  },
  ru: {
    heading: "Только для участников",
    body: "Раздел «Семейное наследие» доступен после входа и одобрения администратором.",
    cta: "Войти",
  },
} as const;

export function FamilyGateNotice({ lang, returnTo }: { lang: "en" | "ru"; returnTo: string }) {
  const c = copy[lang];
  return (
    <main style={{ maxWidth: "34rem", margin: "0 auto", padding: "6rem 1.5rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>{c.heading}</h1>
      <p style={{ lineHeight: 1.6, opacity: 0.8 }}>{c.body}</p>
      <p style={{ marginTop: "2rem" }}>
        <a
          href={`/api/family-auth/login?returnTo=${encodeURIComponent(returnTo)}`}
          style={{
            display: "inline-block",
            padding: "0.7rem 1.6rem",
            borderRadius: "0.5rem",
            background: "var(--accent, #7a5c2e)",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {c.cta}
        </a>
      </p>
    </main>
  );
}
