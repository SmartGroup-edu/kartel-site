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
import { fmtDocDate } from "../lib/family-docs.mjs";
import type { OsGoals, OsGoal, OsNotes, OsIcs } from "../lib/family-os";

type Lang = "EN" | "RU";
const T = {
  RU: {
    goals: "Цели", noGoals: "Целей пока нет.", addGoal: "Добавить цель", goalTitle: "Цель", sphere: "Сфера", visibility: "Кто видит", add: "Добавить",
    spheres: { health: "Здоровье и спорт", learning: "Учёба и навыки", character: "Характер", finance: "Финансы", contribution: "Вклад в семью", joy: "Радость и хобби" } as Record<string, string>,
    vis: { owner: "Только я", guardians: "Я и родители", family: "Вся семья" } as Record<string, string>,
    week: "Как идёт на этой неделе?", moods: { on_track: "Иду по плану", slow: "Медленно", paused: "На паузе" } as Record<string, string>, note: "Пара слов (необязательно)", checkin: "Отметить неделю",
    checked: "На этой неделе отмечено", done: "Достигнуто", markDone: "Цель достигнута", reopen: "Вернуть в работу", archive: "Убрать", last: "Последние недели",
    notes: "Здоровье и учёба", noNotes: "Записей пока нет.", addNote: "Добавить запись", kind: "Раздел", kinds: { health: "Здоровье", education: "Учёба" } as Record<string, string>, title: "Заголовок", body: "Текст",
    notesHint: "Записи зашифрованы, каждое чтение записывается в журнал.",
    phone: "Календарь в телефоне", phoneHint: "Ссылка для календаря телефона: твой распорядок, совет, события семьи и дни рождения. Кто знает ссылку — видит этот календарь, поэтому не пересылай её.",
    make: "Создать ссылку", remake: "Сменить ссылку", off: "Отключить", active: "Ссылка действует с", none: "Ссылки нет.", once: "Скопируй сейчас — второй раз ссылку не покажем:", copy: "Копировать", copied: "Скопировано.",
    saved: "Сохранено.", error: "Не удалось сохранить — попробуй ещё раз.",
  },
  EN: {
    goals: "Goals", noGoals: "No goals yet.", addGoal: "Add a goal", goalTitle: "Goal", sphere: "Area", visibility: "Who can see it", add: "Add",
    spheres: { health: "Health and sport", learning: "Learning and skills", character: "Character", finance: "Money", contribution: "Helping the family", joy: "Joy and hobbies" } as Record<string, string>,
    vis: { owner: "Only me", guardians: "Me and my parents", family: "The whole family" } as Record<string, string>,
    week: "How is it going this week?", moods: { on_track: "On track", slow: "Slowly", paused: "Paused" } as Record<string, string>, note: "A few words (optional)", checkin: "Check in this week",
    checked: "Checked in this week", done: "Reached", markDone: "Goal reached", reopen: "Back to in progress", archive: "Remove", last: "Recent weeks",
    notes: "Health and school", noNotes: "No notes yet.", addNote: "Add a note", kind: "Section", kinds: { health: "Health", education: "School" } as Record<string, string>, title: "Title", body: "Text",
    notesHint: "Notes are encrypted; every read is logged.",
    phone: "Calendar on your phone", phoneHint: "A link for your phone's calendar: your routines, the council, family events and birthdays. Anyone with the link sees this calendar, so do not forward it.",
    make: "Create a link", remake: "Change the link", off: "Switch off", active: "Link active since", none: "No link.", once: "Copy it now — it will not be shown again:", copy: "Copy", copied: "Copied.",
    saved: "Saved.", error: "Could not save — please try again.",
  },
} as const;
type Dict = (typeof T)[Lang];

const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]";
const primary = "inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]";
const H2 = "font-serif text-[28px] leading-[1.15] text-[var(--accent)] lg:text-[35px]";
const send = (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin", cache: "no-store" }).catch(() => null);

export function FamilyGoals({ lang, personId, data }: { lang: Lang; personId: string; data: OsGoals }) {
  const t = T[lang];
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const write = data.can.write;
  if (!write && data.goals.length === 0) return null; // nothing shared → nothing to show (or to reveal)
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const r = await send("POST", `people/${personId}/goals`, { title: String(f.get("title") ?? "").trim(), sphere: f.get("sphere"), visibility: f.get("visibility") });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { form.reset(); router.refresh(); }
  };
  return (
    <section id="goals" aria-labelledby="goals-h" data-goals="" className="mt-12 scroll-mt-24">
      <h2 id="goals-h" className={H2}>{t.goals}</h2>
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
            <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className={primary}>{t.add}</button><span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span></div>
          </form>
        </Disclosure>
      )}
    </section>
  );
}

