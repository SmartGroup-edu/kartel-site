"use client";

/**
 * Family OS person page (Stage 2): name, birth date and age (only when the service returns them),
 * role, routines and chores (today, next 7 days, all items), documents and guardians. Document numbers are masked; «Показать» and
 * «Копировать» go through the logged service path. Files open only through /api/family-os (no
 * thumbnails of ID pages anywhere).
 */
import Disclosure from "./Disclosure";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TodayChecklist, Agenda, RoutineList, AddRoutine } from "./FamilyRoutines";
import Link from "next/link";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FamilySubNav from "./FamilySubNav";
import FamilyPortrait from "./FamilyPortrait";
import { familyNav } from "../content/siteNav";
import { FAMILY_MAIN, FAMILY_HEADER_MAX } from "../lib/family-nav.mjs";
import { ageOn, expiryState, maskNumber, DOC_LABELS, createRevealTimer, REVEAL_MS, fmtDocDate } from "../lib/family-docs.mjs";
import { useLangToggle } from "./useLang";
import { H1, H2, META } from "../lib/typeScale";
import type { OsState, OsProfile, OsDocument, OsRoutines, OsPrefs, OsPause, OsGoals, OsNotes, OsIcs } from "../lib/family-os";
import FamilyPrefs from "./FamilyPrefs";
import { FamilyGoals, FamilyNotes, FamilyIcs } from "./FamilyPersonExtras";

type Lang = "EN" | "RU";
const T = {
  EN: {
    back: "People", born: "Born", age: (n: number) => `${n} years`, adult: "Adult", child: "Child", parents: "Parents", relatives: "With access",
    documents: "Documents", noDocs: "No documents yet.", noAccess: "Only this person and their guardians can see these documents.",
    type: DOC_LABELS.EN, docType: "Document type",
    number: "Number", pcode: "Personal code", show: "Show", hide: "Hide", copy: "Copy", copied: "Copied", issued: "Issued", expires: "Expires", expired: "Expired", soon: "Expires soon",
    details: "Details", authority: "Authority", holder: "Holder", birthPlace: "Place of birth", sex: "Sex", nationality: "Nationality", open: "Open", file: "File",
    add: "Add a document", country: "Issuing country", save: "Save document", attach: "File (PDF, JPG, PNG or HEIC, up to 4 MB)", saving: "Saving…", saved: "Saved.", error: "Could not save",
    residenceNote: "Residence and settlement documents keep the file and its type only.",
    routines: "Routines and chores", today: "Today", guardians: "Guardians and access", relation: { parent: "Parent", relative: "Relative" },
    scope: { routines: "routines", health: "health", education: "school", documents: "documents" },
    routinesPrivate: "An adult's routines are visible to that person only.", routinesNoAccess: "This child's routines are visible to their parents and to people given access.",
    retype: "Change type", retypeSave: "Save type", retyped: "Type changed.",
  },
  RU: {
    back: "Люди", born: "Дата рождения", age: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "год" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "года" : "лет"}`, adult: "Взрослый", child: "Ребёнок", parents: "Родители", relatives: "С доступом",
    documents: "Документы", noDocs: "Документов пока нет.", noAccess: "Эти документы видят только сам человек и его опекуны.",
    type: DOC_LABELS.RU, docType: "Тип документа",
    number: "Номер", pcode: "Личный код", show: "Показать", hide: "Скрыть", copy: "Копировать", copied: "Скопировано", issued: "Выдан", expires: "Действует до", expired: "Истёк", soon: "Скоро истекает",
    details: "Подробнее", authority: "Кем выдан", holder: "Владелец", birthPlace: "Место рождения", sex: "Пол", nationality: "Гражданство", open: "Открыть", file: "Файл",
    add: "Добавить документ", country: "Страна выдачи", save: "Сохранить документ", attach: "Файл (PDF, JPG, PNG или HEIC, до 4 МБ)", saving: "Сохраняется…", saved: "Сохранено.", error: "Не удалось сохранить",
    residenceNote: "Для вида на жительство и settlement хранится только файл и тип документа.",
    routines: "Распорядок и дела", today: "Сегодня", guardians: "Опекуны и доступ", relation: { parent: "Родитель", relative: "Родственник" },
    scope: { routines: "распорядок", health: "здоровье", education: "учёба", documents: "документы" },
    routinesPrivate: "Распорядок взрослого видит только он сам.", routinesNoAccess: "Распорядок этого ребёнка видят родители и те, кому дали доступ.",
    retype: "Изменить тип", retypeSave: "Сохранить тип", retyped: "Тип изменён.",
  },
} as const;
type Dict = (typeof T)[Lang];

const api = (path: string, body?: unknown) => fetch(`/api/family-os/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}), credentials: "same-origin", cache: "no-store" });
const fmtDate = (d: string | null | undefined, lang: Lang) => fmtDocDate(d, lang);
const btn = "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-50";
const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";

