"use client";

// Stage 3e-2 — «Вес и питание», on an adult's OWN page only (R0 18.11.2026; bus 86/109). Only the person sees it; the
// service answers 404 for anyone under 18, and this section then renders nothing. Neutral: «цель: N кг к дате»,
// «калории в день: N»; a trend of weekly means instead of daily ± changes; no BMI, no body images, no judgement colours.
// One calm GP line when the service says so. Export and delete at any time.
import { useCallback, useEffect, useState } from "react";
import { H2, META } from "../lib/typeScale";

type Lang = "EN" | "RU";
type Entry = { on_date: string; weight_kg?: number; kcal?: number };
type Goal = { weight_kg?: number; by_date?: string; kcal_day?: number };
type Body = { on: false; today: string } | { on: true; today: string; goal: Goal; entries: Entry[]; trend: { weekly: { from: string; mean: number; n: number }[] }; gp: boolean };

const T = {
  RU: {
    head: "Вес и питание", lead: "Только для тебя: никто в семье этого не видит, и это не попадает ни в какие общие итоги.",
    offer: "Можно записывать вес и калории для себя. Включается и удаляется в любой момент.", turnOn: "Включить",
    today: "Запись на сегодня", weight: "Вес, кг", kcal: "Калории за день", save: "Сохранить", saved: "Сохранено.",
    goalHead: "Цель", goalW: "Цель, кг", goalBy: "К дате", goalK: "Калории в день", goalSave: "Сохранить цель",
    goalLine: (g: Goal, fmt: (d: string) => string, dec: (v: number) => string) => [g.weight_kg !== undefined ? `цель: ${dec(g.weight_kg)} кг${g.by_date ? ` к ${fmt(g.by_date)}` : ""}` : "", g.kcal_day !== undefined ? `калории в день: ${g.kcal_day}` : ""].filter(Boolean).join(" · "),
    goalEdit: "Изменить цель", goalCancel: "Отмена", datePh: "дд.мм.гггг", dateHint: "Дата — в виде дд.мм.гггг, позже сегодняшней.",
    caption: (a: string, b: string, n: number) => `Средний вес по неделям: с ${a} до ${b} кг за ${n} ${n % 10 === 1 && n % 100 !== 11 ? "неделю" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "недели" : "недель"}`,
    trend: "Средний вес по неделям", trendNone: "Тренд появится, когда будут записи хотя бы за две недели. Пропуски ничего не значат.",
    recent: "Последние записи", gp: "Если хочется обсудить цель или темп, стоит поговорить с GP — это обычный шаг.",
    export: "Скачать мои данные", del: "Удалить все записи", delConfirm: "Все записи о весе и калориях будут удалены без возможности восстановления. Сначала можно скачать их.", delYes: "Удалить всё", delNo: "Отмена",
    off: "Выключить", error: "Не получилось — проверь числа и попробуй ещё раз.", kg: "кг", kcalU: "ккал",
  },
  EN: {
    head: "Weight and food", lead: "Only for you: nobody in the family sees it, and it never goes into any family total.",
    offer: "You can keep a note of your weight and calories for yourself. Turn it on or delete it at any time.", turnOn: "Turn on",
    today: "Today's entry", weight: "Weight, kg", kcal: "Calories today", save: "Save", saved: "Saved.",
    goalHead: "Goal", goalW: "Goal, kg", goalBy: "By", goalK: "Calories a day", goalSave: "Save goal",
    goalLine: (g: Goal, fmt: (d: string) => string, dec: (v: number) => string) => [g.weight_kg !== undefined ? `goal: ${dec(g.weight_kg)} kg${g.by_date ? ` by ${fmt(g.by_date)}` : ""}` : "", g.kcal_day !== undefined ? `calories a day: ${g.kcal_day}` : ""].filter(Boolean).join(" · "),
    goalEdit: "Change goal", goalCancel: "Cancel", datePh: "dd/mm/yyyy", dateHint: "Use dd/mm/yyyy, later than today.",
    caption: (a: string, b: string, n: number) => `Average weight by week: from ${a} to ${b} kg over ${n} ${n === 1 ? "week" : "weeks"}`,
    trend: "Average weight by week", trendNone: "The trend appears once there are entries for at least two weeks. Missed days mean nothing.",
    recent: "Recent entries", gp: "If you'd like to talk the goal or the pace through, a GP is a good person to ask — an ordinary step.",
    export: "Download my data", del: "Delete all entries", delConfirm: "All weight and calorie entries will be deleted and can't be recovered. You can download them first.", delYes: "Delete all", delNo: "Cancel",
    off: "Turn off", error: "That didn't work — check the numbers and try again.", kg: "kg", kcalU: "kcal",
  },
} as const;

