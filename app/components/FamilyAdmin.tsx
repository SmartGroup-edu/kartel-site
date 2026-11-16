"use client";

/**
 * The family editor (admins only): portraits for people on the tree, and dates, places,
 * professions, a short story and photos for chronicle entries. Everything is saved as a draft and
 * becomes visible in /family only after "Publish". Names and the existing chronicle text are not
 * editable here. Photos are downsized (and their EXIF dropped) in the browser before upload; the
 * service re-encodes them again and keeps no original.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { useLangToggle } from "./useLang";
import { H1, H2, H3, EYEBROW, META } from "../lib/typeScale";

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

const EMPTY_PERSON: PersonMedia = { portrait: null, altEN: "", altRU: "" };
const EMPTY_EVENT: EventMedia = { dateFrom: "", dateTo: "", placesEN: "", placesRU: "", professionEN: "", professionRU: "", storyEN: "", storyRU: "", photos: [] };

const T = {
  EN: {
    eyebrow: "Family Heritage", title: "Family editor",
    intro: "Add portraits and chronicle details. Changes stay a draft until you publish them; then they appear in Family Heritage.",
    off: "The photo and story service is not connected yet, so nothing can be saved.",
    people: "People", entries: "Chronicle entries",
    publish: "Publish", undo: "Undo last change", publishedAt: "Last published", never: "never",
    save: "Save draft", saved: "Draft saved.", published: "Published.", undone: "Last change undone.", nothingToUndo: "Nothing to undo.",
    portrait: "Portrait", upload: "Upload portrait", replace: "Replace", remove: "Remove", useCrop: "Use this crop", cancel: "Cancel",
    zoom: "Zoom", cropHint: "Drag the photo to position it in the square.",
    altEN: "Description for screen readers (EN)", altRU: "Description for screen readers (RU)",
    dateFrom: "From (YYYY, YYYY-MM or YYYY-MM-DD)", dateTo: "To (optional)",
    placesEN: "Places (EN)", placesRU: "Places (RU)", professionEN: "Profession (EN)", professionRU: "Profession (RU)",
    storyEN: "Short story (EN)", storyRU: "Short story (RU)", storyHint: "Plain text. A blank line starts a new paragraph.",
    photos: "Photos", addPhoto: "Add photo", captionEN: "Caption (EN)", captionRU: "Caption (RU)",
    uploading: "Uploading…", error: "Could not save", loadError: "Could not load the draft",
  },
  RU: {
    eyebrow: "Семейное наследие", title: "Редактор семьи",
    intro: "Добавляйте портреты и подробности хроники. Изменения остаются черновиком до публикации; после неё они появляются в «Семейном наследии».",
    off: "Сервис фото и историй ещё не подключён, сохранить пока ничего нельзя.",
    people: "Люди", entries: "Записи хроники",
    publish: "Опубликовать", undo: "Отменить последнее изменение", publishedAt: "Последняя публикация", never: "ещё не было",
    save: "Сохранить черновик", saved: "Черновик сохранён.", published: "Опубликовано.", undone: "Последнее изменение отменено.", nothingToUndo: "Отменять нечего.",
    portrait: "Портрет", upload: "Загрузить портрет", replace: "Заменить", remove: "Убрать", useCrop: "Обрезать так", cancel: "Отмена",
    zoom: "Масштаб", cropHint: "Перетащите фото, чтобы выбрать кадр в квадрате.",
    altEN: "Описание для скринридеров (EN)", altRU: "Описание для скринридеров (RU)",
    dateFrom: "С (ГГГГ, ГГГГ-ММ или ГГГГ-ММ-ДД)", dateTo: "По (необязательно)",
    placesEN: "Места (EN)", placesRU: "Места (RU)", professionEN: "Профессия (EN)", professionRU: "Профессия (RU)",
    storyEN: "Короткая история (EN)", storyRU: "Короткая история (RU)", storyHint: "Обычный текст. Пустая строка начинает новый абзац.",
    photos: "Фотографии", addPhoto: "Добавить фото", captionEN: "Подпись (EN)", captionRU: "Подпись (RU)",
    uploading: "Загрузка…", error: "Не удалось сохранить", loadError: "Не удалось загрузить черновик",
  },
} as const;

const api = (path: string, init?: RequestInit) => fetch(`/api/family-admin/${path}`, { ...init, credentials: "same-origin", cache: "no-store" });
const mediaUrl = (id: string, w = 256) => `/api/family-media/${id}/${w}.webp`;

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
const btn = "inline-flex min-h-11 items-center rounded-md px-4 text-[15px] font-medium transition-colors disabled:opacity-50";
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]`;
const btnSecondary = `${btn} border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]`;

export default function FamilyAdmin({ lang, enabled, people, entries }: { lang: Lang; enabled: boolean; people: Person[]; entries: Entry[] }) {
  const t = T[lang];
  const toggleLang = useLangToggle(lang);
  const [draft, setDraft] = useState<Content>({ persons: {}, events: {} });
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api("draft");
    if (!r.ok) { setStatus(`${t.loadError} (${r.status})`); return; }
    const d = (await r.json()) as { content: Content; published: { at: string | null } };
    setDraft(d.content); setPublishedAt(d.published.at);
  }, [t.loadError]);

  // First load: state is set only in the promise callback, never synchronously in the effect.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api("draft").then(async (r) => {
      if (!alive) return;
      if (!r.ok) { setStatus(`${t.loadError} (${r.status})`); return; }
      const d = (await r.json()) as { content: Content; published: { at: string | null } };
      if (alive) { setDraft(d.content); setPublishedAt(d.published.at); }
    }).catch(() => alive && setStatus(t.loadError));
    return () => { alive = false; };
  }, [enabled, t.loadError]);

  const run = async (fn: () => Promise<Response>, ok: string) => {
    setBusy(true); setStatus("");
    try {
      const r = await fn();
      if (!r.ok) { setStatus(`${t.error} (${r.status})`); return false; }
      setStatus(ok); await load(); return true;
    } catch { setStatus(t.error); return false; } finally { setBusy(false); }
  };

  const savePerson = (id: string, body: PersonMedia) => run(() => api(`person/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), t.saved);
  const saveEvent = (id: string, body: EventMedia) => run(() => api(`event/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), t.saved);
  const undo = async () => {
    setBusy(true);
    try { const r = await api("undo", { method: "POST" }); const j = r.ok ? await r.json() : null; setStatus(!r.ok ? `${t.error} (${r.status})` : j?.undone ? t.undone : t.nothingToUndo); await load(); } finally { setBusy(false); }
  };

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
            <div className="sticky top-20 z-10 mt-8 flex lg:top-24 flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <button type="button" className={btnPrimary} disabled={busy} onClick={() => run(() => api("publish", { method: "POST" }), t.published)}>{t.publish}</button>
              <button type="button" className={btnSecondary} disabled={busy} onClick={undo}>{t.undo}</button>
              <span className={META}>{t.publishedAt}: {publishedAt ? new Date(publishedAt).toLocaleString(lang === "EN" ? "en-GB" : "ru-RU") : t.never}</span>
              <span role="status" aria-live="polite" className="text-[15px] text-[var(--accent)]">{status}</span>
            </div>

            <section className="mt-12" aria-labelledby="people-h">
              <h2 id="people-h" className={H2}>{t.people}</h2>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {people.map((p) => (
                  <PersonEditor key={p.id} t={t} name={lang === "EN" ? p.nameEN : p.nameRU} value={draft.persons[p.id] ?? EMPTY_PERSON} busy={busy}
                    onSave={(v) => savePerson(p.id, v)} />
                ))}
              </ul>
            </section>

            <section className="mt-14" aria-labelledby="entries-h">
              <h2 id="entries-h" className={H2}>{t.entries}</h2>
              <div className="mt-6 space-y-4">
                {entries.map((e) => (
                  <EventEditor key={e.id} t={t} heading={lang === "EN" ? `${e.yearEN} — ${e.titleEN}` : `${e.yearRU} — ${e.titleRU}`}
                    value={draft.events[e.id] ?? EMPTY_EVENT} busy={busy} onSave={(v) => saveEvent(e.id, v)} />
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

type Dict = (typeof T)[Lang];

function PersonEditor({ t, name, value, busy, onSave }: { t: Dict; name: string; value: PersonMedia; busy: boolean; onSave: (v: PersonMedia) => Promise<boolean> }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(value);
  // Only this card's own saved value resets its fields; reloading after another card's save does not.
  if (JSON.stringify(saved) !== JSON.stringify(value)) { setSaved(value); setV(value); }
  const [crop, setCrop] = useState<ImageBitmap | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setCrop(await createImageBitmap(f, { imageOrientation: "from-image" }));
  };
  const useCrop = async (canvas: HTMLCanvasElement) => {
    setUploading(true);
    try {
      const id = await uploadBlob(await toJpeg(canvas, 1280));
      const next = { ...v, portrait: id };
      setV(next); setCrop(null); await onSave(next);
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <li className="rounded-lg border border-[var(--border)] p-4">
      <h3 className={H3}>{name}</h3>
      <div className="mt-3 flex items-center gap-4">
        {v.portrait ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, session-checked file; not for the image optimiser
          <img src={mediaUrl(v.portrait)} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[var(--muted)]">—</span>
        )}
        <div className="flex flex-wrap gap-2">
          <label className={btnSecondary}>
            {v.portrait ? t.replace : t.upload}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" disabled={busy || uploading} onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {v.portrait && <button type="button" className={btnSecondary} disabled={busy} onClick={() => { const next = { ...v, portrait: null }; setV(next); void onSave(next); }}>{t.remove}</button>}
        </div>
      </div>
      {crop && <Cropper t={t} bitmap={crop} busy={uploading} onCancel={() => setCrop(null)} onUse={useCrop} />}
      <label className={`${label} mt-4`}>{t.altEN}<input className={field} value={v.altEN} maxLength={300} onChange={(e) => setV({ ...v, altEN: e.target.value })} /></label>
      <label className={`${label} mt-3`}>{t.altRU}<input className={field} value={v.altRU} maxLength={300} onChange={(e) => setV({ ...v, altRU: e.target.value })} /></label>
      <button type="button" className={`${btnPrimary} mt-4`} disabled={busy} onClick={() => onSave(v)}>{t.save}</button>
    </li>
  );
}

/** Square crop: drag to position, slider to zoom. Output 1280×1280 (downsized again before upload). */
function Cropper({ t, bitmap, busy, onCancel, onUse }: { t: Dict; bitmap: ImageBitmap; busy: boolean; onCancel: () => void; onUse: (c: HTMLCanvasElement) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const SIZE = 280;

  const geometry = useCallback(() => {
    const base = Math.max(SIZE / bitmap.width, SIZE / bitmap.height) * zoom;
    const w = bitmap.width * base, h = bitmap.height * base;
    const x = Math.min(0, Math.max(SIZE - w, (SIZE - w) / 2 + off.x));
    const y = Math.min(0, Math.max(SIZE - h, (SIZE - h) / 2 + off.y));
    return { x, y, w, h };
  }, [bitmap, zoom, off]);

  useEffect(() => {
    const g = ref.current?.getContext("2d"); if (!g) return;
    const { x, y, w, h } = geometry();
    g.clearRect(0, 0, SIZE, SIZE); g.drawImage(bitmap, x, y, w, h);
  }, [bitmap, geometry]);

  const render = () => {
    const out = document.createElement("canvas"); out.width = out.height = 1280;
    const { x, y, w, h } = geometry(); const k = 1280 / SIZE;
    out.getContext("2d")!.drawImage(bitmap, x * k, y * k, w * k, h * k);
    onUse(out);
  };

  return (
    <div className="mt-4 rounded-md border border-[var(--border)] p-3">
      <p className={META}>{t.cropHint}</p>
      <canvas ref={ref} width={SIZE} height={SIZE} className="mt-2 max-w-full touch-none rounded-md"
        onPointerDown={(e) => { drag.current = { x: e.clientX - off.x, y: e.clientY - off.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current) setOff({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
        onPointerUp={() => { drag.current = null; }} />
      <label className={`${label} mt-2`}>{t.zoom}<input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-1 w-full" /></label>
      <div className="mt-3 flex gap-2">
        <button type="button" className={btnPrimary} disabled={busy} onClick={render}>{busy ? t.uploading : t.useCrop}</button>
        <button type="button" className={btnSecondary} disabled={busy} onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  );
}

function EventEditor({ t, heading, value, busy, onSave }: { t: Dict; heading: string; value: EventMedia; busy: boolean; onSave: (v: EventMedia) => Promise<boolean> }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(value);
  // Only this card's own saved value resets its fields; reloading after another card's save does not.
  if (JSON.stringify(saved) !== JSON.stringify(value)) { setSaved(value); setV(value); }
  const [uploading, setUploading] = useState(false);
  const set = (k: keyof EventMedia) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const addPhoto = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const id = await uploadBlob(await toJpeg(await createImageBitmap(f, { imageOrientation: "from-image" })));
      setV((cur) => ({ ...cur, photos: [...cur.photos, { id, captionEN: "", captionRU: "" }] }));
    } finally { setUploading(false); }
  };
  const setPhoto = (i: number, k: "captionEN" | "captionRU", val: string) => setV({ ...v, photos: v.photos.map((p, j) => (j === i ? { ...p, [k]: val } : p)) });

  return (
    <details className="rounded-lg border border-[var(--border)] p-4">
      <summary className="cursor-pointer font-serif text-[18px] text-[var(--foreground)]">{heading}</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={label}>{t.dateFrom}<input className={field} value={v.dateFrom} inputMode="numeric" pattern="\d{4}(-\d{2}(-\d{2})?)?" onChange={set("dateFrom")} /></label>
        <label className={label}>{t.dateTo}<input className={field} value={v.dateTo} inputMode="numeric" pattern="\d{4}(-\d{2}(-\d{2})?)?" onChange={set("dateTo")} /></label>
        <label className={label}>{t.placesEN}<input className={field} value={v.placesEN} onChange={set("placesEN")} /></label>
        <label className={label}>{t.placesRU}<input className={field} value={v.placesRU} onChange={set("placesRU")} /></label>
        <label className={label}>{t.professionEN}<input className={field} value={v.professionEN} onChange={set("professionEN")} /></label>
        <label className={label}>{t.professionRU}<input className={field} value={v.professionRU} onChange={set("professionRU")} /></label>
      </div>
      <p className={`${META} mt-4`}>{t.storyHint}</p>
      <label className={`${label} mt-2`}>{t.storyEN}<textarea className={`${field} min-h-32`} value={v.storyEN} maxLength={6000} onChange={set("storyEN")} /></label>
      <label className={`${label} mt-3`}>{t.storyRU}<textarea className={`${field} min-h-32`} value={v.storyRU} maxLength={6000} onChange={set("storyRU")} /></label>

      <h4 className="mt-6 text-[15px] font-medium text-[var(--foreground)]">{t.photos}</h4>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {v.photos.map((p, i) => (
          <li key={p.id} className="rounded-md border border-[var(--border)] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, session-checked file */}
            <img src={mediaUrl(p.id, 640)} alt="" className="w-full rounded" />
            <label className={`${label} mt-2`}>{t.captionEN}<input className={field} value={p.captionEN} onChange={(e) => setPhoto(i, "captionEN", e.target.value)} /></label>
            <label className={`${label} mt-2`}>{t.captionRU}<input className={field} value={p.captionRU} onChange={(e) => setPhoto(i, "captionRU", e.target.value)} /></label>
            <button type="button" className={`${btnSecondary} mt-2`} onClick={() => setV({ ...v, photos: v.photos.filter((_, j) => j !== i) })}>{t.remove}</button>
          </li>
        ))}
      </ul>
      {v.photos.length < 8 && (
        <label className={`${btnSecondary} mt-3`}>
          {uploading ? t.uploading : t.addPhoto}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" disabled={busy || uploading} onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      <div><button type="button" className={`${btnPrimary} mt-5`} disabled={busy || uploading} onClick={() => onSave(v)}>{t.save}</button></div>
    </details>
  );
}
