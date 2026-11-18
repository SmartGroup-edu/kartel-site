import "server-only";
/**
 * Server-side client for kartel-family-os (family-os/ in this repo, Hetzner app-01).
 *
 * DORMANT unless FAMILY_OS_URL and FAMILY_OS_SECRET are both set. Every call is HMAC-signed with the
 * same scheme as family-media (app/lib/media-signature.mjs) and carries the actor as
 * "admin:<email>" or "member:<email>" — the service authorises on that, so only this server can say
 * who is asking. Optional Cloudflare Access service token: FAMILY_OS_ACCESS_CLIENT_ID / _SECRET.
 */
import { signMediaRequest } from "@/app/lib/media-signature.mjs";
import { isFamilyAdmin } from "@/app/lib/family-gate";

export type OsPerson = { id: string; name_en: string; name_ru: string; kind: "adult" | "child"; email?: string };
export type OsScope = "routines" | "health" | "education" | "documents";
export type OsGrant = { id: string; guardian_id: string; child_id: string; relation: "parent" | "relative"; scopes: OsScope[] };
export type OsState =
  | { status: "off" }
  | { status: "error" }
  | { status: "ok"; admin: boolean; me: Omit<OsPerson, "email"> | null; people: OsPerson[]; grants: OsGrant[] };

export function osEnabled(): boolean {
  return Boolean(process.env.FAMILY_OS_URL && process.env.FAMILY_OS_SECRET);
}

export function osActor(session: { email?: string | null; cpifSubjectId: string }): string {
  const email = (session.email ?? session.cpifSubjectId).toLowerCase();
  return `${isFamilyAdmin(session.cpifSubjectId) ? "admin" : "member"}:${email}`;
}

function accessHeaders(): Record<string, string> {
  const id = process.env.FAMILY_OS_ACCESS_CLIENT_ID, secret = process.env.FAMILY_OS_ACCESS_CLIENT_SECRET;
  return id && secret ? { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret } : {};
}

