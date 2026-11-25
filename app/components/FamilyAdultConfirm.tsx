"use client";

/**
 * QA-156 M2 (R0 25.11): «Вес и питание» opens only for an adult whose birth date says 18+, or — when there is no
 * birth date — after the owner confirms once that the person is an adult. The owner sees this on that person's page
 * only (the service sends `adult_confirmed` to the owner, and only for an adult without a birth date).
 */
import { useState } from "react";
import { checkEnded } from "../lib/family-ended";
import { META } from "../lib/typeScale";
import { tx } from "../lib/typograph.mjs";

const T = {
  RU: { label: "Взрослый, 18 лет или старше", hint: "Даты рождения нет. Пока это не отмечено, раздел «Вес и питание» у этого человека закрыт. Можно вместо этого указать дату рождения.", fail: "Не сохранилось. Попробуй ещё раз." },
  EN: { label: "An adult, 18 or older", hint: "There is no birth date. Until this is ticked, «Weight and food» stays closed for this person. You can add the birth date instead.", fail: "Not saved. Please try again." },
};

export default function FamilyAdultConfirm({ lang, personId, confirmed }: { lang: "EN" | "RU"; personId: string; confirmed: boolean }) {
  const t = tx(T, lang);
  const [on, setOn] = useState(confirmed), [busy, setBusy] = useState(false), [err, setErr] = useState(false);
  async function save(next: boolean) {
    setBusy(true); setErr(false);
    const r = await checkEnded(await fetch(`/api/family-os/people/${personId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ adult_confirmed: next }), credentials: "same-origin", cache: "no-store" }).catch(() => null));
    setBusy(false);
    if (r?.ok) setOn(next); else setErr(true);
  }
  return (
    <div className="mt-4 max-w-2xl">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[17px] text-[var(--foreground)]">
        <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={on} disabled={busy} onChange={(e) => save(e.target.checked)} aria-describedby={`adult-hint-${personId}`} />
        {t.label}
      </label>
      <p id={`adult-hint-${personId}`} className={`${META} mt-1`}>{t.hint}</p>
      {err && <p role="alert" className="mt-2 text-[15px] text-[var(--destructive)]">{t.fail}</p>}
    </div>
  );
}
