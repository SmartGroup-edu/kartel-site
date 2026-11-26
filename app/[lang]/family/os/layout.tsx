import { notFound } from "next/navigation";
import { familyGateDecision, familyRole } from "@/app/lib/family-gate";
import { familyEnv } from "@/app/lib/family-env";
import { getOsState, getMyBoard } from "@/app/lib/family-os";
import { osDownNav } from "@/app/lib/family-os-down";
import { openTaskCount } from "@/app/lib/family-os-shell.mjs";
import FamilyOsShell, { type OsShellMe, type OsShellNav } from "@/app/components/FamilyOsShell";

/**
 * The Family OS shell around every /[lang]/family/os/* page (bus 171). Same gate as each page (the page still guards
 * itself); the gate answer and every Family OS read are shared with the page through React `cache` for this one
 * request, so the shell adds at most one read (/my-tasks, for the «Задачи» badge) on pages that do not already ask it.
 * Which sections exist is decided here, on the server, from the same rules as before (owner, editor, member).
 */
export const dynamic = "force-dynamic";

export default async function FamilyOsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "ru") notFound();
  if (!familyEnv.gateOn()) notFound();
  const { decision, session } = await familyGateDecision();
  if (decision !== "allow" || !session) notFound();
  const L = lang === "ru" ? "RU" : "EN";
  const role = familyRole(session.cpifSubjectId);
  const state = await getOsState(session);
  let nav: OsShellNav, me: OsShellMe, board = 0;
  if (state.status !== "ok") {
    // Family OS silent: the member sections all lead to the same calm «не отвечает» (QA-156 M7).
    const down = osDownNav(session.cpifSubjectId);
    nav = { admin: down.admin, editor: down.editor, os: true, member: true };
    me = { name: null, role: role === "owner" ? "owner" : role === "editor" ? "editor" : "member" };
  } else {
    nav = { admin: state.admin, editor: role === "editor", os: Boolean(state.me) || state.admin, member: Boolean(state.me) };
    me = {
      name: state.me ? (L === "EN" ? state.me.name_en : state.me.name_ru) : null,
      role: state.me?.kind === "child" ? "child" : role === "owner" ? "owner" : role === "editor" ? "editor" : "member",
    };
    if (state.me) board = openTaskCount(await getMyBoard(session));
  }
  return <FamilyOsShell lang={L} nav={nav} badges={{ board }} me={me}>{children}</FamilyOsShell>;
}
