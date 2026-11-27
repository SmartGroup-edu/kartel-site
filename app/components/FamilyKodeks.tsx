"use client";

/**
 * Stage 3d-1 (bus 86; plan «Наставник · Кодекс» §3): the family's Кодекс, the principle of the week and
 * Признание. The Кодекс is an agreement of the family, never rules for punishment: nothing here counts,
 * ranks or reproaches. Pillar accent: Кодекс = серебро (`--pillar-kodeks`, bus 93) — a thin rule + icon only.
 *
 * Every principle shows its crest element as a crop of /crest.jpeg at the crest explorer's marker (no new
 * artwork). The mantling has no marker on the crest, so its thumbnail is the whole crest.
 */
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Disclosure from "./Disclosure";
import { CREST_MARKERS } from "../content/crest";
import { H1, META } from "../lib/typeScale";
import { BTN_PRIMARY, BTN_SECONDARY, CARD_LABEL, OS_H2, OS_H3, RULE_VALUES } from "../lib/family-ui";
import { tx, typograph } from "../lib/typograph.mjs";
import type { OsKodeks, OsKodeksBody, OsPerson, OsPrinciple, OsRecognition } from "../lib/family-os";

/** A principle's wording comes from the family's Кодекс (service data): typographed for display only, never in a form. */
const ty = (s: string, lang: Lang) => (lang === "RU" ? typograph(s) : s);

type Lang = "EN" | "RU";
const T = {
  EN: {
    title: "The Kartel family code", lead: "An agreement of the family, not rules for punishment. Each principle grew out of an element of the coat of arms.",
    approved: (d: string) => `Approved ${d}`, draft: (v: number) => `Draft · version ${v}`, practice: "Practice of the day", meaning: "On the crest",
    history: "Versions", v: (n: number) => `Version ${n}`, by: "by", seed: "ratified by the family",
    propose: "Propose a new wording", principle: "Principle", practiceL: "Practice of the day", motto: "Motto", approvedOn: "Approved at the council on (leave empty for a draft)",
    save: "Save as a new version", saving: "Saving…", saved: "Saved as a new version.", error: "Could not save — please try again.",
    week: "Principle of the week", toKodeks: "The family code", empty: "The family code is not available right now.",
    rec: "Recognition", recLead: "Notice something good: who, which principle, a few words.", to: "To", which: "Principle", text: "What happened", send: "Send", sending: "Sending…",
    sent: "Sent.", recError: "Could not send — please try again.", fiveADay: "That is enough for today — try again tomorrow.", recWeek: "This week", recNone: "No recognitions this week yet.", open: "Notice something good", cancel: "Cancel", allAtCouncil: "All of them — at the council",
    recCouncil: "Recognitions of the week", pick: "Next week's principle", pickSave: "Choose", picked: "Chosen.", thisWeek: "This week", nextWeek: "Next week", auto: "in turn", chosen: "chosen by a parent",
  },
  RU: {
    title: "Кодекс семьи Картель", lead: "Договорённость семьи, а не правила для наказаний. Каждый принцип вырос из элемента герба.",
    approved: (d: string) => `Утверждён ${d}`, draft: (v: number) => `Черновик · версия ${v}`, practice: "Практика дня", meaning: "На гербе",
    history: "Редакции", v: (n: number) => `Редакция ${n}`, by: "—", seed: "утверждено семьёй",
    propose: "Предложить новую редакцию", principle: "Принцип", practiceL: "Практика дня", motto: "Девиз", approvedOn: "Утверждён на совете (пусто — черновик)",
    save: "Сохранить новую редакцию", saving: "Сохраняется…", saved: "Сохранено как новая редакция.", error: "Не удалось сохранить — попробуй ещё раз.",
    week: "Принцип недели", toKodeks: "Кодекс семьи", empty: "Кодекс сейчас недоступен.",
    rec: "Признание", recLead: "Заметь хорошее: кто, какой принцип, пара слов.", to: "Кому", which: "Принцип", text: "Что было", send: "Отправить", sending: "Отправляется…",
    sent: "Отправлено.", recError: "Не удалось отправить — попробуй ещё раз.", fiveADay: "На сегодня достаточно — попробуй завтра.", recWeek: "На этой неделе", recNone: "На этой неделе признаний пока нет.", open: "Отметить хорошее", cancel: "Отмена", allAtCouncil: "Все — на совете",
    recCouncil: "Признания недели", pick: "Принцип следующей недели", pickSave: "Выбрать", picked: "Выбрано.", thisWeek: "Эта неделя", nextWeek: "Следующая неделя", auto: "по очереди", chosen: "выбран родителем",
  },
} as const;

