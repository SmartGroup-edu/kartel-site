"use client";

// Stage 3e-1 «Здоровье-лайт» on Today (plan §2.4 / §6.2; bus 86/109). Pillar: Здоровье = червлень (`--pillar-health`),
// a thin rule only. Movement and sleep are ticked for oneself; the family sees ONE weekly number, and only once three
// people tick. The evening question is opt-in and only its author reads it. No scores, no colours of judgement,
// no medical advice, no sleep hours (still to be checked against NHS figures).
import { useCallback, useEffect, useState } from "react";
import { H2, META } from "../lib/typeScale";
import { BTN_PRIMARY, BTN_SECONDARY, OS_H3 } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";

type Lang = "EN" | "RU";
type Health = {
  today: string; week_start: string;
  family: { ready: false; of: number } | { ready: true; of: number; move: number; sleep: number };
  mine: { ticks_on: boolean; evening_q_on: boolean; kind: "adult" | "child"; ticks: { date: string; kind: "move" | "sleep" }[] };
};
type Evening = { on: boolean; today: string; answers: { date: string; text: string }[] };

const T = {
  RU: {
    head: "Здоровье", lead: "Движение и сон — для себя, без оценок. Семья видит только общий итог за неделю.",
    total: (m: number, s: number, of: number) => `На этой неделе в семье отмечено: движение — ${m}, сон — ${s}. Отмечают ${of}.`,
    notYet: "Общий итог появится, когда отмечать будут хотя бы трое — так он никого не выдаёт.",
    move: "Движение сегодня", sleep: "Хороший сон этой ночью", guide: "Ориентир NHS для 5–18 лет: в среднем час движения в день.",
    ticksOn: "Отмечать движение и сон", ticksOff: "Не отмечать", adultOffer: "Хочешь отмечать движение и сон для себя? Видишь только ты; в общий итог идёт одно число.",
    turnOn: "Включить", evening: "Вечерний вопрос", eveningOffer: "Вечером один вопрос себе: «Что сегодня получилось?» Ответ видишь только ты.",
    q: "Что сегодня получилось?", save: "Сохранить", saved: "Сохранено. Видишь только ты.", cleared: "Ответ удалён.", only: "Видишь только ты.", off: "Выключить",
    error: "Не получилось — попробуй ещё раз.", on: "вкл.", offState: "выкл.",
  },
  EN: {
    head: "Health", lead: "Movement and sleep — for yourself, no scores. The family sees only one total for the week.",
    total: (m: number, s: number, of: number) => `This week the family ticked: movement — ${m}, sleep — ${s}. ${of} people tick.`,
    notYet: "The family total appears once at least three people tick — so it points at nobody.",
    move: "Moved today", sleep: "Slept well last night", guide: "NHS guide for ages 5–18: about an hour of movement a day on average.",
    ticksOn: "Tick movement and sleep", ticksOff: "Don't tick", adultOffer: "Want to tick movement and sleep for yourself? Only you see it; the family total gets one number.",
    turnOn: "Turn on", evening: "Evening question", eveningOffer: "One question to yourself in the evening: “What went well today?” Only you see the answer.",
    q: "What went well today?", save: "Save", saved: "Saved. Only you see it.", cleared: "Answer removed.", only: "Only you see it.", off: "Turn off",
    error: "Could not do that — please try again.", on: "on", offState: "off",
  },
} as const;

const btn = BTN_SECONDARY;
const send = (method: "POST" | "PUT", path: string, body: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null);

export default function FamilyHealth({ lang }: { lang: Lang }) {
  const [h, setH] = useState<Health | null>(null);
  const [ev, setEv] = useState<Evening | null>(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(() => {
    fetch("/api/family-os/health", { credentials: "same-origin", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setH).catch(() => setH(null));
    fetch("/api/family-os/evening", { credentials: "same-origin", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((e: Evening | null) => {
      setEv(e); setDraft(e?.answers.find((a) => a.date === e.today)?.text ?? "");
    }).catch(() => setEv(null));
  }, []);
  useEffect(() => { load(); }, [load]);
  const t = tx(T, lang);
  if (!h) return null;

  const ticked = (kind: "move" | "sleep") => h.mine.ticks.some((x) => x.date === h.today && x.kind === kind);
  const tick = async (kind: "move" | "sleep") => { const r = await send("POST", "health/tick", { date: h.today, kind, done: !ticked(kind) }); if (r?.ok) load(); else setMsg(t.error); };
  const prefs = async (p: { ticks_on?: boolean; evening_q_on?: boolean }) => { const r = await send("PUT", "health/prefs", p); setMsg(r?.ok ? "" : t.error); load(); };
  const save = async () => { const r = await send("PUT", `evening/${h.today}`, { text: draft }); setMsg(r?.ok ? (draft.trim() ? t.saved : t.cleared) : t.error); load(); };

  return (
    <section aria-labelledby="health-h" data-health="" className="mt-10 border-l-2 border-[var(--pillar-health)] pl-4">
      <h2 id="health-h" className={H2}>{t.head}</h2>
      <p className={`${META} mt-2 max-w-[60ch]`}>{t.lead}</p>
      <p data-health-family="" className="mt-4 text-[17px] text-[var(--foreground)]">
        {h.family.ready ? t.total(h.family.move, h.family.sleep, h.family.of) : t.notYet}
      </p>

      {h.mine.ticks_on ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-3">
            {(["move", "sleep"] as const).map((k) => (
              <button key={k} type="button" role="checkbox" aria-checked={ticked(k)} data-health-tick={k} onClick={() => tick(k)}
                className={`${btn} gap-2 ${ticked(k) ? "border-[var(--foreground)]" : ""}`}>
                <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded border border-[var(--foreground)] text-[14px]">{ticked(k) ? "✓" : ""}</span>
                {k === "move" ? t.move : t.sleep}
              </button>
            ))}
          </div>
          {h.mine.kind === "child" && <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.guide}</p>}
          <p className="mt-3"><button type="button" data-health-ticks-off="" onClick={() => prefs({ ticks_on: false })} className={btn}>{t.ticksOff}</button></p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{h.mine.kind === "adult" ? t.adultOffer : t.ticksOn}</p>
          <p className="mt-2"><button type="button" data-health-ticks-on="" onClick={() => prefs({ ticks_on: true })} className={btn}>{t.turnOn}</button></p>
        </div>
      )}

      <div data-evening="" className="mt-6">
        <h3 className={OS_H3}>{t.evening}</h3>
        {ev?.on ? (
          <form className="mt-2 flex flex-col gap-2 sm:max-w-[60ch]" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label htmlFor="evening-q" className="text-[15px] text-[var(--foreground)]">{t.q}</label>
            <p data-evening-only="" className="-mt-1 text-[14px] text-[var(--text-secondary)]">{t.only}</p>
            <input id="evening-q" data-evening-input="" value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)}
              className="block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] text-[var(--foreground)]" />
            <div className="flex flex-wrap gap-3">
              <button type="submit" data-evening-save="" className={BTN_PRIMARY}>{t.save}</button>
              <button type="button" data-evening-off="" onClick={() => prefs({ evening_q_on: false })} className={btn}>{t.off}</button>
            </div>
          </form>
        ) : (
          <>
            <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.eveningOffer}</p>
            <p className="mt-2"><button type="button" data-evening-on="" onClick={() => prefs({ evening_q_on: true })} className={btn}>{t.turnOn}</button></p>
          </>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-[15px] text-[var(--text-secondary)]">{msg}</p>
    </section>
  );
}