export default function FamilyOsPerson({ lang, state, profile, documents, routines, prefs = null, pauses = null, goals = null, notes = null, ics = null }: { lang: Lang; state: OsState; profile: OsProfile; documents: OsDocument[] | null; routines: OsRoutines | null; prefs?: OsPrefs | null; pauses?: OsPause[] | null; goals?: OsGoals | null; notes?: OsNotes | null; ics?: OsIcs | null }) {
  const t = T[lang];
  const toggleLang = useLangToggle(lang);
  const ok = state.status === "ok";
  const people = ok ? state.people : [];
  const nameOf = (p: { name_en: string; name_ru: string }) => (lang === "EN" ? p.name_en : p.name_ru);
  const p = profile.person;
  const age = p.birth_date ? ageOn(p.birth_date, new Date()) : null;
  const byId = new Map(people.map((x) => [x.id, x]));
  const rc = profile.can.routines;
  // Who the viewer may put in a rotation: themselves (an adult) and the children they manage routines for.
  const me = ok ? state.me : null;
  const managed = ok && me ? people.filter((x) => (x.id === me.id && me.kind === "adult") || state.grants.some((g) => g.guardian_id === me.id && g.child_id === x.id && g.scopes.includes("routines"))) : [];
  const candidates = managed.some((x) => x.id === p.id) ? managed.map((x) => ({ id: x.id, name: nameOf(x) })) : [];
  const base = `/${lang === "EN" ? "en" : "ru"}/family/os`;

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} />
      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin={ok && state.admin} os active="people" />
        <div className="max-w-4xl pb-8">
          <p className="text-[15px]"><Link href={`${base}/people`} className="text-[var(--text-secondary)] hover:text-[var(--accent)]">← {t.back}</Link></p>
          <div className="mt-4 flex items-start gap-5">
            <div className="shrink-0"><FamilyPortrait id={null} name={nameOf(p)} alt="" size={72} /></div>
            <div className="min-w-0">
              <h1 className={H1}>{nameOf(p)}</h1>
              <p className={`${META} mt-2`}>
                {p.kind === "adult" ? t.adult : t.child}
                {p.birth_date && <> · {t.born} {fmtDate(p.birth_date, lang)}{age !== null && <> · {t.age(age)}</>}</>}
              </p>
            </div>
          </div>

          <section aria-labelledby="routines-h" className="mt-12">
            <h2 id="routines-h" className={H2}>{t.routines}</h2>
            {routines ? (
              <>
                <TodayChecklist lang={lang} today={routines.today} routines={routines.routines} canCheck={routines.can.check} headingId="person-today-h" heading={t.today} paused={routines.paused_today} />
                <Agenda lang={lang} routines={routines.routines} />
                <RoutineList lang={lang} routines={routines.routines} canManage={routines.can.manage} />
                {routines.can.manage && <AddRoutine lang={lang} personId={p.id} today={routines.today} candidates={candidates} routines={routines.routines} />}
              </>
            ) : (
              <p className={`${META} mt-4`}>{rc?.reason === "adult_private" ? t.routinesPrivate : t.routinesNoAccess}</p>
            )}
          </section>

          {goals && <FamilyGoals lang={lang} personId={p.id} data={goals} />}

          {prefs && pauses && <FamilyPrefs lang={lang} personId={p.id} prefs={prefs} pauses={pauses} today={routines?.today ?? new Date().toISOString().slice(0, 10)} adult={p.kind === "adult"} />}
          {ics && <FamilyIcs lang={lang} personId={p.id} data={ics} />}
          {notes && notes.kinds.length > 0 && <FamilyNotes lang={lang} personId={p.id} data={notes} />}

          <section aria-labelledby="docs-h" className="mt-12">
            <h2 id="docs-h" className={H2}>{t.documents}</h2>
            {documents === null ? (
              <p className={`${META} mt-4`}>{t.noAccess}</p>
            ) : documents.length === 0 ? (
              <p className={`${META} mt-4`}>{t.noDocs}</p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {documents.map((d) => <DocRow key={d.id} t={t} lang={lang} d={d} canRetype={profile.can.retype_documents} />)}
              </ul>
            )}
            {profile.can.add_documents && <AddDocument t={t} personId={p.id} />}
          </section>

          {profile.guardians.length > 0 && (
            <section aria-labelledby="guardians-h" className="mt-12">
              <h2 id="guardians-h" className={H2}>{t.guardians}</h2>
              <ul data-guardians="" className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {profile.guardians.map((g) => {
                  const who = byId.get(g.guardian_id);
                  return (
                    <li key={g.guardian_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 text-[16px]">
                      <span className="text-[var(--foreground)]">{who ? nameOf(who) : "—"}</span>
                      <span className="text-[14px] text-[var(--text-secondary)]">{t.relation[g.relation]} · {g.scopes.map((x) => t.scope[x]).join(", ")}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}

function DocIcon() {
  return (
    <svg aria-hidden="true" width="28" height="34" viewBox="0 0 28 34" className="shrink-0 text-[var(--muted)]">
      <path d="M3 1h15l7 7v23a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 1v7h7M6 15h14M6 20h14M6 25h9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Secret({ t, docId, field, hint }: { t: Dict; docId: string; field: "number" | "personal_code"; hint: string | null }) {
  const [value, setValue] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  // Re-hide (bus 68 #1): after 30 s, at once when the tab is hidden; print never shows it (print:hidden).
  const [timer] = useState(() => createRevealTimer({ onHide: () => setValue(null) }));
  useEffect(() => {
    const onVis = () => timer.visibility(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); timer.hide(); };
  }, [timer]);
  const fetchValue = async () => {
    const r = await api(`documents/${docId}/reveal`, { field });
    if (!r.ok) { setMsg(t.error); return null; }
    return ((await r.json()) as { value: string }).value;
  };
  const reveal = async () => { const v = await fetchValue(); if (v) { setValue(v); timer.reveal(); } };
  const copy = async () => {
    const v = value ?? (await fetchValue());
    if (!v) return;
    await navigator.clipboard.writeText(v);
    await api(`documents/${docId}/copied`, { field });
    setMsg(t.copied); setTimeout(() => setMsg(""), 2000);
    // Best effort: clear the clipboard after 30 s if it still holds this value and the page may
    // touch it (browsers allow clipboard writes only while the document has focus).
    setTimeout(async () => {
      try {
        const now = await navigator.clipboard.readText().catch(() => null);
        if (now === null || now === v) await navigator.clipboard.writeText("");
      } catch { /* not allowed without focus — the value stays until the user copies something else */ }
    }, REVEAL_MS);
  };
  return (
    // < 640 px (bus 75; at 480 the one-row layout does not fit and the label wraps alone): label + value on line one, the two buttons as equal halves on line two.
    // ≥ 640 px: one row, value width fixed so the buttons line up between rows (bus 69 L1).
    <span className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
      <span data-secret={value ? "shown" : "masked"} className="inline-block min-w-[11ch] font-mono text-[16px] tracking-wide text-[var(--foreground)]">
        {value ? <><span className="print:hidden">{value}</span><span className="hidden print:inline">{field === "number" ? maskNumber(hint) : "•••• ••••"}</span></> : (field === "number" ? maskNumber(hint) : "•••• ••••")}
      </span>
      <span data-secret-buttons="" className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
        <button type="button" className={`${btn} justify-center`} onClick={() => (value ? timer.hide() : reveal())}>{value ? t.hide : t.show}</button>
        <button type="button" className={`${btn} justify-center`} onClick={copy}>{t.copy}</button>
      </span>
      <span role="status" aria-live="polite" className="col-span-2 text-[14px] text-[var(--muted)] empty:hidden">{msg}</span>
    </span>
  );
}

function Retype({ t, d }: { t: Dict; d: OsDocument }) {
  const router = useRouter();
  const [type, setType] = useState(d.type);
  const [msg, setMsg] = useState("");
  const save = async () => {
    const r = await fetch(`/api/family-os/documents/${d.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ type }), credentials: "same-origin", cache: "no-store" }).catch(() => null);
    setMsg(r?.ok ? t.retyped : `${t.error}`); if (r?.ok) router.refresh();
  };
  return (
    <Disclosure variant="inline" summary={t.retype} className="mt-3 text-[15px]" summaryClassName="w-fit">
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className={label}>{t.docType}
          <select className={field} value={type} onChange={(e) => setType(e.target.value as OsDocument["type"])}>
            {Object.entries(t.type).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="button" className={btn} onClick={save} disabled={type === d.type}>{t.retypeSave}</button>
        <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
      </div>
    </Disclosure>
  );
}

function DocRow({ t, lang, d, canRetype }: { t: Dict; lang: Lang; d: OsDocument; canRetype: boolean }) {
  const ex = expiryState(d.expiry_date, new Date());
  const f = d.fields ?? {};
  return (
    <li data-document={d.type} className="flex gap-4 py-5">
      <DocIcon />
      <div className="min-w-0 flex-1">
        <p className="font-serif text-[18px] text-[var(--foreground)]">{t.type[d.type]}{d.country && <span className="font-sans text-[15px] text-[var(--text-secondary)]"> · {d.country}</span>}</p>
        {d.expiry_date && (
          <p className={`mt-1 text-[15px] ${ex === "ok" ? "text-[var(--text-secondary)]" : "font-medium text-[var(--accent)]"}`}>
            {ex === "expired" ? t.expired : ex === "soon" ? t.soon : t.expires}: {fmtDate(d.expiry_date, lang)}
          </p>
        )}
        <dl className="mt-3 space-y-2 text-[15px]">
          {d.has_number && <div data-secret-row="" className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:gap-y-0"><dt className="text-[var(--text-secondary)] sm:w-36">{t.number}</dt><dd className="contents sm:block"><Secret t={t} docId={d.id} field="number" hint={d.number_hint} /></dd></div>}
          {d.has_pcode && <div data-secret-row="" className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:gap-y-0"><dt className="text-[var(--text-secondary)] sm:w-36">{t.pcode}</dt><dd className="contents sm:block"><Secret t={t} docId={d.id} field="personal_code" hint={null} /></dd></div>}
        </dl>
        {d.type !== "residence" && (f.holder || f.authority || d.issue_date) && (
          <Disclosure variant="inline" summary={t.details} className="mt-3 text-[15px]" summaryClassName="w-fit">
            <dl className="mt-2 grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1">
              {f.holder && <><dt className="text-[var(--text-secondary)]">{t.holder}</dt><dd>{f.holder}</dd></>}
              {f.birth_place && <><dt className="text-[var(--text-secondary)]">{t.birthPlace}</dt><dd>{f.birth_place}</dd></>}
              {f.sex && <><dt className="text-[var(--text-secondary)]">{t.sex}</dt><dd>{f.sex}</dd></>}
              {f.nationality && <><dt className="text-[var(--text-secondary)]">{t.nationality}</dt><dd>{f.nationality}</dd></>}
              {f.authority && <><dt className="text-[var(--text-secondary)]">{t.authority}</dt><dd>{f.authority}</dd></>}
              {d.issue_date && <><dt className="text-[var(--text-secondary)]">{t.issued}</dt><dd>{fmtDate(d.issue_date, lang)}</dd></>}
            </dl>
          </Disclosure>
        )}
        {d.files.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {d.files.map((file, i) => (
              <li key={file.id}>
                <a className={btn} href={`/api/family-os/documents/${d.id}/files/${file.id}`} target="_blank" rel="noopener">
                  {t.open}{d.files.length > 1 ? ` ${i + 1}` : ""} <span className="ml-2 text-[14px] text-[var(--muted)]">{file.mime === "application/pdf" ? "PDF" : file.mime.split("/")[1].toUpperCase()}</span>
                  <span className="sr-only">: {file.name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {canRetype && <Retype t={t} d={d} />}
      </div>
    </li>
  );
}

function AddDocument({ t, personId }: { t: Dict; personId: string }) {
  const [type, setType] = useState<keyof Dict["type"]>("passport");
  const [status, setStatus] = useState("");
  const residence = type === "residence";
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries([...form.entries()].filter(([k, v]) => k !== "file" && typeof v === "string" && v !== ""));
    setStatus(t.saving);
    const r = await api(`people/${personId}/documents`, { ...body, type });
    if (!r.ok) return setStatus(`${t.error} (${r.status})`);
    const { id } = (await r.json()) as { id: string };
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const u = await fetch(`/api/family-os/documents/${id}/files`, { method: "POST", body: file, credentials: "same-origin",
        headers: { "x-file-name": btoa(String.fromCharCode(...new TextEncoder().encode(file.name))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") } });
      if (!u.ok) return setStatus(`${t.error} (${u.status})`);
    }
    setStatus(t.saved); location.reload();
  };
  return (
    <Disclosure summary={t.add} className="mt-8">
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label}>{t.docType}
          <select className={field} value={type} onChange={(e) => setType(e.target.value as keyof Dict["type"])}>
            {Object.entries(t.type).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className={label}>{t.country}<input name="country" className={field} maxLength={60} /></label>
        {residence ? <p className={`${META} sm:col-span-2`}>{t.residenceNote}</p> : (
          <>
            <label className={label}>{t.number}<input name="number" className={field} autoComplete="off" maxLength={60} /></label>
            <label className={label}>{t.pcode}<input name="personal_code" className={field} autoComplete="off" maxLength={60} /></label>
            <label className={label}>{t.holder}<input name="holder" className={field} maxLength={200} /></label>
            <label className={label}>{t.authority}<input name="authority" className={field} maxLength={120} /></label>
            <label className={label}>{t.issued}<input name="issue_date" type="date" className={field} /></label>
          </>
        )}
        <label className={label}>{t.expires}<input name="expiry_date" type="date" className={field} /></label>
        <label className={`${label} sm:col-span-2`}>{t.attach}<input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/heic" className={field} /></label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]">{t.save}</button>
          <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{status}</span>
        </div>
      </form>
    </Disclosure>
  );
}
