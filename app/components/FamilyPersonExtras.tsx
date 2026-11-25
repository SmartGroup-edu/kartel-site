"use client";

/**
 * Person page blocks for Stage 3b (bus 79): goals, health and education notes, the phone-calendar link.
 * The service decides what is visible; these components only show what they were given.
 * - Goals: only the owner adds, checks in or shares (a child's goals are only what the child entered).
 * - Notes: encrypted and logged by the service; no AI touches them.
 * - Calendar link: the person's own; shown once when made; can be changed or switched off any time.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Disclosure from "./Disclosure";
import { fmtFamilyDate } from "../lib/family-docs.mjs";
import type { OsGoals, OsGoal, OsNotes, OsIcs } from "../lib/family-os";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_LABEL, OS_H2, RULE_GOALS } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";

type Lang = "EN" | "RU";
const T = {
  RU: {
    goals: "Цели", noGoals: "Целей пока нет.", addGoal: "Добавить цель", goalTitle: "Цель", sphere: "Сфера", visibility: "Кто видит", add: "Добавить",
    spheres: { health: "Здоровье и спорт", learning: "Учёба и навыки", character: "Характер", finance: "Финансы", contribution: "Вклад в семью", joy: "Радость и хобби" } as Record<string, string>,
    vis: { owner: "Только я", guardians: "Я и родители", family: "Вся семья" } as Record<string, string>,
    week: "Как идёт на этой неделе?", confirmFamily: "Цель увидит вся семья?", yes: "Да, показать", no: "Отмена", moods: { on_track: "Иду по плану", slow: "Медленно", paused: "На паузе" } as Record<string, string>, note: "Пара слов (необязательно)", checkin: "Отметить неделю",
    checked: "На этой неделе отмечено", done: "Достигнуто", markDone: "Цель достигнута", reopen: "Вернуть в работу", archive: "Убрать", last: "Последние недели",
    notes: "Здоровье и учёба", noNotes: "Записей пока нет.", addNote: "Добавить запись", kind: "Раздел", kinds: { health: "Здоровье", education: "Учёба" } as Record<string, string>, title: "Заголовок", body: "Текст",
    notesHint: "Записи зашифрованы, каждое чтение записывается в журнал.",
    phone: "Календарь в телефоне", phoneHint: "Ссылка для календаря телефона: твой распорядок, совет, события семьи и дни рождения. Кто знает ссылку — видит этот календарь, поэтому не пересылай её.",
    make: "Создать ссылку", remake: "Сменить ссылку", off: "Отключить", active: "Ссылка действует с", none: "Ссылки нет.", once: "Скопируй сейчас — второй раз ссылку не покажем:", copy: "Копировать", copied: "Скопировано.",
    saved: "Сохранено.", error: "Не удалось сохранить — попробуй ещё раз.",
    woop: "План WOOP (необязательно)", woopHint: "Видишь только ты.", woopKeys: { wish: "Мечта", outcome: "Лучший результат", obstacle: "Главное препятствие", plan: "План «если — то»" } as Record<string, string>,
    woopPlaceholder: { wish: "Чего я хочу", outcome: "Как будет, когда получится", obstacle: "Что во мне может помешать", plan: "Если …, то я …" } as Record<string, string>, woopEdit: "Изменить план", woopSave: "Сохранить план",
  },
  EN: {
    goals: "Goals", noGoals: "No goals yet.", addGoal: "Add a goal", goalTitle: "Goal", sphere: "Area", visibility: "Who can see it", add: "Add",
    spheres: { health: "Health and sport", learning: "Learning and skills", character: "Character", finance: "Money", contribution: "Helping the family", joy: "Joy and hobbies" } as Record<string, string>,
    vis: { owner: "Only me", guardians: "Me and my parents", family: "The whole family" } as Record<string, string>,
    week: "How is it going this week?", confirmFamily: "The whole family will see this goal?", yes: "Yes, show it", no: "Cancel", moods: { on_track: "On track", slow: "Slowly", paused: "Paused" } as Record<string, string>, note: "A few words (optional)", checkin: "Check in this week",
    checked: "Checked in this week", done: "Reached", markDone: "Goal reached", reopen: "Back to in progress", archive: "Remove", last: "Recent weeks",
    notes: "Health and school", noNotes: "No notes yet.", addNote: "Add a note", kind: "Section", kinds: { health: "Health", education: "School" } as Record<string, string>, title: "Title", body: "Text",
    notesHint: "Notes are encrypted; every read is logged.",
    phone: "Calendar on your phone", phoneHint: "A link for your phone's calendar: your routines, the council, family events and birthdays. Anyone with the link sees this calendar, so do not forward it.",
    make: "Create a link", remake: "Change the link", off: "Switch off", active: "Link active since", none: "No link.", once: "Copy it now — it will not be shown again:", copy: "Copy", copied: "Copied.",
    saved: "Saved.", error: "Could not save — please try again.",
    woop: "WOOP plan (optional)", woopHint: "Only you can see it.", woopKeys: { wish: "Wish", outcome: "Best outcome", obstacle: "Main obstacle", plan: "If–then plan" } as Record<string, string>,
    woopPlaceholder: { wish: "What I want", outcome: "How it will be when it works", obstacle: "What in me may get in the way", plan: "If …, then I …" } as Record<string, string>, woopEdit: "Change the plan", woopSave: "Save the plan",
  },
} as const;
type Dict = (typeof T)[Lang];

const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = BTN_SECONDARY;
const primary = BTN_PRIMARY;
const send = (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin", cache: "no-store" }).catch(() => null);

export function FamilyGoals({ lang, personId, data }: { lang: Lang; personId: string; data: OsGoals }) {
  const t = tx(T, lang);
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const write = data.can.write;
  if (!write && data.goals.length === 0) return null; // nothing shared → nothing to show (or to reveal)
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const woop = Object.fromEntries(WOOP.map((k) => [k, String(f.get(`woop-${k}`) ?? "").trim()]).filter(([, v]) => v));
    const r = await send("POST", `people/${personId}/goals`, { title: String(f.get("title") ?? "").trim(), sphere: f.get("sphere"), visibility: f.get("visibility"), ...(Object.keys(woop).length ? { woop } : {}) });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { form.reset(); router.refresh(); }
  };
  return (
    <section id="goals" aria-labelledby="goals-h" data-goals="" className="mt-12 scroll-mt-24">
      <h2 id="goals-h" className={OS_H2}>{t.goals}</h2>
      {data.goals.length === 0 ? <p className="mt-3 text-[14px] text-[var(--muted)]">{t.noGoals}</p> : (
        <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {data.goals.map((g) => <GoalRow key={g.id} t={t} lang={lang} g={g} write={write} visibilities={data.can.visibilities} />)}
        </ul>
      )}
      {write && (
        <Disclosure summary={t.addGoal} className="mt-4">
          <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={`${label} sm:col-span-2`}>{t.goalTitle}<input name="title" required maxLength={160} className={field} /></label>
            <label className={label}>{t.sphere}<select name="sphere" className={field}>{Object.entries(t.spheres).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className={label}>{t.visibility}<select name="visibility" className={field} defaultValue="owner">{data.can.visibilities.map((v) => <option key={v} value={v}>{t.vis[v]}</option>)}</select></label>
            <WoopFields t={t} prefix="woop" className="sm:col-span-2" />
            <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className={primary}>{t.add}</button><span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span></div>
          </form>
        </Disclosure>
      )}
    </section>
  );
}

const WOOP = ["wish", "outcome", "obstacle", "plan"] as const;
/** WOOP (bus 86): four optional lines, owner-only (the service never returns them to anyone else). A plan, so gold
 *  (Рост, R0 25.11): its own rule in the «add a goal» form; inside a goal card the card's rule already says it. */
