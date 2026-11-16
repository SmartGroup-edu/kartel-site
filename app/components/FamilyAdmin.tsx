"use client";

/**
 * The family editor (admins only): portraits for people on the tree, and dates, places,
 * professions, a short story and photos for chronicle entries. Every card saves itself as a draft
 * (debounced); nothing is visible in /family until "Publish". Names and the existing chronicle text
 * are not editable here. Photos are downsized (and their EXIF dropped) in the browser before upload;
 * the service re-encodes them again and keeps no original.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FamilyPortrait from "./FamilyPortrait";
import { useLangToggle } from "./useLang";
import { H1, H2, EYEBROW, META } from "../lib/typeScale";
import { FRAME, OUTPUT, initial, place, rezoom, zoomRange } from "../lib/crop-geometry.mjs";
import { createAutosaver, unpublishedKeys, cardStatus, eventChips, splitDate, joinDate, formatPublished } from "../lib/family-editor.mjs";

type Lang = "EN" | "RU";
type Person = { id: string; nameEN: string; nameRU: string };
type Entry = { id: string; titleEN: string; titleRU: string; yearEN: string; yearRU: string };
type PersonMedia = { portrait: string | null; altEN: string; altRU: string };
type Photo = { id: string; captionEN: string; captionRU: string };
type EventMedia = {
  dateFrom: string; dateTo: string; placesEN: string; placesRU: string;
  professionEN: string; professionRU: string; storyEN: string; storyRU: string; photos: Photo[];
};
type Content = { persons: Record<string, PersonMedia>; events: Record<string, EventMedia> };
type SaveState = { state: string; at?: number };

const EMPTY_PERSON: PersonMedia = { portrait: null, altEN: "", altRU: "" };
const EMPTY_EVENT: EventMedia = { dateFrom: "", dateTo: "", placesEN: "", placesRU: "", professionEN: "", professionRU: "", storyEN: "", storyRU: "", photos: [] };
const EMPTY: Content = { persons: {}, events: {} };

const T = {
  EN: {
    eyebrow: "Family Heritage", title: "Family editor",
    intro: "Add portraits and chronicle details. Every change is saved as a draft straight away; it appears in Family Heritage only after you publish.",
    off: "The photo and story service is not connected yet, so nothing can be saved.",
    people: "People", entries: "Chronicle", nav: "Sections",
    publish: "Publish", undo: "Undo last change", undoShort: "Undo", publishedAt: "Last published", never: "never", more: "More",
    unpublished: "Unpublished changes", noChanges: "No unpublished changes",
    published: "Published.", undone: "Last change undone.", nothingToUndo: "Nothing to undo.",
    saving: "Saving…", savedAt: "Saved", notSaved: "Not saved", retry: "Retry", fixFirst: "Not saved — fix the date",
    status: { empty: "Empty", draft: "Draft", published: "Published" },
    chip: { story: "story", photos: (n: number) => `${n} photo${n === 1 ? "" : "s"}`, dates: "dates" },
    filter: "Find a person", noMatch: "No one matches.",
    portrait: "Portrait", upload: "Upload portrait", replace: "Replace", remove: "Remove", apply: "Apply", cancel: "Cancel",
    zoom: "Zoom", cropHint: "Drag (or use the arrow keys) to position the photo; zoom out to keep the whole photo.", cropFrame: "Portrait frame. Arrow keys move the photo, plus and minus zoom.",
    fitWhole: "Whole photo", fillFrame: "Fill frame",
    altEN: "Description for screen readers (EN)", altRU: "Description for screen readers (RU)",
    from: "From", to: "To (optional)", year: "Year", month: "Month", day: "Day", noMonth: "—",
    dateErr: { year_required: "Enter a year first.", year: "Year: four digits, e.g. 1901.", day_without_month: "Choose a month for this day.", day: "That day does not exist in this month." },
    placesEN: "Places (EN)", placesRU: "Places (RU)", professionEN: "Profession (EN)", professionRU: "Profession (RU)",
    storyEN: "Short story (EN)", storyRU: "Short story (RU)", storyHint: "Plain text. A blank line starts a new paragraph.",
    photos: "Photos", addPhoto: "Add photo", captionEN: "Caption (EN)", captionRU: "Caption (RU)",
    uploading: "Uploading…", error: "Could not save", loadError: "Could not load the draft",
  },
  RU: {
    eyebrow: "Семейное наследие", title: "Редактор семьи",
    intro: "Добавляйте портреты и подробности хроники. Каждое изменение сразу сохраняется как черновик и появляется в «Семейном наследии» только после публикации.",
    off: "Сервис фото и историй ещё не подключён, сохранить пока ничего нельзя.",
    people: "Люди", entries: "Хроника", nav: "Разделы",
    publish: "Опубликовать", undo: "Отменить последнее изменение", undoShort: "Отменить", publishedAt: "Последняя публикация", never: "ещё не было", more: "Ещё",
    unpublished: "Неопубликованные изменения", noChanges: "Нет неопубликованных изменений",
    published: "Опубликовано.", undone: "Последнее изменение отменено.", nothingToUndo: "Отменять нечего.",
    saving: "Сохраняется…", savedAt: "Сохранено", notSaved: "Не сохранено", retry: "Повторить", fixFirst: "Не сохранено — исправьте дату",
    status: { empty: "Не заполнено", draft: "Черновик", published: "Опубликовано" },
    chip: { story: "история", photos: (n: number) => `${n} фото`, dates: "даты" },
    filter: "Найти человека", noMatch: "Никого не найдено.",
    portrait: "Портрет", upload: "Загрузить портрет", replace: "Заменить", remove: "Убрать", apply: "Применить", cancel: "Отмена",
    zoom: "Масштаб", cropHint: "Перетащите фото (или используйте стрелки), чтобы выбрать кадр; уменьшите масштаб, чтобы фото вошло целиком.", cropFrame: "Рамка портрета. Стрелки сдвигают фото, плюс и минус меняют масштаб.",
    fitWhole: "Фото целиком", fillFrame: "Заполнить рамку",
    altEN: "Описание для скринридеров (EN)", altRU: "Описание для скринридеров (RU)",
    from: "С", to: "По (необязательно)", year: "Год", month: "Месяц", day: "День", noMonth: "—",
    dateErr: { year_required: "Сначала укажите год.", year: "Год — четыре цифры, например 1901.", day_without_month: "Для дня выберите месяц.", day: "Такого дня нет в этом месяце." },
    placesEN: "Места (EN)", placesRU: "Места (RU)", professionEN: "Профессия (EN)", professionRU: "Профессия (RU)",
    storyEN: "Короткая история (EN)", storyRU: "Короткая история (RU)", storyHint: "Обычный текст. Пустая строка начинает новый абзац.",
    photos: "Фотографии", addPhoto: "Добавить фото", captionEN: "Подпись (EN)", captionRU: "Подпись (RU)",
    uploading: "Загрузка…", error: "Не удалось сохранить", loadError: "Не удалось загрузить черновик",
  },
} as const;
type Dict = (typeof T)[Lang];

const api = (path: string, init?: RequestInit) => fetch(`/api/family-admin/${path}`, { ...init, credentials: "same-origin", cache: "no-store" });
const mediaUrl = (id: string, w = 256) => `/api/family-media/${id}/${w}.webp`;
const put = (path: string, body: unknown) => api(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Downsize in the browser (also drops EXIF/GPS: a canvas carries no metadata). */
async function toJpeg(source: ImageBitmap | HTMLCanvasElement, max = 2000): Promise<Blob> {
  const w = source.width, h = source.height, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.9));
}