export async function osCall(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, actor: string, body?: unknown) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const headers = await signMediaRequest({ secret: process.env.FAMILY_OS_SECRET!, method, path, actor, body: raw });
  return fetch(new URL(path, process.env.FAMILY_OS_URL), {
    method,
    headers: { ...headers, ...accessHeaders(), ...(raw ? { "content-type": "application/json" } : {}) },
    body: raw || undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
}

/** Who I am and who is in the family. Never throws: the page shows a calm error state instead. */
export async function getOsState(session: { email?: string | null; cpifSubjectId: string }): Promise<OsState> {
  if (!osEnabled()) return { status: "off" };
  const actor = osActor(session);
  try {
    const meRes = await osCall("GET", "/me", actor);
    if (!meRes.ok) return { status: "error" };
    const { me, admin } = (await meRes.json()) as { me: OsPerson | null; admin: boolean };
    if (!me && !admin) return { status: "ok", admin, me: null, people: [], grants: [] };
    const pRes = await osCall("GET", "/people", actor);
    if (!pRes.ok) return { status: "error" };
    const { people, grants } = (await pRes.json()) as { people: OsPerson[]; grants: OsGrant[] };
    return { status: "ok", admin, me, people, grants };
  } catch {
    return { status: "error" };
  }
}

/** For pages outside Family OS (heritage, editor): is the viewer in Family OS? Fail-soft: false. */
export async function getOsNav(session: { email?: string | null; cpifSubjectId: string }): Promise<{ os: boolean; member: boolean }> {
  if (!osEnabled()) return { os: false, member: false };
  try {
    const r = await osCall("GET", "/me", osActor(session));
    if (!r.ok) return { os: false, member: false };
    const { me, admin } = (await r.json()) as { me: unknown; admin: boolean };
    return { os: Boolean(me) || admin, member: Boolean(me) };
  } catch { return { os: false, member: false }; }
}

// ---- Stage 2a: profiles and documents ---------------------------------------------------------
export type OsDocFile = { id: string; mime: string; size: number; name: string };
export type OsDocument = {
  id: string; type: "passport" | "national_id" | "ni_number" | "residence" | "other"; country: string | null;
  issue_date: string | null; expiry_date: string | null; number_hint: string | null; has_number: boolean; has_pcode: boolean;
  fields: { authority?: string; holder?: string; birth_date?: string | null; birth_place?: string; sex?: string; nationality?: string };
  files: OsDocFile[];
};
export type OsProfile = {
  person: { id: string; name_en: string; name_ru: string; kind: "adult" | "child"; birth_date?: string | null };
  guardians: { guardian_id: string; relation: "parent" | "relative"; scopes: OsScope[] }[];
  can: { documents: boolean; add_documents: boolean; retype_documents: boolean; routines: OsRoutineAccess; prefs?: boolean; notes?: ("health" | "education")[]; goals?: boolean; ics?: boolean };
};
export type OsReminder = { id: string; person_id: string; type: OsDocument["type"]; country: string | null; expiry_date: string; days_left: number; tier: "expired" | "lt3" | "lt6" | "lt12" | null };

async function getJson<T>(path: string, actor: string): Promise<T | null> {
  const r = await osCall("GET", path, actor);
  return r.ok ? ((await r.json()) as T) : null;
}

/** Person page data. null = not found / no access / service down (the page says so calmly). */
export async function getPersonPage(session: { email?: string | null; cpifSubjectId: string }, id: string) {
  if (!osEnabled() || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const actor = osActor(session);
  try {
    const profile = await getJson<OsProfile>(`/people/${id}`, actor);
    if (!profile) return null;
    const [docs, routines, prefs, pauses, goals, notes, ics] = await Promise.all([
      profile.can.documents ? getJson<{ documents: OsDocument[] }>(`/people/${id}/documents`, actor) : null,
      profile.can.routines?.read ? getJson<OsRoutines>(`/people/${id}/routines?days=7`, actor) : null,
      profile.can.prefs ? getJson<{ prefs: OsPrefs }>(`/people/${id}/prefs`, actor) : null,
      profile.can.prefs ? getJson<{ pauses: OsPause[] }>(`/people/${id}/pauses`, actor) : null,
      getJson<OsGoals>(`/people/${id}/goals`, actor),
      profile.can.notes?.length ? getJson<OsNotes>(`/people/${id}/notes`, actor) : null,
      profile.can.ics ? getJson<OsIcs>(`/people/${id}/ics`, actor) : null,
    ]);
    return { profile, documents: docs?.documents ?? null, routines, prefs: prefs?.prefs ?? null, pauses: pauses?.pauses ?? null, goals, notes, ics };
  } catch { return null; }
}

/** scope "family": the admin's overview of every upcoming expiry (type, person, date only). */
export async function getReminders(session: { email?: string | null; cpifSubjectId: string }, scope: "mine" | "family" = "mine"): Promise<OsReminder[]> {
  if (!osEnabled()) return [];
  try { return (await getJson<{ reminders: OsReminder[] }>(scope === "family" ? "/reminders?scope=family" : "/reminders", osActor(session)))?.reminders ?? []; } catch { return []; }
}

// ---- Stage 2: routines and chores ---------------------------------------------------------------
export type OsRoutineAccess = { read: boolean; manage: boolean; check: boolean; reason: string | null };
export type OsRoutine = {
  id: string; kind: "routine" | "chore" | "rotation"; title: string; rrule: string; dtstart: string; at_time: string | null; members?: number;
  due_today: boolean; done_today: boolean; done_recent: string[];
  /** bus 86: «N из M на этой неделе» — always present for routines; `streak` only when an adult chose it. */
  week?: { done: number; of: number }; streak?: number; next: string[];
  anchor_text?: string | null; anchor_routine_id?: string | null; anchor_title?: string | null;
};
export type OsRoutines = { today: string; can: OsRoutineAccess; paused_today?: boolean; count_mode?: "week" | "streak"; routines: OsRoutine[] };

/** The member's own routines (Today). null = not a member, no access, or the service is down. */
export async function getMyRoutines(session: { email?: string | null; cpifSubjectId: string }, personId: string | null): Promise<OsRoutines | null> {
  if (!osEnabled() || !personId) return null;
  try { return await getJson<OsRoutines>(`/people/${personId}/routines?days=1`, osActor(session)); } catch { return null; }
}

// ---- Stage 3a: notification settings, pauses, rules -------------------------------------------
export type OsPrefs = { email_on: boolean; digest_time: string; evening_on: boolean; evening_time: string; lang: "ru" | "en"; count_mode?: "week" | "streak" };
export type OsPause = { id: string; from_date: string; to_date: string };
export type OsRule = { id: string; enabled: boolean; dry_run: boolean; last7: Record<string, number> };

/** Admin: the engine rules with on/off, dry-run and last-7-day outcome counts. */
export async function getRules(session: { email?: string | null; cpifSubjectId: string }): Promise<OsRule[] | null> {
  if (!osEnabled()) return null;
  try { return (await getJson<{ rules: OsRule[] }>("/rules", osActor(session)))?.rules ?? null; } catch { return null; }
}

// ---- Stage 3b: council, goals, calendar, notes, ICS -------------------------------------------
export type OsTask = { id: string; title: string; owner_id: string; due_date: string; done: boolean };
export type OsCouncil = {
  date: string; today: string; held: boolean; status: "upcoming" | "today" | "live" | "held" | "missed"; days_until: number; notes: string; can: { write: boolean; mark_held: boolean; pick_principle?: boolean }; tasks: OsTask[];
  principle?: { this_week: OsPrinciple; next_week: OsPrinciple };
  previous: { date: string; tasks: OsTask[] } | null;
  agenda: { from: string; to: string; items: { scheduled: number; done: number }; tasks: { done: number; open: number } };
};
export type OsWoop = { wish?: string; outcome?: string; obstacle?: string; plan?: string };
export type OsGoal = { id: string; sphere: string; visibility: "owner" | "guardians" | "family"; status: "active" | "done"; title: string; checkins: { week_start: string; mood: "on_track" | "slow" | "paused"; note: string }[]; checked_this_week: boolean;
  /** Present only for the goal's owner (bus 86). */ woop?: OsWoop | null };
export type OsGoals = { can: { write: boolean; visibilities: OsGoal["visibility"][] }; week: string; goals: OsGoal[] };
export type OsNotes = { kinds: ("health" | "education")[]; notes: { id: string; kind: "health" | "education"; updated_at: string; title: string; body: string }[] };
export type OsIcs = { active: boolean; created_at: string | null };
export type OsCalItem = { date: string; time: string | null; kind: "council" | "event" | "birthday"; id?: string; title?: string; person_id?: string; name_ru?: string; name_en?: string; age?: number };
export type OsCalendar = { today: string; can: { write: boolean }; items: OsCalItem[] };

type S = { email?: string | null; cpifSubjectId: string };
const safe = async <T,>(path: string, session: S): Promise<T | null> => { if (!osEnabled()) return null; try { return await getJson<T>(path, osActor(session)); } catch { return null; } };
export const getCouncil = (session: S, date?: string) => safe<OsCouncil>(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `/council?date=${date}` : "/council", session);
export const getCalendar = (session: S) => safe<OsCalendar>("/calendar?days=62", session);

// ---- Stage 3d-1: Кодекс, принцип недели, признание (bus 86) ------------------------------------
export type OsKodeksPrinciple = { element: string; element_ru: string; meaning: string; principle: string; practice: string };
export type OsKodeksBody = { principles: OsKodeksPrinciple[]; motto: string };
export type OsKodeks = {
  can: { edit: boolean };
  current: { version: number; status: "approved" | "draft"; approved_on: string | null; body: OsKodeksBody } | null;
  history: { version: number; status: "approved" | "draft"; approved_on: string | null; at: string; by: { name_ru: string; name_en: string } | null }[];
};
export type OsPrinciple = { week_start: string; index: number; picked: boolean; element: string; principle: string; practice: string; can?: { pick: boolean } };
export type OsRecognition = { id: string; from: { id: string; name_ru?: string; name_en?: string }; to: { id: string; name_ru?: string; name_en?: string }; index: number; principle: string; on_date: string; text: string };
export const getKodeks = (session: S) => safe<OsKodeks>("/kodeks", session);
export const getPrinciple = (session: S) => safe<OsPrinciple>("/principle", session);
export const getRecognitions = async (session: S, week?: string) =>
  (await safe<{ week_start: string; recognitions: OsRecognition[] }>(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? `/recognitions?week=${week}` : "/recognitions", session));

// ---- Stage 3c: the family board (bus 82, amended by 83/84) ------------------------------------
export type OsTaskState = "proposed" | "approved" | "accepted" | "in_progress" | "done" | "reviewed" | "declined" | "declined_by_adult" | "carried_over" | "cancelled";
export type OsWhenSlot = "morning" | "after_school" | "after_dinner" | "evening";
export type OsDeclineCode = "lessons" | "away" | "unwell" | "other";
export type OsBoardTask = {
  id: string; plan_date: string; title: string; kind: "chore" | "rotation" | "sprint" | "oneoff"; origin: "template" | "rotation" | "sprint" | "carry" | "adhoc";
  assignee_id: string; co_ids: string[]; accountable_id: string | null; state: OsTaskState; due_time: string | null; when_slot: OsWhenSlot | null; estimate_min: number | null;
  needs_review: boolean; sprint_goal_id: string | null; started_at: string | null; done_at: string | null; reviewed_by: string | null;
  decline_code?: OsDeclineCode; decline_reason?: string; rework_note?: string; why?: "declined" | "not_accepted"; nudge?: true;
};
export type OsBoardMember = {
  id: string; name_en: string; name_ru: string; kind: "adult" | "child";
  current: { id: string; title: string; started_at: string | null; kind: OsBoardTask["kind"]; co_ids: string[] } | null;
  waiting: number; done: number; total: number;
  routines?: { done: number; total: number };
  next?: { date: string; title: string; due_time: string | null; when_slot: OsWhenSlot | null };
};
export type OsProgress = { done: number; in_progress: number; accepted: number; waiting: number; total: number };
export type OsSprintGoal = { id: string; title: string; done: number; total: number };
/** by: a member id, "auto", "system" or "admin". */
export type OsApprovalStamp = { auto: boolean; by: string | null; at: string | null };
export type OsBoard = {
  date: string; today: string; now: string; members: OsBoardMember[]; tasks: OsBoardTask[]; progress: OsProgress; approval: OsApprovalStamp | null; can: { approve: boolean; sprint: boolean };
  sprint: { week_start: string; goals: OsSprintGoal[] };
  needs_decision?: OsBoardTask[]; plan?: { date: string; proposed: number; approved: boolean; auto: boolean; ready: boolean }; carry_offer?: OsBoardTask[];
};
export type OsMyBoard = { today: string; new: OsBoardTask[]; mine: OsBoardTask[] };
export type OsPlan = { date: string; approval: OsApprovalStamp | null; tasks: OsBoardTask[] };
export type OsTemplate = { id: string; title: string; mask: string; dtstart: string; assignee_id: string | null; members: string[] | null; due_time: string | null; when_slot: OsWhenSlot | null; estimate_min: number | null; needs_review: boolean; active: boolean };
export type OsSprint = { week_start: string; can: { write: boolean }; goals: OsSprintGoal[] };
export type OsTaskHistory = { step: string; origin?: OsBoardTask["origin"]; at: string; by: string | null }[];

export const getBoard = (session: S, date?: string) => safe<OsBoard>(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `/board?date=${date}` : "/board", session);
export const getMyBoard = (session: S) => safe<OsMyBoard>("/my-tasks", session);
export const getPlan = (session: S, date?: string) => safe<OsPlan>(date ? `/plan?date=${date}` : "/plan", session);
export const getTemplates = async (session: S) => (await safe<{ templates: OsTemplate[] }>("/templates", session))?.templates ?? null;
export const getSprint = (session: S, week?: string) => safe<OsSprint>(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? `/sprint?week=${week}` : "/sprint", session);

// ---- Stage 3d-2 (bus 84/97 item 3): «Кто уже с нами» -----------------------------------------------
export type OsAdoptionRow = {
  id: string; name_en: string; name_ru: string; kind: "adult" | "child";
  signed_in: { first_on: string; last_on: string } | null;
  digest: { on: boolean; time: string };
  passkey: boolean | null;
  invite: { on_date: string; sent: boolean; sent_at: string | null } | null;
};
export type OsAdoption = { people: OsAdoptionRow[]; family: { week_start: string; active: number; of: number } };
export async function getAdoption(session: { email?: string | null; cpifSubjectId: string }): Promise<OsAdoption | null> {
  if (!osEnabled()) return null;
  try { return await getJson<OsAdoption>("/adoption", osActor(session)); } catch { return null; }
}
/** After a completed sign-in: record the DATE (first/last) for «Кто уже с нами». Never blocks sign-in. */
export async function noteSignIn(email: string): Promise<void> {
  if (!osEnabled()) return;
  try { await osCall("POST", "/signins", osActor({ email, cpifSubjectId: email })); } catch { console.warn("[family-os] signin note failed"); }
}
