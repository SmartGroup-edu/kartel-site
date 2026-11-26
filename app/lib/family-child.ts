import "server-only";
import { redirect } from "next/navigation";

/**
 * bus 172 P3: a child's Family OS is «Мой день» and «Календарь» — the menu (osShellNav `child`) and the pages agree.
 * Every other Family OS page calls this before it renders anything: a child is sent back to «Мой день», on the server,
 * before the page asks Family OS for its data, so no family board, decision, person list, Кодекс or access screen is read
 * or rendered for them.
 * `own`: the page is the child's own person page (their passkeys and letters), which stays open to them.
 */
export function childHome(lang: string, me: { id: string; kind: string } | null | undefined, own = false): void {
  if (me?.kind === "child" && !own) redirect(`/${lang === "en" ? "en" : "ru"}/family/os`);
}