async function uploadBlob(blob: Blob): Promise<string> {
  const r = await api("media", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
  if (!r.ok) throw new Error(String(r.status));
  return ((await r.json()) as { id: string }).id;
}

const field = "mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]`;
const btnSecondary = `${btn} border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]`;
const link = "underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]";

export default function FamilyAdmin({ lang, enabled, people, entries }: { lang: Lang; enabled: boolean; people: Person[]; entries: Entry[] }) {
  const t = T[lang];
  const toggleLang = useLangToggle(lang);
  const [draft, setDraft] = useState<Content>(EMPTY);
  const [published, setPublished] = useState<Content>(EMPTY);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(0); // bumps on every (re)load so cards accept the server's value
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const apply = useCallback((d: { content: Content; published: { content: Content; at: string | null } }) => {
    setDraft(d.content); setPublished(d.published.content ?? EMPTY); setPublishedAt(d.published.at); setLoaded((n) => n + 1);
  }, []);
  const load = useCallback(async () => {
    const r = await api("draft");
    if (!r.ok) { setStatus(`${t.loadError} (${r.status})`); return; }
    apply(await r.json());
  }, [apply, t.loadError]);

  // First load: state is set only in the promise callback, never synchronously in the effect.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api("draft").then(async (r) => {
      if (!alive) return;
      if (!r.ok) { setStatus(`${t.loadError} (${r.status})`); return; }
      const d = await r.json();
      if (alive) apply(d);
    }).catch(() => alive && setStatus(t.loadError));
    return () => { alive = false; };
  }, [enabled, apply, t.loadError]);

  // A jump link (#person-… / #event-…) opens the card it points at.
  useEffect(() => {
    const open = () => {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el instanceof HTMLDetailsElement) el.open = true;
    };
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  const savedPerson = useCallback((id: string, v: PersonMedia) => setDraft((d) => ({ ...d, persons: { ...d.persons, [id]: v } })), []);
  const savedEvent = useCallback((id: string, v: EventMedia) => setDraft((d) => ({ ...d, events: { ...d.events, [id]: v } })), []);

  const pending = unpublishedKeys(draft, published);
  const n = pending.length;
  const nameOf = (key: string) => {
    const [kind, id] = key.split(":");
    if (kind === "person") { const p = people.find((x) => x.id === id); return p ? (lang === "EN" ? p.nameEN : p.nameRU) : id; }
    const e = entries.find((x) => x.id === id); return e ? (lang === "EN" ? `${e.yearEN} — ${e.titleEN}` : `${e.yearRU} — ${e.titleRU}`) : id;
  };

  const act = async (path: string, done: (j: { undone?: boolean }) => string) => {
    setBusy(true); setStatus("");
    try {
      const r = await api(path, { method: "POST" });
      if (!r.ok) { setStatus(`${t.error} (${r.status})`); return; }
      setStatus(done(await r.json().catch(() => ({})))); await load();
    } catch { setStatus(t.error); } finally { setBusy(false); }
  };
  const publish = () => act("publish", () => t.published);
  const undo = () => act("undo", (j) => (j?.undone ? t.undone : t.nothingToUndo));
  const lastPublished = formatPublished(publishedAt, lang) ?? t.never;

  const q = filter.trim().toLocaleLowerCase(lang === "EN" ? "en" : "ru");
  const shown = people.filter((p) => !q || `${p.nameEN} ${p.nameRU}`.toLocaleLowerCase().includes(q));

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:py-16">
        <p className={EYEBROW}>{t.eyebrow}</p>
        <h1 className={`mt-2 ${H1}`}>{t.title}</h1>
        <p className="mt-4 max-w-[68ch] text-[17px] leading-[1.6] text-[var(--text-body)]">{t.intro}</p>

        {!enabled ? (
          <p role="status" className="mt-8 rounded-lg border border-[var(--border)] px-4 py-3 text-[15px]">{t.off}</p>
        ) : (
          <>
            {/* Toolbar: one row everywhere; the in-page nav and the secondary actions fold away on phones. */}
            <div data-toolbar="" className="sticky top-16 z-20 mt-8 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 lg:top-24">
              <nav aria-label={t.nav} className="hidden items-center gap-3 whitespace-nowrap text-[15px] sm:flex">
                <a href="#people-h" className={link}>{t.people}</a><span aria-hidden="true" className="text-[var(--muted)]">·</span><a href="#entries-h" className={link}>{t.entries}</a>
              </nav>
              <details data-pending="" className="relative hidden text-[15px] sm:block">
                <summary className="cursor-pointer list-none whitespace-nowrap rounded px-1 text-[var(--text-secondary)] marker:hidden">{n ? `${t.unpublished}: ${n}` : t.noChanges}</summary>
                {n > 0 && (
                  <ul className="absolute left-0 top-full z-30 mt-2 max-h-72 w-72 overflow-auto rounded-md border border-[var(--border)] bg-[var(--background)] p-2 shadow-lg">
                    {pending.map((k) => <li key={k}><a className={`block rounded px-2 py-1.5 ${link}`} href={`#${k.replace(":", "-")}`}>{nameOf(k)}</a></li>)}
                  </ul>
                )}
              </details>
              <span className="flex-1" />
              <div className="hidden items-center gap-3 sm:flex">
                <button type="button" className={`${btnSecondary} whitespace-nowrap`} disabled={busy} onClick={undo} aria-label={t.undo} title={t.undo}>{t.undoShort}</button>
              </div>
              <button type="button" data-publish="" className={`${btnPrimary} whitespace-nowrap`} disabled={busy || n === 0} onClick={publish}>{t.publish}{n ? ` (${n})` : ""}</button>
              <details className="relative sm:hidden">
                <summary aria-label={t.more} className={`${btnSecondary} list-none px-3 marker:hidden`}>⋯</summary>
                <div className="absolute right-0 top-full z-30 mt-2 w-64 space-y-2 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 shadow-lg">
                  <button type="button" className={`${btnSecondary} w-full`} disabled={busy} onClick={undo}>{t.undo}</button>
                  <p className={META}>{t.publishedAt}: {lastPublished}</p>
                  <p className={META}>{n ? `${t.unpublished}: ${n}` : t.noChanges}</p>
                </div>
              </details>
            </div>
            <p className={`${META} mt-2 hidden sm:block`}>{t.publishedAt}: {lastPublished}</p>
            <p role="status" aria-live="polite" className="mt-1 min-h-5 text-[14px] text-[var(--accent)]">{status}</p>

            <section className="mt-12 scroll-mt-40" aria-labelledby="people-h" id="people">
              <h2 id="people-h" className={`${H2} scroll-mt-40`}>{t.people}</h2>
              <label className={`${label} mt-5 max-w-sm`}>{t.filter}
                <input type="search" className={field} value={filter} onChange={(e) => setFilter(e.target.value)} />
              </label>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {shown.map((p) => (
                  <PersonEditor key={p.id} id={p.id} t={t} lang={lang} name={lang === "EN" ? p.nameEN : p.nameRU}
                    value={draft.persons[p.id] ?? EMPTY_PERSON} live={published.persons[p.id]} loaded={loaded} onSaved={savedPerson} />
                ))}
              </ul>
              {shown.length === 0 && <p className={`${META} mt-4`}>{t.noMatch}</p>}
            </section>

            <section className="mt-14" aria-labelledby="entries-h" id="entries">
              <h2 id="entries-h" className={`${H2} scroll-mt-40`}>{t.entries}</h2>
              <div className="mt-6 space-y-3">
                {entries.map((e) => (
                  <EventEditor key={e.id} id={e.id} t={t} lang={lang} heading={lang === "EN" ? `${e.yearEN} — ${e.titleEN}` : `${e.yearRU} — ${e.titleRU}`}
                    value={draft.events[e.id] ?? EMPTY_EVENT} live={published.events[e.id]} loaded={loaded} onSaved={savedEvent} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}

/**
 * One card's local value + debounced autosave. External changes (a reload after undo/publish) replace
 * the local value; the card's own saves coming back do not, so typing is never overwritten.
 */
function useCard<V>(path: string, value: V, loaded: number, onSaved: (v: V) => void) {
  const [v, setV] = useState(value);
  const [seen, setSeen] = useState(loaded);
  if (seen !== loaded) { setSeen(loaded); setV(value); }
  const [save, setSave] = useState<SaveState>({ state: "idle" });
  // onSaved is stable (useCallback all the way up), so the saver can keep the one it was made with.
  const [saver] = useState(() => createAutosaver({
    delay: 800,
    save: async (val: V) => { try { const r = await put(path, val); if (r.ok) onSaved(val); return r.ok; } catch { return false; } },
    onState: setSave,
  }));
  // Leaving the page with a change still waiting: ask first.
  useEffect(() => {
    if (save.state !== "pending" && save.state !== "saving" && save.state !== "error") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save.state]);
  const change = (next: V, now = false) => { setV(next); saver.schedule(next); if (now) void saver.flush(); };
  return { v, change, flush: () => void saver.flush(), retry: () => void saver.retry(), save };
}

function SaveStatus({ t, lang, save, invalid, retry }: { t: Dict; lang: Lang; save: SaveState; invalid?: boolean; retry: () => void }) {
  const time = save.at ? new Date(save.at).toLocaleTimeString(lang === "EN" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <p role="status" aria-live="polite" className="flex min-h-6 items-center gap-2 text-[14px] text-[var(--muted)]">
      {invalid ? <span className="text-[var(--destructive)]">{t.fixFirst}</span>
        : save.state === "pending" || save.state === "saving" ? <span>{t.saving}</span>
        : save.state === "saved" ? <span>{t.savedAt} · {time}</span>
        : save.state === "error" ? <><span className="text-[var(--destructive)]">{t.notSaved}</span><button type="button" className={`${link} text-[var(--foreground)]`} onClick={retry}>{t.retry}</button></>
        : null}
    </p>
  );
}

function Badge({ t, status }: { t: Dict; status: "empty" | "draft" | "published" }) {
  const tone = status === "draft" ? "border-[var(--accent)] text-[var(--accent)]" : status === "published" ? "border-[var(--border)] text-[var(--text-secondary)]" : "border-dashed border-[var(--border)] text-[var(--muted)]";
  return <span data-status={status} className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[13px] ${tone}`}>{t.status[status]}</span>;
}

function PersonEditor({ id, t, lang, name, value, live, loaded, onSaved }: {
  id: string; t: Dict; lang: Lang; name: string; value: PersonMedia; live: PersonMedia | undefined; loaded: number; onSaved: (id: string, v: PersonMedia) => void;
}) {
  const saved = useCallback((v: PersonMedia) => onSaved(id, v), [id, onSaved]);
  const { v, change, flush, retry, save } = useCard(`person/${id}`, value, loaded, saved);
  const [crop, setCrop] = useState<ImageBitmap | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const status = cardStatus(value, live);

  const pick = async (f: File | undefined) => { if (f) setCrop(await createImageBitmap(f, { imageOrientation: "from-image" })); };
  const useCrop = async (canvas: HTMLCanvasElement) => {
    setUploading(true);
    try { const pid = await uploadBlob(await toJpeg(canvas, OUTPUT.h)); setCrop(null); change({ ...v, portrait: pid }, true); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <li>
      <details id={`person-${id}`} className="group scroll-mt-40 rounded-lg border border-[var(--border)]">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-3 marker:hidden">
          <FamilyPortrait id={v.portrait} name={name} alt="" size={40} />
          <span className="min-w-0 flex-1 font-serif text-[17px] leading-snug text-[var(--foreground)]">{name}</span>
          <Badge t={t} status={status} />
        </summary>
        <div className="border-t border-[var(--border)] p-4">
          <h3 className="sr-only">{name}</h3>
          <div className="flex items-center gap-4">
            <FamilyPortrait id={v.portrait} name={name} alt="" size={72} />
            <div className="flex flex-wrap gap-2">
              <label className={`${btnSecondary} cursor-pointer`}>
                {v.portrait ? t.replace : t.upload}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" disabled={uploading} onChange={(e) => pick(e.target.files?.[0])} />
              </label>
              {v.portrait && <button type="button" className={btnSecondary} onClick={() => change({ ...v, portrait: null }, true)}>{t.remove}</button>}
            </div>
          </div>
          {crop && <Cropper t={t} bitmap={crop} busy={uploading} onCancel={() => setCrop(null)} onUse={useCrop} />}
          <label className={`${label} mt-4`}>{t.altEN}<input className={field} value={v.altEN} maxLength={300} onChange={(e) => change({ ...v, altEN: e.target.value })} onBlur={flush} /></label>
          <label className={`${label} mt-3`}>{t.altRU}<input className={field} value={v.altRU} maxLength={300} onChange={(e) => change({ ...v, altRU: e.target.value })} onBlur={flush} /></label>
          <div className="mt-3"><SaveStatus t={t} lang={lang} save={save} retry={retry} /></div>
        </div>
      </details>
    </li>
  );
}

/**
 * Portrait crop in a 4:5 frame. Starts at the largest 4:5 region of the photo, at the top; zoom out
 * as far as the whole photo (the rest of the frame becomes a plain background), drag or use the
 * arrow keys to position. The uploaded file is the frame scaled to 1024×1280 with exactly the same
 * geometry as the preview.
 */
const CROP_BG = "#ecebe7";
function Cropper({ t, bitmap, busy, onCancel, onUse }: { t: Dict; bitmap: ImageBitmap; busy: boolean; onCancel: () => void; onUse: (c: HTMLCanvasElement) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const iw = bitmap.width, ih = bitmap.height;
  const [st, setSt] = useState(() => initial(iw, ih));
  const drag = useRef<{ px: number; py: number; x: number; y: number; k: number } | null>(null);
  const range = zoomRange(iw, ih);
  const geo = place({ iw, ih, ...st });

  useEffect(() => {
    const g = ref.current?.getContext("2d"); if (!g) return;
    g.fillStyle = CROP_BG; g.fillRect(0, 0, FRAME.w, FRAME.h);
    g.drawImage(bitmap, geo.x, geo.y, geo.w, geo.h);
  }, [bitmap, geo.x, geo.y, geo.w, geo.h]);

  const render = () => {
    const out = document.createElement("canvas"); out.width = OUTPUT.w; out.height = OUTPUT.h;
    const g = out.getContext("2d")!; const k = OUTPUT.w / FRAME.w;
    g.fillStyle = CROP_BG; g.fillRect(0, 0, OUTPUT.w, OUTPUT.h);
    g.imageSmoothingQuality = "high";
    g.drawImage(bitmap, geo.x * k, geo.y * k, geo.w * k, geo.h * k);
    onUse(out);
  };
  const pan = (dx: number, dy: number) => setSt((s) => { const p = place({ iw, ih, ...s, x: geo.x + dx, y: geo.y + dy }); return { ...s, x: p.x, y: p.y }; });
  const zoomBy = (d: number) => setSt((s) => rezoom({ iw, ih, ...s }, s.zoom + d));

  return (
    <div className="mt-4 rounded-md border border-[var(--border)] p-3" data-cropper="">
      <p id="crop-hint" className={META}>{t.cropHint}</p>
      <canvas ref={ref} width={FRAME.w} height={FRAME.h} tabIndex={0} role="img" aria-label={t.cropFrame} aria-describedby="crop-hint"
        className="mt-2 h-auto touch-none rounded-md border border-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        style={{ width: "min(360px, 100%, calc((100svh - 300px) * 0.8))" }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 10;
          const keys: Record<string, () => void> = {
            ArrowLeft: () => pan(-step, 0), ArrowRight: () => pan(step, 0), ArrowUp: () => pan(0, -step), ArrowDown: () => pan(0, step),
            "+": () => zoomBy(0.05), "=": () => zoomBy(0.05), "-": () => zoomBy(-0.05), _: () => zoomBy(-0.05),
          };
          if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
        }}
        onPointerDown={(e) => {
          // Pointer moves are in CSS pixels; the canvas may be drawn smaller than its 360px.
          const k = FRAME.w / e.currentTarget.getBoundingClientRect().width;
          drag.current = { px: e.clientX, py: e.clientY, x: geo.x, y: geo.y, k }; e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current; if (!d) return;
          setSt((s) => { const p = place({ iw, ih, ...s, x: d.x + (e.clientX - d.px) * d.k, y: d.y + (e.clientY - d.py) * d.k }); return { ...s, x: p.x, y: p.y }; });
        }}
        onPointerUp={() => { drag.current = null; }} />
      <label className={`${label} mt-2`}>{t.zoom}
        <input type="range" min={range.min} max={range.max} step={0.01} value={st.zoom}
          aria-valuetext={`${t.zoom} ${Math.round(st.zoom * 100)} %`} style={{ accentColor: "var(--accent)" }}
          onChange={(e) => setSt((s) => rezoom({ iw, ih, ...s }, Number(e.target.value)))} className="mt-1 w-full" />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} onClick={() => setSt((s) => rezoom({ iw, ih, ...s }, range.min))}>{t.fitWhole}</button>
        <button type="button" className={btnSecondary} onClick={() => setSt(initial(iw, ih))}>{t.fillFrame}</button>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className={btnPrimary} disabled={busy} onClick={render}>{busy ? t.uploading : t.apply}</button>
        <button type="button" className={btnSecondary} disabled={busy} onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  );
}

/** Year / month / day for a partial date; stores "YYYY", "YYYY-MM" or "YYYY-MM-DD" as before. */
function DateFields({ t, lang, legend, value, idBase, onValid, onInvalid, onBlur }: {
  t: Dict; lang: Lang; legend: string; value: string; idBase: string;
  onValid: (v: string) => void; onInvalid: (bad: boolean) => void; onBlur: () => void;
}) {
  const [parts, setParts] = useState(() => splitDate(value));
  const [known, setKnown] = useState(value);
  if (known !== value) { setKnown(value); setParts(splitDate(value)); }
  const res = joinDate(parts);
  const update = (next: typeof parts) => {
    setParts(next);
    const r = joinDate(next);
    onInvalid(Boolean(r.error));
    if (!r.error) { setKnown(r.value); onValid(r.value); }
  };
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleString(lang === "EN" ? "en-GB" : "ru-RU", { month: "long", timeZone: "UTC" }));
  const err = res.error ? t.dateErr[res.error as keyof Dict["dateErr"]] : "";
  return (
    <fieldset className="min-w-0" aria-describedby={err ? `${idBase}-err` : undefined}>
      <legend className={label}>{legend}</legend>
      <div className="mt-1 grid grid-cols-[5.5rem_1fr_4.5rem] gap-2">
        <label className="text-[13px] text-[var(--muted)]">{t.year}
          <input className={field} inputMode="numeric" maxLength={4} value={parts.y} aria-invalid={res.error === "year" || res.error === "year_required"}
            onChange={(e) => update({ ...parts, y: e.target.value.replace(/\D/g, "") })} onBlur={onBlur} />
        </label>
        <label className="text-[13px] text-[var(--muted)]">{t.month}
          <select className={field} value={parts.m} onChange={(e) => update({ ...parts, m: e.target.value })} onBlur={onBlur}>
            <option value="">{t.noMonth}</option>
            {months.map((m, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
          </select>
        </label>
        <label className="text-[13px] text-[var(--muted)]">{t.day}
          <input className={field} inputMode="numeric" maxLength={2} value={parts.d} aria-invalid={res.error === "day" || res.error === "day_without_month"}
            onChange={(e) => update({ ...parts, d: e.target.value.replace(/\D/g, "") })} onBlur={onBlur} />
        </label>
      </div>
      {err && <p id={`${idBase}-err`} className="mt-1 text-[14px] text-[var(--destructive)]">{err}</p>}
    </fieldset>
  );
}

/** A textarea that grows with its text (at least six lines), helper text below via aria-describedby. */
function StoryField({ labelText, hint, id, value, onChange, onBlur }: { labelText: string; hint: string; id: string; value: string; onChange: (v: string) => void; onBlur: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = (el: HTMLTextAreaElement | null) => { if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; };
  useEffect(() => { fit(ref.current); }, [value]);
  return (
    <div className="mt-3">
      <label htmlFor={id} className={label}>{labelText}</label>
      <textarea ref={ref} id={id} rows={6} aria-describedby={`${id}-hint`} className={`${field} resize-none overflow-hidden leading-[1.55]`}
        value={value} maxLength={6000} onChange={(e) => { onChange(e.target.value); fit(e.currentTarget); }} onBlur={onBlur} />
      <p id={`${id}-hint`} className={`${META} mt-1`}>{hint}</p>
    </div>
  );
}

function EventEditor({ id, t, lang, heading, value, live, loaded, onSaved }: {
  id: string; t: Dict; lang: Lang; heading: string; value: EventMedia; live: EventMedia | undefined; loaded: number; onSaved: (id: string, v: EventMedia) => void;
}) {
  const saved = useCallback((v: EventMedia) => onSaved(id, v), [id, onSaved]);
  const { v, change, flush, retry, save } = useCard(`event/${id}`, value, loaded, saved);
  const [uploading, setUploading] = useState(false);
  const [badFrom, setBadFrom] = useState(false);
  const [badTo, setBadTo] = useState(false);
  const status = cardStatus(value, live);
  const chips = eventChips(v);
  const set = (k: keyof EventMedia) => (e: React.ChangeEvent<HTMLInputElement>) => change({ ...v, [k]: e.target.value });

  const addPhoto = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const pid = await uploadBlob(await toJpeg(await createImageBitmap(f, { imageOrientation: "from-image" })));
      change({ ...v, photos: [...v.photos, { id: pid, captionEN: "", captionRU: "" }] }, true);
    } finally { setUploading(false); }
  };
  const setPhoto = (i: number, k: "captionEN" | "captionRU", val: string) => change({ ...v, photos: v.photos.map((p, j) => (j === i ? { ...p, [k]: val } : p)) });

  return (
    <details id={`event-${id}`} className="scroll-mt-40 rounded-lg border border-[var(--border)]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 marker:hidden">
        <span className="min-w-0 flex-1 font-serif text-[18px] leading-snug text-[var(--foreground)]">{heading}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c.kind} className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[13px] text-[var(--text-secondary)]">
              {c.kind === "photos" ? t.chip.photos(c.n ?? 0) : t.chip[c.kind as "story" | "dates"]}
            </span>
          ))}
          <Badge t={t} status={status} />
        </span>
      </summary>
      <div className="border-t border-[var(--border)] p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <DateFields t={t} lang={lang} legend={t.from} value={v.dateFrom} idBase={`${id}-from`} onValid={(d) => change({ ...v, dateFrom: d })} onInvalid={setBadFrom} onBlur={flush} />
          <DateFields t={t} lang={lang} legend={t.to} value={v.dateTo} idBase={`${id}-to`} onValid={(d) => change({ ...v, dateTo: d })} onInvalid={setBadTo} onBlur={flush} />
          <label className={label}>{t.placesEN}<input className={field} value={v.placesEN} onChange={set("placesEN")} onBlur={flush} /></label>
          <label className={label}>{t.placesRU}<input className={field} value={v.placesRU} onChange={set("placesRU")} onBlur={flush} /></label>
          <label className={label}>{t.professionEN}<input className={field} value={v.professionEN} onChange={set("professionEN")} onBlur={flush} /></label>
          <label className={label}>{t.professionRU}<input className={field} value={v.professionRU} onChange={set("professionRU")} onBlur={flush} /></label>
        </div>
        <StoryField labelText={t.storyEN} hint={t.storyHint} id={`${id}-story-en`} value={v.storyEN} onChange={(s) => change({ ...v, storyEN: s })} onBlur={flush} />
        <StoryField labelText={t.storyRU} hint={t.storyHint} id={`${id}-story-ru`} value={v.storyRU} onChange={(s) => change({ ...v, storyRU: s })} onBlur={flush} />

        <h4 className="mt-6 text-[15px] font-medium text-[var(--foreground)]">{t.photos}</h4>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {v.photos.map((p, i) => (
            <li key={p.id} className="rounded-md border border-[var(--border)] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, session-checked file */}
              <img src={mediaUrl(p.id, 640)} alt="" className="max-h-60 w-full rounded bg-[var(--surface)] object-contain" />
              <label className={`${label} mt-2`}>{t.captionEN}<input className={field} value={p.captionEN} onChange={(e) => setPhoto(i, "captionEN", e.target.value)} onBlur={flush} /></label>
              <label className={`${label} mt-2`}>{t.captionRU}<input className={field} value={p.captionRU} onChange={(e) => setPhoto(i, "captionRU", e.target.value)} onBlur={flush} /></label>
              <button type="button" className={`${btnSecondary} mt-2`} onClick={() => change({ ...v, photos: v.photos.filter((_, j) => j !== i) }, true)}>{t.remove}</button>
            </li>
          ))}
        </ul>
        {v.photos.length < 8 && (
          <label className={`${btnSecondary} mt-3 cursor-pointer`}>
            {uploading ? t.uploading : t.addPhoto}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" disabled={uploading} onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        <div className="mt-4"><SaveStatus t={t} lang={lang} save={save} invalid={badFrom || badTo} retry={retry} /></div>
      </div>
    </details>
  );
}