const btn = "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]";
const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] text-[var(--foreground)]";
const label = "block text-[15px] text-[var(--text-secondary)]";
const call = (method: "PUT" | "DELETE", path: string, body?: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin", cache: "no-store" }).catch(() => null);
const num = (s: string) => (s.trim() === "" ? null : Number(s.trim().replace(",", ".")));
/** «дд.мм.гггг» or «dd/mm/yyyy» → ISO; "" → null; anything else → undefined. */
export const parseDay = (s: string) => {
  if (!s.trim()) return null;
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s.trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : undefined;
};

/** Weekly means as a plain line — one neutral colour, no axis judgement, no deltas. */
function Trend({ points, caption }: { points: { from: string; mean: number }[]; caption: string }) {
  const W = 320, H = 120, P = 12;
  const ys = points.map((p) => p.mean), lo = Math.min(...ys) - 1, hi = Math.max(...ys) + 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1), y = (v: number) => H - P - ((v - lo) * (H - 2 * P)) / (hi - lo);
  return (
    <figure className="mt-2">
    <svg data-body-trend="" role="img" aria-labelledby="body-trend-cap" viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[480px]">
      <polyline fill="none" stroke="var(--foreground)" strokeWidth="1.5" points={points.map((p, i) => `${x(i)},${y(p.mean)}`).join(" ")} />
      {points.map((p, i) => <circle key={p.from} cx={x(i)} cy={y(p.mean)} r="3" fill="var(--foreground)" />)}
    </svg>
    <figcaption id="body-trend-cap" data-body-trend-caption="" className="mt-1 text-[15px] text-[var(--text-secondary)]">{caption}</figcaption>
    </figure>
  );
}