function WoopFields({ t, prefix, values = {}, className = "", ruled = true }: { t: Dict; prefix: string; values?: Record<string, string | undefined>; className?: string; ruled?: boolean }) {
  return (
    <fieldset data-woop-form="" className={`grid gap-3 sm:grid-cols-2 ${ruled ? RULE_GOALS : ""} ${className}`}>
      <legend className="text-[15px] font-medium text-[var(--foreground)]">{t.woop} <span className="font-normal text-[var(--muted)]">· {t.woopHint}</span></legend>
      {WOOP.map((k) => <label key={k} className={label}>{t.woopKeys[k]}<input name={`${prefix}-${k}`} maxLength={300} defaultValue={values[k] ?? ""} placeholder={t.woopPlaceholder[k]} className={field} /></label>)}
    </fieldset>
  );
}
function GoalWoop({ t, g, act }: { t: Dict; g: OsGoal; act: (p: Promise<Response | null>) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const w = g.woop ?? {};
  const has = WOOP.some((k) => w[k]);
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next = Object.fromEntries(WOOP.map((k) => [k, String(f.get(`w-${g.id}-${k}`) ?? "").trim()]).filter(([, v]) => v));
    setEdit(false); void act(send("PATCH", `goals/${g.id}`, { woop: Object.keys(next).length ? next : null }));
  };
  if (edit) return <form onSubmit={save} className="mt-3 grid gap-3"><WoopFields t={t} prefix={`w-${g.id}`} values={w} ruled={false} /><div><button type="submit" className={primary}>{t.woopSave}</button></div></form>;
  return (
    <div data-woop="" className="mt-3">
      {/* R0 25.11 (bus 159): small muted labels, the answers stay body text; one <dt>/<dd> pair per line */}
      {has && <dl className="grid gap-3">
        {WOOP.filter((k) => w[k]).map((k) => <div key={k} data-woop-pair={k}><dt className={CARD_LABEL}>{t.woopKeys[k]}</dt><dd className="mt-0.5 text-[16px] leading-snug text-[var(--foreground)]">{w[k]}</dd></div>)}
      </dl>}
      <button type="button" className={`${btn} ${has ? "mt-3" : ""}`} onClick={() => setEdit(true)}>{has ? t.woopEdit : t.woop}</button>
    </div>
  );
}

