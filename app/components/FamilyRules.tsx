"use client";

/**
 * Engine rules for the admin (Stage 3a, bus 77): on/off, dry run, and what happened in the last 7 days
 * (counts only). Leaving dry run means real emails to the family, so that step asks first.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OsRule } from "../lib/family-os";

type Lang = "EN" | "RU";
const NAMES: Record<Lang, Record<string, [string, string]>> = {
  RU: {
    digest: ["Утренняя сводка", "В выбранное время (обычно 07:00): дела на сегодня. Ребёнку — только его дела."],
    evening_checkin: ["Вечерняя отметка", "Для тех, кто включил у себя: что ещё не отмечено сегодня."],
    documents_in_digest: ["Документы в сводке", "Строка о документах, которые истекли или истекают в ближайшие 3 месяца. Только тем, кто видит эти документы."],
    missed_routine_parent_note: ["Заметка родителям", "Если пункт ребёнка трижды подряд не отмечен — спокойная строка родителям. Ребёнку — никогда."],
    council_reminder: ["Напоминание о совете", "Воскресенье, 18:00: в 19:00 семейный совет. Всем членам семьи."],
  },
  EN: {
    digest: ["Morning summary", "At each person's time (usually 07:00): today's items. A child gets only their own."],
    evening_checkin: ["Evening check-in", "For those who switched it on: what is still open today."],
    documents_in_digest: ["Documents in the summary", "A line about documents expired or expiring within 3 months — only to people who may see them."],
    missed_routine_parent_note: ["Note to parents", "When a child's item goes unticked three times in a row: a calm line to the parents. Never to the child."],
    council_reminder: ["Council reminder", "Sunday 18:00: family council at 19:00. To every member."],
  },
};
const T = {
  RU: { chipSend: "Письма уходят", chipDry: "Только запись", chipOff: "Выключено", title: "Правила", intro: "Что движок делает сам. В пробном режиме письма не уходят — только запись о том, что ушло бы.", on: "Включено", dry: "Пробный режим", last: "За 7 дней", sent: "отправлено", dry_run: "в пробном режиме", skipped: "пропущено (выключено у человека, тихие часы, лимит)", none: "событий не было", confirm: "Письма начнут уходить семье. Выключить пробный режим?", yes: "Да, отправлять", no: "Отмена", saved: "Сохранено.", error: "Не удалось сохранить" },
  EN: { chipSend: "Emails go out", chipDry: "Recording only", chipOff: "Off", title: "Rules", intro: "What the engine does by itself. In dry run nothing is sent — it only records what would have gone.", on: "On", dry: "Dry run", last: "Last 7 days", sent: "sent", dry_run: "in dry run", skipped: "skipped (turned off by the person, quiet hours, cap)", none: "nothing yet", confirm: "Emails will start going to the family. Leave dry run?", yes: "Yes, send", no: "Cancel", saved: "Saved.", error: "Could not save" },
} as const;

const send = (id: string, body: unknown) => fetch(`/api/family-os/rules/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null);
const btn = "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]";
const primary = "inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]";

export default function FamilyRules({ lang, rules }: { lang: Lang; rules: OsRule[] }) {
  const t = T[lang];
  return (
    <section id="rules" aria-labelledby="rules-h" data-rules="" className="mt-12 scroll-mt-24">
      <h2 id="rules-h" className="font-serif text-[28px] leading-[1.15] text-[var(--accent)] lg:text-[35px]">{t.title}</h2>
      <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.intro}</p>
      <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {rules.map((r) => <RuleRow key={r.id} lang={lang} r={r} />)}
      </ul>
    </section>
  );
}

function RuleRow({ lang, r }: { lang: Lang; r: OsRule }) {
  const t = T[lang];
  const router = useRouter();
  const [state, setState] = useState({ enabled: r.enabled, dry_run: r.dry_run });
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState("");
  const [name, desc] = NAMES[lang][r.id] ?? [r.id, ""];
  const save = async (next: { enabled: boolean; dry_run: boolean }) => {
    const prev = state; setState(next); setAsk(false);
    const res = await send(r.id, next);
    if (res?.ok) { setMsg(t.saved); router.refresh(); } else { setState(prev); setMsg(t.error); }
  };
  const skipped = (r.last7.opted_out ?? 0) + (r.last7.quiet_hours ?? 0) + (r.last7.daily_cap ?? 0) + (r.last7.no_email ?? 0);
  const counts = [r.last7.sent ? `${r.last7.sent} ${t.sent}` : null, r.last7.dry_run ? `${r.last7.dry_run} ${t.dry_run}` : null, skipped ? `${skipped} ${t.skipped}` : null].filter(Boolean);
  return (
    <li data-rule={r.id} className="py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[17px] text-[var(--foreground)]">{name}</p>
        {/* bus 78 #6: the state in one word, not two checkboxes to parse */}
        <span data-rule-state={!state.enabled ? "off" : state.dry_run ? "dry" : "send"}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[14px] font-medium ${!state.enabled ? "border border-[var(--border)] text-[var(--muted)]" : state.dry_run ? "border border-[var(--border)] text-[var(--text-secondary)]" : "bg-[var(--accent)] text-[var(--on-accent)]"}`}>
          {!state.enabled ? t.chipOff : state.dry_run ? t.chipDry : t.chipSend}
        </span>
      </div>
      <p className="mt-1 text-[15px] text-[var(--text-secondary)]">{desc}</p>
      <div className="mt-2 flex flex-wrap gap-x-6">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[16px]"><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={state.enabled} onChange={(e) => save({ ...state, enabled: e.target.checked })} />{t.on}</label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[16px]"><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={state.dry_run} disabled={ask}
          onChange={(e) => (e.target.checked ? save({ ...state, dry_run: true }) : setAsk(true))} />{t.dry}</label>
      </div>
      {ask && (
        <div data-confirm-rule="" role="alertdialog" aria-label={t.confirm} className="mt-2 rounded-md border border-[var(--accent)] p-3">
          <p className="text-[15px] text-[var(--foreground)]">{t.confirm}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={() => save({ ...state, dry_run: false })}>{t.yes}</button>
            <button type="button" className={btn} onClick={() => setAsk(false)}>{t.no}</button>
          </div>
        </div>
      )}
      <p className="mt-1 text-[14px] text-[var(--muted)]">{t.last}: {counts.length ? counts.join(" · ") : t.none}</p>
      {msg && <p role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</p>}
    </li>
  );
}
