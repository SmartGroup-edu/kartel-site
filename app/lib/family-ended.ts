// Go-live R1: when the owner has ended this person's sessions, the site has already cleared its cookie (the
// family-os proxy did it on `session_ended`). Send the browser to the sign-in page with one calm message.
export const ENDED_PARAM = "family_auth=ended";

export function endedHref(pathname: string): string {
  const lang = pathname.startsWith("/en") ? "en" : "ru";
  return `/${lang}/family/signin?${ENDED_PARAM}&returnTo=${encodeURIComponent(pathname)}`;
}

/** Pass-through for a family-os fetch: on 401 session_ended, go to sign-in. Returns the response unchanged. */
export async function checkEnded<T extends Response | null>(r: T): Promise<T> {
  if (r && r.status === 401 && typeof window !== "undefined") {
    const b = (await r.clone().json().catch(() => null)) as { error?: string } | null;
    if (b?.error === "session_ended") window.location.assign(endedHref(window.location.pathname));
  }
  return r;
}