function GoalRow({ t, lang, g, write, visibilities }: { t: Dict; lang: Lang; g: OsGoal; write: boolean; visibilities: string[] }) {
  const router = useRouter();
  const [mood, setMood] = useState<string>(g.checkins[0]?.mood ?? "on_track");
  const [askFamily, setAskFamily] = useState(false);
  const setVisibility = (v: string) => (v === "family" ? setAskFamily(true) : void act(send("PATCH", `goals/${g.id}`, { visibility: v })));
  const [msg, setMsg] = useState("");
  const act = async (p: Promise<Response | null>) => { const r = await p; setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh(); };
  const checkin = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act(send("POST", `goals/${g.id}/checkins`, { mood, note: String(f.get("note") ?? "") })); };
  return (
    <li data-goal={g.status} className="py-4">
      <div className={RULE_GOALS}>
        <p className="text-[17px] text-[var(--foreground)]">{g.title}</p>
        <p className="mt-0.5 text-[14px] text-[var(--muted)]">{t.spheres[g.sphere]} · {t.vis[g.visibility]}{g.status === "done" ? ` · ${t.done}` : ""}{g.checked_this_week ? ` · ${t.checked}` : ""}</p>
        {write && g.woop !== undefined && <GoalWoop t={t} g={g} act={act} />}
        {g.checkins.length > 0 && (
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]" suppressHydrationWarning>{t.last}: {g.checkins.slice(0, 3).map((c) => `${fmtFamilyDate(c.week_start, lang)} — ${t.moods[c.mood]}${c.note ? ` («${c.note}»)` : ""}`).join("; ")}</p>
        )}
        {write && g.status === "active" && (
          <form onSubmit={checkin} className="mt-3 grid gap-3">
            <fieldset>
              <legend className={label}>{t.week}</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {Object.entries(t.moods).map(([k, v]) => (
                  <label key={k} className={`inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3 text-[15px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)] ${mood === k ? "border-[var(--accent)] text-[var(--foreground)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>
                    <input type="radio" name={`mood-${g.id}`} className="sr-only" checked={mood === k} onChange={() => setMood(k)} />{v}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={label}>{t.note}<input name="note" maxLength={500} className={field} /></label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className={primary}>{t.checkin}</button>
              <button type="button" className={btn} onClick={() => act(send("PATCH", `goals/${g.id}`, { status: "done" }))}>{t.markDone}</button>
            </div>
          </form>
        )}
        {/* bus 80 #4: «Кто видит» is a labelled setting of its own; showing to the whole family asks once */}
        {write && g.status === "active" && visibilities.length > 1 && (
          <div data-goal-settings="" className="mt-3 grid gap-2 sm:max-w-xs">
            <label className={label}>{t.visibility}
              <select className={field} value={g.visibility} disabled={askFamily} onChange={(e) => setVisibility(e.target.value)}>
                {visibilities.map((v) => <option key={v} value={v}>{t.vis[v]}</option>)}
              </select>
            </label>
            {askFamily && (
              <div data-confirm-family="" role="alertdialog" aria-label={t.confirmFamily} className="rounded-md border border-[var(--accent)] p-3">
                <p className="text-[15px] text-[var(--foreground)]">{t.confirmFamily}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={primary} onClick={() => { setAskFamily(false); void act(send("PATCH", `goals/${g.id}`, { visibility: "family" })); }}>{t.yes}</button>
                  <button type="button" className={btn} onClick={() => setAskFamily(false)}>{t.no}</button>
                </div>
              </div>
            )}
          </div>
        )}
        {write && g.status === "done" && <div className="mt-2 flex gap-2"><button type="button" className={btn} onClick={() => act(send("PATCH", `goals/${g.id}`, { status: "active" }))}>{t.reopen}</button><button type="button" className={btn} onClick={() => act(send("PATCH", `goals/${g.id}`, { status: "archived" }))}>{t.archive}</button></div>}
        {msg && <p role="status" aria-live="polite" className="mt-1 text-[14px] text-[var(--muted)]">{msg}</p>}
      </div>
    </li>
  );
}

export function FamilyNotes({ lang, personId, data }: { lang: Lang; personId: string; data: OsNotes }) {
  const t = tx(T, lang);
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const r = await send("POST", `people/${personId}/notes`, { kind: f.get("kind"), title: String(f.get("title") ?? "").trim(), body: String(f.get("body") ?? "") });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { form.reset(); router.refresh(); }
  };
  return (
    <section id="notes" aria-labelledby="notes-h" data-notes="" className="mt-12 scroll-mt-24">
      <h2 id="notes-h" className={OS_H2}>{t.notes}</h2>
      <p className="mt-2 text-[14px] text-[var(--muted)]">{t.notesHint}</p>
      {data.notes.length === 0 ? <p className="mt-3 text-[14px] text-[var(--muted)]">{t.noNotes}</p> : (
        <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {data.notes.map((n) => (
            <li key={n.id} data-note={n.kind} className="py-3">
              <p className="text-[16px] font-medium text-[var(--foreground)]">{n.title}</p>
              <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{t.kinds[n.kind]} · {fmtFamilyDate(String(n.updated_at).slice(0, 10), lang)}</p>
              {n.body && <p className="mt-1 whitespace-pre-line text-[16px] leading-[1.55] text-[var(--foreground)]">{n.body}</p>}
            </li>
          ))}
        </ul>
      )}
      <Disclosure summary={t.addNote} className="mt-4">
        <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>{t.kind}<select name="kind" className={field}>{data.kinds.map((k) => <option key={k} value={k}>{t.kinds[k]}</option>)}</select></label>
          <label className={label}>{t.title}<input name="title" required maxLength={200} className={field} /></label>
          <label className={`${label} sm:col-span-2`}>{t.body}<textarea name="body" maxLength={4000} rows={4} className={`${field} min-h-28`} /></label>
          <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className={primary}>{t.add}</button><span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span></div>
        </form>
      </Disclosure>
    </section>
  );
}

export function FamilyIcs({ lang, personId, data }: { lang: Lang; personId: string; data: OsIcs }) {
  const t = tx(T, lang);
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const make = async () => {
    const r = await send("POST", `people/${personId}/ics`);
    if (!r?.ok) return setMsg(t.error);
    const { token } = (await r.json()) as { token: string };
    setUrl(`${location.origin}/api/family-ics/${token}.ics`); setMsg(""); router.refresh();
  };
  const off = async () => { const r = await send("DELETE", `people/${personId}/ics`); setUrl(null); setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh(); };
  return (
    <section id="phone-calendar" aria-labelledby="ics-h" data-ics="" className="mt-12 scroll-mt-24">
      <h2 id="ics-h" className={OS_H2}>{t.phone}</h2>
      <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.phoneHint}</p>
      <p className="mt-2 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{data.active && data.created_at ? `${t.active} ${fmtFamilyDate(String(data.created_at).slice(0, 10), lang)}` : t.none}</p>
      {url && (
        <div data-ics-url="" className="mt-3 rounded-md border border-[var(--accent)] p-3">
          <p className="text-[15px] text-[var(--foreground)]">{t.once}</p>
          <p className="mt-1 break-all font-mono text-[14px] text-[var(--foreground)]">{url}</p>
          <button type="button" className={`${btn} mt-2`} onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); setMsg(t.copied); }}>{t.copy}</button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={make}>{data.active ? t.remake : t.make}</button>
        {data.active && <button type="button" className={btn} onClick={off}>{t.off}</button>}
      </div>
      {msg && <p role="status" aria-live="polite" className="mt-2 text-[14px] text-[var(--muted)]">{msg}</p>}
    </section>
  );
}
