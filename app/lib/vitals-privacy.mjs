// bus 176c (R0 2026-11-27): Vercel Speed Insights and Web Analytics may send the route pattern and nothing more of the
// address. Their scripts report the full href by default, which in the family area carries ids
// (/ru/family/os/people/<uuid>), dates and sign-in parameters (?returnTo=, ?sent=). Both get this as `beforeSend`:
// the query and the hash are dropped; the path becomes the route pattern when the SDK knows it, otherwise every
// segment that could identify a person or a token becomes [id], and anything under /family is cut to its first
// level (/[lang]/family/os/[...]).

const ID_LIKE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|.*\d.*|[A-Za-z0-9_-]{20,})$/i;

export function redactPath(pathname) {
  const parts = pathname.split("/").filter(Boolean).map((s) => (ID_LIKE.test(s) ? "[id]" : s));
  const fam = parts.indexOf("family");
  const kept = fam >= 0 && parts.length > fam + 2 ? [...parts.slice(0, fam + 2), "[...]"] : parts;
  return "/" + kept.join("/");
}

export function redactVitalsUrl(url, route) {
  try {
    const u = new URL(url);
    const path = typeof route === "string" && route.startsWith("/") ? route : redactPath(u.pathname);
    return u.origin + path;
  } catch {
    return null;
  }
}

// The beforeSend for both SDKs: a rewritten event, or null (the event is dropped) when the URL cannot be parsed.
export function vitalsBeforeSend(event) {
  const url = redactVitalsUrl(event.url, event.route);
  return url ? { ...event, url } : null;
}