const fmtDate = (d: string, lang: Lang) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const send = (method: "POST" | "PUT", path: string, body: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" });
const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const primary = BTN_PRIMARY;
const councilHref = (lang: Lang) => `/${lang === "EN" ? "en" : "ru"}/family/os/council#council-rec-h`;
const kodeksHref = (lang: Lang, idx?: number) => `/${lang === "EN" ? "en" : "ru"}/family/os/kodeks${idx === undefined ? "" : `#p-${idx + 1}`}`;

/** The pillar icon for Кодекс (a plain shield outline), stroked in серебро. */
export function KodeksIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="shrink-0" fill="none" stroke="var(--pillar-kodeks)" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
    </svg>
  );
}

/** A round crop of the crest centred on the element's explorer marker (mantling: the whole crest). */
/**
 * Per-element crop tweaks for the thumbnails only; the explorer markers stay where they are (bus 95).
 * Лилии: the marker (y 19) sits 10 points above the crown's (y 29), so at the default zoom the lilies
 * thumbnail also showed the crown rim — centre on the middle fleur-de-lis and zoom in.
 */
export const CREST_THUMB_CROP: Record<string, { x?: number; y?: number; z?: number }> = {
  fleurdelis: { y: 20, z: 5.6 },
};

export function CrestThumb({ element, size = 64 }: { element: string; size?: number }) {
  const mk = CREST_MARKERS[element], c = CREST_THUMB_CROP[element];
  const m = mk && { x: c?.x ?? mk.x, y: c?.y ?? mk.y };
  const Z = c?.z ?? 3.2; // zoom; position so the marker lands in the centre of the circle
  // crest.jpeg is 900×1000: at width Z×box the image is Z×10/9 boxes tall. Centre point p (%) of an image
  // k boxes long → background-position (p·k − ½)/(k − 1).
  const pos = (p: number, k: number) => Math.max(0, Math.min(100, ((p / 100) * k - 0.5) / (k - 1) * 100));
  const style = m
    ? { backgroundImage: "url(/crest.jpeg)", backgroundSize: `${Z * 100}% auto`, backgroundPosition: `${pos(m.x, Z).toFixed(1)}% ${pos(m.y, (Z * 10) / 9).toFixed(1)}%` }
    : { backgroundImage: "url(/crest.jpeg)", backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" };
  return <span aria-hidden="true" data-crest-thumb={element} className="block shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)]" style={{ width: size, height: size, ...style }} />;
}

/** The Кодекс page (route /family/os/kodeks). */
export default function FamilyKodeks({ lang, kodeks, principle }: { lang: Lang; kodeks: OsKodeks | null; principle: OsPrinciple | null }) {
  const t = tx(T, lang);
  const cur = kodeks?.current ?? null;
  const name = (b: { name_ru: string; name_en: string } | null) => (b ? (lang === "EN" ? b.name_en : b.name_ru) : t.seed);
  return (
    <>
      <div data-fos-page="">
        <div className="max-w-3xl pb-8">
          {!cur ? <><h1 className={H1}>{t.title}</h1><p role="status" className="mt-6 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[16px]">{t.empty}</p></> : (
            <>
              <h1 className={`${H1} flex items-center gap-3`}><KodeksIcon size={28} />{t.title}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span data-kodeks-status={cur.status} className="inline-flex min-h-8 items-center rounded-full border border-[var(--pillar-kodeks)] px-3 text-[14px] text-[var(--foreground)]">
                  {cur.status === "approved" && cur.approved_on ? t.approved(fmtDate(cur.approved_on, lang)) : t.draft(cur.version)}
                </span>
              </p>
              <p className="mt-4 max-w-[60ch] text-[17px] leading-[1.6] text-[var(--text-body)]">{t.lead}</p>

              <ol data-kodeks="" className="mt-8 space-y-4 border-l-2 border-[var(--pillar-kodeks)] pl-4 sm:pl-6">
                {cur.body.principles.map((p, i) => (
                  <li key={p.element} id={`p-${i + 1}`} data-principle={p.element} data-week={principle?.index === i ? "" : undefined}
                    className={`flex scroll-mt-24 gap-4 rounded-lg px-1 py-3 sm:gap-5 ${principle?.index === i ? "bg-[var(--surface)] px-3" : ""}`}>
                    <CrestThumb element={p.element} size={64} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium uppercase tracking-[0.06em] text-[var(--muted)]">
                        {i + 1} · {p.element_ru}{principle?.index === i && <span className="ml-2 normal-case tracking-normal text-[var(--foreground)]">· {t.week.toLowerCase()}</span>}
                      </p>
                      <p className="mt-1 font-serif text-[20px] leading-snug text-[var(--foreground)] sm:text-[22px]">{ty(p.principle, lang)}</p>
                      <p className="mt-1.5 text-[16px] text-[var(--text-body)]"><span className="text-[var(--text-secondary)]">{t.practice}:</span> {ty(p.practice, lang)}</p>
                      <p className="mt-1 text-[14px] text-[var(--muted)]">{t.meaning}: {ty(p.meaning, lang)}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <figure data-motto="" className="mt-10 border-t border-[var(--border)] pt-6 text-center">
                <p className="font-serif text-[24px] italic tracking-wide text-[var(--accent)]" lang="la">{cur.body.motto.split(".")[0]}</p>
                <figcaption className="mx-auto mt-2 max-w-[52ch] text-[16px] leading-[1.6] text-[var(--text-body)]">{cur.body.motto.split(".").slice(1).join(".").trim()}</figcaption>
              </figure>

              <Disclosure summary={`${t.history} (${kodeks!.history.length})`} className="mt-10" variant="inline" summaryClassName="w-fit font-serif text-[20px] text-[var(--foreground)]">
                <ul data-kodeks-history="" className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {kodeks!.history.map((h) => (
                    <li key={h.version} className="py-2.5 text-[15px] text-[var(--foreground)]" suppressHydrationWarning>
                      {t.v(h.version)} · {h.status === "approved" && h.approved_on ? t.approved(fmtDate(h.approved_on, lang)) : t.draft(h.version)}
                      <span className="text-[var(--muted)]"> · {name(h.by)} · {fmtDate(h.at.slice(0, 10), lang)}</span>
                    </li>
                  ))}
                </ul>
              </Disclosure>

              {kodeks!.can.edit && <KodeksEdit lang={lang} body={cur.body} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** A parent proposes a new wording: principle + practice per element, the motto, and (optionally) the council date. */
function KodeksEdit({ lang, body }: { lang: Lang; body: OsKodeksBody }) {
  const t = tx(T, lang);
  const router = useRouter();
  const [status, setStatus] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next: OsKodeksBody = { motto: String(f.get("motto") ?? ""), principles: body.principles.map((p, i) => ({ ...p, principle: String(f.get(`principle-${i}`) ?? ""), practice: String(f.get(`practice-${i}`) ?? "") })) };
    setStatus(t.saving);
    const r = await send("POST", "kodeks", { body: next, approved_on: f.get("approved_on") || null }).catch(() => null);
    setStatus(r?.ok ? t.saved : t.error);
    if (r?.ok) router.refresh();
  };
  return (
    <Disclosure summary={t.propose} className="mt-8">
      <form onSubmit={submit} className="mt-4 space-y-5">
        {body.principles.map((p, i) => (
          <fieldset key={p.element} className="grid gap-3 sm:grid-cols-2">
            <legend className="text-[15px] font-medium text-[var(--foreground)]">{i + 1} · {p.element_ru}</legend>
            <label className={label}>{t.principle}<input name={`principle-${i}`} required maxLength={160} defaultValue={p.principle} className={field} /></label>
            <label className={label}>{t.practiceL}<input name={`practice-${i}`} required maxLength={160} defaultValue={p.practice} className={field} /></label>
          </fieldset>
        ))}
        <label className={label}>{t.motto}<textarea name="motto" required maxLength={300} rows={2} defaultValue={body.motto} className={field} /></label>
        <label className={`${label} max-w-xs`}>{t.approvedOn}<input name="approved_on" type="date" className={field} /></label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primary}>{t.save}</button>
          <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{status}</span>
        </div>
      </form>
    </Disclosure>
  );
}

/** Today: one line for everyone — the principle of the week and its practice, linked to the Кодекс.
 *  «Принцип недели» is the card's label, not a section heading (R0 25.11, bus 159): the first H2 after «Привет» is
 *  «Новые задачи». `link`: false on a child's «Мой день» (bus 172 P3) — their menu has no Кодекс, so the line is plain text. */
export function TodayPrinciple({ lang, principle, link = true }: { lang: Lang; principle: OsPrinciple; link?: boolean }) {
  const t = tx(T, lang);
  return (
    <section aria-labelledby="principle-h" data-principle-week={principle.index} className={`mt-8 flex gap-4 ${RULE_VALUES}`}>
      <span className="mt-1"><CrestThumb element={principle.element} size={44} /></span>
      <div className="min-w-0">
        <p id="principle-h" className={`${CARD_LABEL} flex items-center gap-1.5`}><KodeksIcon size={16} />{t.week}</p>
        <p className="mt-1 text-[17px] leading-snug text-[var(--foreground)]">
          {link ? <Link prefetch={false} href={kodeksHref(lang, principle.index)} className="underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{ty(principle.principle, lang)}</Link> : ty(principle.principle, lang)}
        </p>
        <p className="mt-0.5 text-[14px] text-[var(--muted)]">{t.practice}: {ty(principle.practice, lang)}</p>
      </div>
    </section>
  );
}

const personName = (p: { name_ru?: string; name_en?: string }, lang: Lang) => (lang === "EN" ? p.name_en : p.name_ru) ?? "—";

/** The week's recognitions as one list — no counts, no totals, no order by person. */
export function RecognitionList({ lang, items, headingId, heading, level = 3 }: { lang: Lang; items: OsRecognition[]; headingId: string; heading: string; level?: 2 | 3 }) {
  const t = tx(T, lang);
  // On the council the list is a section of its own (H2); inside «Признание» on Today it is a block (H3).
  const H = level === 2 ? "h2" : "h3";
  return (
    <div>
      <H id={headingId} className={level === 2 ? `${OS_H2} flex items-center gap-2` : OS_H3}>{level === 2 && <KodeksIcon />}{heading}</H>
      {items.length === 0 ? <p className="mt-2 text-[15px] text-[var(--muted)]">{t.recNone}</p> : (
        <ul data-recognitions="" className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {items.map((r) => (
            <li key={r.id} className="py-3">
              <p className="text-[14px] text-[var(--text-secondary)]">{personName(r.from, lang)} <span aria-hidden="true">→</span><span className="sr-only">,</span> {personName(r.to, lang)} · {ty(r.principle, lang)}</p>
              <p className="mt-0.5 text-[16px] leading-[1.5] text-[var(--foreground)]">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** On Today, at most three of the week's recognitions; the full list is at the council. */
export const TODAY_RECOGNITIONS = 3;

/** Today: one button «Отметить хорошее» opens the form inline; the week as a short list (≤ 3) + a link to the council. */
export function TodayRecognition({ lang, people, meId, principles, current, items, councilLink = true }: {
  lang: Lang; people: OsPerson[]; meId: string; principles: { principle: string }[]; current: number; items: OsRecognition[];
  /** false on a child's «Мой день» (bus 172 P3 QA): their menu has no «Решения», where the full list lives */ councilLink?: boolean;
}) {
  const t = tx(T, lang);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [len, setLen] = useState(0);
  const others = people.filter((p) => p.id !== meId);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    setStatus(t.sending);
    const r = await send("POST", "recognitions", { to_id: f.get("to_id"), index: Number(f.get("index")), text: String(f.get("text") ?? "").trim() }).catch(() => null);
    if (r?.status === 429) return setStatus(t.fiveADay);
    if (!r?.ok) return setStatus(t.recError);
    setStatus(t.sent); form.reset(); setLen(0); setOpen(false); router.refresh();
  };
  if (others.length === 0) return null;
  const shown = items.slice(-TODAY_RECOGNITIONS); // the service lists the week oldest first; Today shows the latest three
  return (
    <section aria-labelledby="rec-h" data-recognition="" className={`mt-10 ${RULE_VALUES}`}>
      <h2 id="rec-h" className={`${OS_H2} flex items-center gap-2`}><KodeksIcon />{t.rec}</h2>
      {!open ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" data-rec-open="" aria-expanded="false" aria-controls="rec-form" onClick={() => { setOpen(true); setStatus(""); }} className={BTN_SECONDARY}>{t.open}</button>
          {status && <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{status}</span>}
        </div>
      ) : (
        <form id="rec-form" onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <p className="text-[15px] text-[var(--text-secondary)] sm:col-span-2">{t.recLead}</p>
          <label className={label}>{t.to}
            <select name="to_id" required className={field} defaultValue="" autoFocus>
              <option value="" disabled>—</option>
              {others.map((p) => <option key={p.id} value={p.id}>{lang === "EN" ? p.name_en : p.name_ru}</option>)}
            </select>
          </label>
          <label className={label}>{t.which}
            <select name="index" className={field} defaultValue={String(current)}>
              {principles.map((p, i) => <option key={i} value={i}>{p.principle}</option>)}
            </select>
          </label>
          <label className={`${label} sm:col-span-2`}>{t.text}
            <textarea name="text" required maxLength={200} rows={2} onChange={(e) => setLen(e.target.value.length)} className={field} aria-describedby="rec-len" />
            <span id="rec-len" className="mt-1 block text-right text-[14px] font-normal text-[var(--muted)]">{len}/200</span>
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" className={primary}>{t.send}</button>
            <button type="button" onClick={() => { setOpen(false); setStatus(""); }} className={BTN_SECONDARY}>{t.cancel}</button>
            <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{status}</span>
          </div>
        </form>
      )}
      <div className="mt-6" data-rec-today="">
        <RecognitionList lang={lang} items={shown} headingId="rec-week-h" heading={t.recWeek} />
        {councilLink && items.length > 0 && <p className="mt-2"><Link prefetch={false} href={councilHref(lang)} data-rec-all="" className="inline-flex min-h-11 items-center text-[15px] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.allAtCouncil}</Link></p>}
      </div>
    </section>
  );
}

function PrincipleRow({ lang, label: l, p }: { lang: Lang; label: string; p: OsPrinciple }) {
  const t = tx(T, lang);
  return (
    <div className="flex gap-3">
      <CrestThumb element={p.element} size={44} />
      <div className="min-w-0">
        <p className="text-[14px] text-[var(--text-secondary)]">{l} · {p.picked ? t.chosen : t.auto}</p>
        <p className="text-[17px] leading-snug text-[var(--foreground)]"><Link prefetch={false} href={kodeksHref(lang, p.index)} className="underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{ty(p.principle, lang)}</Link></p>
      </div>
    </div>
  );
}

/** Council: the agenda's first item — this week's principle; a parent picks next week's (default: in turn). */
export function CouncilPrinciple({ lang, principle, canPick, principles }: { lang: Lang; principle: { this_week: OsPrinciple; next_week: OsPrinciple }; canPick: boolean; principles: { principle: string }[] }) {
  const t = tx(T, lang);
  const router = useRouter();
  const [status, setStatus] = useState("");
  const pick = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const idx = Number(new FormData(e.currentTarget).get("index"));
    setStatus(T[lang].saving);
    const r = await send("PUT", `principle/${principle.next_week.week_start}`, { index: idx }).catch(() => null);
    setStatus(r?.ok ? t.picked : t.error);
    if (r?.ok) router.refresh();
  };
  return (
    <section aria-labelledby="council-principle-h" data-council-principle="" className={`mt-10 ${RULE_VALUES}`}>
      <h2 id="council-principle-h" className={`${OS_H2} flex items-center gap-2`}><KodeksIcon />{t.week}</h2>
      <div className="mt-3 space-y-3">
        <PrincipleRow lang={lang} label={t.thisWeek} p={principle.this_week} />
        <PrincipleRow lang={lang} label={t.nextWeek} p={principle.next_week} />
      </div>
      {canPick && (
        <form onSubmit={pick} className="mt-4 flex flex-wrap items-end gap-3">
          <label className={`${label} min-w-0 flex-1 basis-64`}>{t.pick}
            <select name="index" className={field} defaultValue={String(principle.next_week.index)}>
              {principles.map((p, i) => <option key={i} value={i}>{i + 1} · {p.principle}</option>)}
            </select>
          </label>
          <button type="submit" className={primary}>{t.pickSave}</button>
          <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{status}</span>
        </form>
      )}
      <p className={`${META} mt-3`}><Link prefetch={false} href={kodeksHref(lang)} className="inline-flex min-h-11 items-center underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.toKodeks}</Link></p>
    </section>
  );
}

export const kodeksLink = kodeksHref;
export const KODEKS_T = T;