export default function FamilyBody({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [b, setB] = useState<Body | null>(null);
  const [w, setW] = useState(""); const [k, setK] = useState("");
  const [gw, setGw] = useState(""); const [gby, setGby] = useState(""); const [gk, setGk] = useState("");
  const [msg, setMsg] = useState(""); const [ask, setAsk] = useState(false); const [editGoal, setEditGoal] = useState(false);
  const dec = (v: number) => (lang === "RU" ? String(v).replace(".", ",") : String(v));
  const dmy = (iso: string) => { const [y, m, d] = iso.split("-"); return lang === "RU" ? `${d}.${m}.${y}` : `${d}/${m}/${y}`; };
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  const load = useCallback(() => {
    fetch("/api/family-os/body", { credentials: "same-origin", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d: Body | null) => {
      setB(d);
      if (d?.on) { const e = d.entries.find((x) => x.on_date === d.today); setW(e?.weight_kg !== undefined ? dec(e.weight_kg) : ""); setK(e?.kcal?.toString() ?? "");
        setGw(d.goal.weight_kg !== undefined ? dec(d.goal.weight_kg) : ""); setGby(d.goal.by_date ? dmy(d.goal.by_date) : ""); setGk(d.goal.kcal_day?.toString() ?? ""); }
    }).catch(() => setB(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dec/dmy depend on lang only
  }, [lang]);
  useEffect(() => { load(); }, [load]);
  if (!b) return null; // 404 for anyone under 18 — nothing to show

  const hasGoal = b.on && (b.goal.weight_kg !== undefined || b.goal.kcal_day !== undefined || b.goal.by_date !== undefined);
  const done = (ok: boolean) => { setMsg(ok ? t.saved : t.error); if (ok) load(); };
  const saveDay = async () => { const r = await call("PUT", `body/log/${b.today}`, { weight_kg: num(w), kcal: num(k) }); done(Boolean(r?.ok)); };
  const saveGoal = async () => {
    const by = parseDay(gby); if (by === undefined) { setMsg(t.dateHint); return; }
    const r = await call("PUT", "body/goal", { weight_kg: num(gw), kcal_day: num(gk), ...(by ? { by_date: by } : {}) });
    if (r?.ok) setEditGoal(false); done(Boolean(r?.ok));
  };
  const toggle = async (on: boolean) => { const r = await call("PUT", "body/prefs", { on }); setMsg(r?.ok ? "" : t.error); load(); };
  const wipe = async () => { const r = await call("DELETE", "body"); setAsk(false); setMsg(r?.ok ? "" : t.error); load(); };

  return (
    <section aria-labelledby="body-h" data-body="" className="mt-12 border-l-2 border-[var(--pillar-health)] pl-4">
      <h2 id="body-h" className={H2}>{t.head}</h2>
      <p className={`${META} mt-2 max-w-[60ch]`}>{t.lead}</p>
      {!b.on ? (
        <>
          <p className="mt-4 max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.offer}</p>
          <p className="mt-2"><button type="button" data-body-on="" onClick={() => toggle(true)} className={btn}>{t.turnOn}</button></p>
        </>
      ) : (
        <>
          {b.gp && <p data-body-gp="" role="note" className="mt-4 max-w-[60ch] rounded-lg border border-[var(--border)] px-4 py-3 text-[15px] text-[var(--foreground)]">{t.gp}</p>}
          <form className="mt-4 grid gap-3 sm:max-w-[60ch] sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveDay(); }}>
            <h3 className="text-[17px] font-medium text-[var(--foreground)] sm:col-span-2">{t.today}</h3>
            <label className={label}>{t.weight}<input data-body-weight="" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} className={field} /></label>
            <label className={label}>{t.kcal}<input data-body-kcal="" inputMode="numeric" value={k} onChange={(e) => setK(e.target.value)} className={field} /></label>
            <p className="sm:col-span-2"><button type="submit" data-body-save="" className={btn}>{t.save}</button></p>
          </form>

          <div className="mt-6 sm:max-w-[60ch]">
            <h3 className="text-[17px] font-medium text-[var(--foreground)]">{t.goalHead}</h3>
            {hasGoal && <p data-body-goal="" className="mt-2 text-[16px] text-[var(--foreground)]">{t.goalLine(b.goal, fmt, dec)}</p>}
            {hasGoal && !editGoal ? (
              <p className="mt-2"><button type="button" data-body-goal-edit="" onClick={() => setEditGoal(true)} className={btn}>{t.goalEdit}</button></p>
            ) : (
              <form className="mt-2 grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); saveGoal(); }}>
                <label className={label}>{t.goalW}<input data-body-goal-w="" inputMode="decimal" value={gw} onChange={(e) => setGw(e.target.value)} className={field} /></label>
                <label className={label}>{t.goalBy}<input data-body-goal-by="" inputMode="numeric" lang={lang === "RU" ? "ru" : "en-GB"} placeholder={t.datePh} value={gby} onChange={(e) => setGby(e.target.value)} className={field} /></label>
                <label className={label}>{t.goalK}<input data-body-goal-k="" inputMode="numeric" value={gk} onChange={(e) => setGk(e.target.value)} className={field} /></label>
                <p className="flex flex-wrap gap-3 sm:col-span-3"><button type="submit" data-body-goal-save="" className={btn}>{t.goalSave}</button>
                  {hasGoal && <button type="button" onClick={() => { setEditGoal(false); load(); }} className={btn}>{t.goalCancel}</button>}</p>
              </form>
            )}
          </div>

          <h3 className="mt-6 text-[17px] font-medium text-[var(--foreground)]">{t.trend}</h3>
          {b.trend.weekly.length >= 2 ? <Trend points={b.trend.weekly} caption={t.caption(dec(b.trend.weekly[0].mean), dec(b.trend.weekly[b.trend.weekly.length - 1].mean), b.trend.weekly.length)} /> : <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.trendNone}</p>}

          {b.entries.length > 0 && (
            <>
              <h3 className="mt-6 text-[17px] font-medium text-[var(--foreground)]">{t.recent}</h3>
              <ul data-body-entries="" className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {b.entries.slice(-7).reverse().map((e) => (
                  <li key={e.on_date} className="py-2 text-[15px] text-[var(--foreground)]">
                    {fmt(e.on_date)}{e.weight_kg !== undefined ? ` · ${dec(e.weight_kg)} ${t.kg}` : ""}{e.kcal !== undefined ? ` · ${e.kcal} ${t.kcalU}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a data-body-export="" href="/api/family-os/body/export" download className={btn}>{t.export}</a>
            {ask ? (
              <>
                <span className="text-[15px] text-[var(--foreground)]">{t.delConfirm}</span>
                <button type="button" data-body-delete-yes="" onClick={wipe} className={btn}>{t.delYes}</button>
                <button type="button" data-body-delete-no="" autoFocus onClick={() => setAsk(false)} className={btn}>{t.delNo}</button>
              </>
            ) : <button type="button" data-body-delete="" onClick={() => { setMsg(""); setAsk(true); }} className={btn}>{t.del}</button>}
            {!ask && <button type="button" data-body-off="" onClick={() => toggle(false)} className="inline-flex min-h-11 items-center text-[15px] text-[var(--text-secondary)] underline decoration-[var(--border)] underline-offset-4">{t.off}</button>}
          </div>
        </>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-[15px] text-[var(--text-secondary)]">{msg}</p>
    </section>
  );
}