function GoalRow({ t, lang, g, write, visibilities }: { t: Dict; lang: Lang; g: OsGoal; write: boolean; visibilities: string[] }) {
  const router = useRouter();
  const [mood, setMood] = useState<string>(g.checkins[0]?.mood ?? "on_track");
  const [msg, setMsg] = useState("");
  const act = async (p: Promise<Response | null>) => { const r = await p; setMsg(r?.ok ? t.saved : t.error); if (r?.ok) router.refresh(); };
  const checkin = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act(send("POST", `goals/${g.id}/checkins`, { mood, note: String(f.get("note") ?? "") })); };
  return (
    <li data-goal={g.status} className="py-4">
      <p className="text-[17px] text-[var(--foreground)]">{g.title}</p>
      <p className="mt-0.5 text-[14px] text-[var(--muted)]">{t.spheres[g.sphere]} · {t.vis[g.visibility]}{g.status === "done" ? ` · ${t.done}` : ""}{g.checked_this_week ? ` · ${t.checked}` : ""}</p>
      {g.checkins.length > 0 && (
        <p className="mt-1 text-[14px] text-[var(--text-secondary)]" suppressHydrationWarning>{t.last}: {g.checkins.slice(0, 3).map((c) => `${fmtDocDate(c.week_start, lang)} — ${t.moods[c.mood]}${c.note ? ` («${c.note}»)` : ""}`).join("; ")}</p>
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
            {visibilities.length > 1 && (
              <select aria-label={t.visibility} className={`${field} mt-0 w-auto`} value={g.visibility} onChange={(e) => act(send("PATCH", `goals/${g.id}`, { visibility: e.target.value }))}>
                {visibilities.map((v) => <option key={v} value={v}>{t.vis[v]}</option>)}
              </select>
            )}
          </div>
        </form>
      )}
      {write && g.status === "done" && <div className="mt-2 flex gap-2"><button type="button" className={btn} onClick={() => act(send("PATCH", `goals/${g.id}`, { status: "active" }))}>{t.reopen}</button><button type="button" className={btn} onClick={() => act(send("PATCH", `goals/${g.id}`, { status: "archived" }))}>{t.archive}</button></div>}
      {msg && <p role="status" aria-live="polite" className="mt-1 text-[14px] text-[var(--muted)]">{msg}</p>}
    </li>
  );
}

export function FamilyNotes({ lang, personId, data }: { lang: Lang; personId: string; data: OsNotes }) {
  const t = T[lang];
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const r = await send("POST", `people/${personId}/notes`, { kind: f.get("kind"), title: String(f.get("title") ?? "").trim(), body: String(f.get("body") ?? "") });
    setMsg(r?.ok ? t.saved : t.error); if (r?.ok) { form.reset(); router.refresh(); }
  };
  return (
    <section aria-labelledby="notes-h" data-notes="" className="mt-12">
      <h2 id="notes-h" className={H2}>{t.notes}</h2>
      <p className="mt-2 text-[14px] text-[var(--muted)]">{t.notesHint}</p>
      {data.notes.length === 0 ? <p className="mt-3 text-[14px] text-[var(--muted)]">{t.noNotes}</p> : (
        <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {data.notes.map((n) => (
            <li key={n.id} data-note={n.kind} className="py-3">
              <p className="text-[16px] font-medium text-[var(--foreground)]">{n.title}</p>
              <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{t.kinds[n.kind]} · {fmtDocDate(String(n.updated_at).slice(0, 10), lang)}</p>
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
  const t = T[lang];
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
      <h2 id="ics-h" className="font-serif text-[22px] text-[var(--foreground)]">{t.phone}</h2>
      <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.phoneHint}</p>
      <p className="mt-2 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{data.active && data.created_at ? `${t.active} ${fmtDocDate(String(data.created_at).slice(0, 10), lang)}` : t.none}</p>
      {url && (
        <div data-ics-url="" className="mt-3 rounded-md border border-[var(--accent)] p-3">
          <p className="text-[15px] text-[var(--foreground)]">{t.once}</p>
          <p className="mt-1 break-all font-mono text-[14px] text-[var(--foreground)]">{url}</p>
          <button type="button" className={`${btn} mt-2`} onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); setMsg(t.copied); }}>{t.copy}</button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={data.active ? btn : primary} onClick={make}>{data.active ? t.remake : t.make}</button>
        {data.active && <button type="button" className={btn} onClick={off}>{t.off}</button>}
      </div>
      {msg && <p role="status" aria-live="polite" className="mt-2 text-[14px] text-[var(--muted)]">{msg}</p>}
    </section>
  );
}
