"use client";

/**
 * Engine rules for the admin (Stage 3a, bus 77): what each rule does, its state, and what happened in the
 * last 7 days (counts only). bus 157b D1: ONE three-state control per rule — Выкл · Пробный · Включено — a native
 * radio group (arrow keys move and choose, one Tab stop), so no contradictory state can be shown or set. The badge
 * mirrors the state with one label each. «Включено» means real emails to the family, so the first switch to it
 * per rule asks first. States map onto the service's two flags (PATCH /rules/:id):
 *   Выкл = enabled:false (dry_run parked at true, so flipping `enabled` alone can never go live) ·
 *   Пробный = enabled:true, dry_run:true · Включено = enabled:true, dry_run:false.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OsRule } from "../lib/family-os";
import { BTN_PRIMARY, BTN_SECONDARY, OS_H2 } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";
import { ruleMode, ruleBody, type RuleMode } from "../lib/family-rules.mjs";

type Lang = "EN" | "RU";
const NAMES: Record<Lang, Record<string, [string, string]>> = {
  RU: {
    digest: ["Утренняя сводка", "В выбранное время (обычно 07:00): дела на сегодня. Ребёнку — только его дела."],
    evening_checkin: ["Вечерняя отметка", "Для тех, кто включил у себя: что ещё не отмечено сегодня."],
    documents_in_digest: ["Документы в сводке", "Строка о документах, которые истекли или истекают в ближайшие 3 месяца. Только тем, кто видит эти документы."],
    missed_routine_parent_note: ["Заметка родителям", "Если пункт ребёнка трижды подряд не отмечен — спокойная строка родителям. Ребёнку — никогда."],
    council_reminder: ["Напоминание о совете", "Воскресенье, 18:00: в 19:00 семейный совет. Всем членам семьи."],
    board_new_tasks: ["Новые задачи в сводке", "Строка «Новые задачи: N — принять» в утренней сводке. Только исполнителю."],
    plan_ready: ["План на завтра готов", "20:30: план на завтра собран — утвердить. Только родителям, если план ещё не утверждён."],
    needs_decision: ["Нужно решение", "19:00: есть задачи с «Не могу». Только родителям."],
  },
  EN: {
    digest: ["Morning summary", "At each person's time (usually 07:00): today's items. A child gets only their own."],
    evening_checkin: ["Evening check-in", "For those who switched it on: what is still open today."],
    documents_in_digest: ["Documents in the summary", "A line about documents expired or expiring within 3 months — only to people who may see them."],
    missed_routine_parent_note: ["Note to parents", "When a child's item goes unticked three times in a row: a calm line to the parents. Never to the child."],
    council_reminder: ["Council reminder", "Sunday 18:00: family council at 19:00. To every member."],
    board_new_tasks: ["New tasks in the summary", "The line “New tasks: N — accept” in the morning summary. To the assignee only."],
    plan_ready: ["Tomorrow's plan is ready", "20:30: tomorrow's plan is built — approve it. To parents only, if not yet approved."],
    needs_decision: ["Needs a decision", "19:00: some tasks got “Can't”. To parents only."],
  },
};
const T = {
  RU: { mode: { off: "Выкл", dry: "Пробный", send: "Включено" }, chip: { off: "Выключено", dry: "Только запись", send: "Письма уходят" }, modeLabel: "Режим", title: "Правила", intro: "Что движок делает сам. «Пробный» — письма не уходят, только запись о том, что ушло бы. «Включено» — письма уходят семье.", last: "За 7 дней", sent: "отправлено", dry_run: "в пробном режиме", skipped: "пропущено (выключено у человека, тихие часы, лимит)", none: "событий не было", confirm: "Письма начнут уходить семье. Включить правило?", yes: "Да, отправлять", no: "Отмена", saved: "Сохранено.", error: "Не удалось сохранить" },
  EN: { mode: { off: "Off", dry: "Dry run", send: "On" }, chip: { off: "Off", dry: "Recording only", send: "Emails go out" }, modeLabel: "Mode", title: "Rules", intro: "What the engine does by itself. “Dry run” sends nothing — it only records what would have gone. “On” sends emails to the family.", last: "Last 7 days", sent: "sent", dry_run: "in dry run", skipped: "skipped (turned off by the person, quiet hours, cap)", none: "nothing yet", confirm: "Emails will start going to the family. Switch the rule on?", yes: "Yes, send", no: "Cancel", saved: "Saved.", error: "Could not save" },
} as const;
const MODES: RuleMode[] = ["off", "dry", "send"];

const send = (id: string, body: unknown) => fetch(`/api/family-os/rules/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null);

export default function FamilyRules({ lang, rules }: { lang: Lang; rules: OsRule[] }) {
  const t = tx(T, lang);
  return (
    <section id="rules" aria-labelledby="rules-h" data-rules="" className="mt-12 scroll-mt-24">
      <h2 id="rules-h" className={OS_H2}>{t.title}</h2>
      <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.intro}</p>
      <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {rules.map((r) => <RuleRow key={r.id} lang={lang} r={r} />)}
      </ul>
    </section>
  );
}

function RuleRow({ lang, r }: { lang: Lang; r: OsRule }) {
  const t = tx(T, lang);
  const router = useRouter();
  const [mode, setMode] = useState<RuleMode>(ruleMode(r));
  const [ask, setAsk] = useState(false);
  // «Включено» asks once per rule on this page; after a yes, switching back and forth does not ask again.
  const [confirmed, setConfirmed] = useState(false);
  const [msg, setMsg] = useState("");
  const [name, desc] = tx(NAMES, lang)[r.id] ?? [r.id, ""];
  const save = async (next: RuleMode) => {
    const prev = mode; setMode(next); setAsk(false); setMsg("");
    const res = await send(r.id, ruleBody(next));
    if (res?.ok) { setMsg(t.saved); router.refresh(); } else { setMode(prev); setMsg(t.error); }
  };
  const choose = (next: RuleMode) => {
    if (next === mode) return;
    if (next === "send" && !confirmed) { setAsk(true); return; }
    void save(next);
  };
  const skipped = (r.last7.opted_out ?? 0) + (r.last7.quiet_hours ?? 0) + (r.last7.daily_cap ?? 0) + (r.last7.no_email ?? 0);
  const counts = [r.last7.sent ? `${r.last7.sent} ${t.sent}` : null, r.last7.dry_run ? `${r.last7.dry_run} ${t.dry_run}` : null, skipped ? `${skipped} ${t.skipped}` : null].filter(Boolean);
  const group = `rule-${r.id}`;
  return (
    <li data-rule={r.id} className="py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p id={`${group}-name`} className="text-[17px] text-[var(--foreground)]">{name}</p>
        {/* the state in one word, mirroring the control (bus 78 #6, 157b D1) */}
        <span data-rule-state={mode}
          className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[14px] font-medium ${mode === "send" ? "border-[var(--accent)] text-[var(--accent)]" : mode === "dry" ? "border-[var(--border)] text-[var(--text-secondary)]" : "border-[var(--border)] text-[var(--muted)]"}`}>
          {t.chip[mode]}
        </span>
      </div>
      <p className="mt-1 text-[15px] text-[var(--text-secondary)]">{desc}</p>
      <fieldset data-rule-mode="" disabled={ask} className="mt-3">
        <legend className="sr-only">{t.modeLabel}: {name}</legend>
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
          {MODES.map((k, i) => (
            <label key={k} data-mode={k}
              className={`inline-flex min-h-11 cursor-pointer items-center px-4 text-[15px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[var(--accent)] ${i > 0 ? "border-l border-[var(--border)]" : ""} ${mode === k ? "bg-[var(--fos-primary)] font-medium text-[var(--fos-on-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"}`}>
              <input type="radio" name={group} value={k} className="sr-only" checked={mode === k} onChange={() => choose(k)} />
              {t.mode[k]}
            </label>
          ))}
        </div>
      </fieldset>
      {ask && (
        <div data-confirm-rule="" role="alertdialog" aria-label={t.confirm} className="mt-3 max-w-[60ch] rounded-md border border-[var(--accent)] p-3">
          <p className="text-[15px] text-[var(--foreground)]">{t.confirm}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" autoFocus className={BTN_PRIMARY} onClick={() => { setConfirmed(true); void save("send"); }}>{t.yes}</button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setAsk(false)}>{t.no}</button>
          </div>
        </div>
      )}
      <p className="mt-2 text-[14px] text-[var(--muted)]">{t.last}: {counts.length ? counts.join(" · ") : t.none}</p>
      {msg && <p role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</p>}
    </li>
  );
}
