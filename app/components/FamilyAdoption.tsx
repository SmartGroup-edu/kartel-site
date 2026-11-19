"use client";

// «Кто уже с нами» (bus 84/97 item 3) — the owner's view on «Доступы». Per person: whether and when they
// signed in (dates only), their morning letter, the passkey state (once passkeys exist), and «Отправить ссылку
// ещё раз». One family line for the week. No per-person or per-child activity numbers (Floor №8).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { H2, META } from "../lib/typeScale";
import type { OsAdoption, OsAdoptionRow } from "../lib/family-os";

type Lang = "EN" | "RU";
const T = {
  EN: {
    head: "Who is with us", lead: "Who has signed in, and how their morning letter is set. Dates only — nothing about what anyone does.",
    week: (a: number, m: number) => `This week ${a} of ${m} tick their routine.`,
    last: "Last sign-in", first: "first", never: "Has not signed in yet", letter: (t: string) => `Morning letter at ${t}`, letterOff: "Letters off",
    pk: { on: "Passkey: yes", off: "Passkey: no" }, resend: "Send the link again", queued: "Goes out within 5 minutes", queuedQuiet: "Goes out after 07:00 (quiet hours)", sentToday: (t: string) => `Invitation sent today at ${t}`, sent: (d: string) => `Invitation sent ${d}`,
    already: "Already sent today.", error: "Could not send — please try again.", child: "child", adult: "adult",
    endAll: "End all sessions", endAllLead: "If a phone or laptop is lost: everyone, you included, signs in again with an email link before opening documents, adding a key or changing access.",
    endAllConfirm: "End every open session in the family?", endAllYes: "End all sessions", endAllNo: "Cancel", endAllDone: "Done. Documents, keys and access now need a fresh sign-in.", endAllErr: "Could not do that — please try again.",
  },
  RU: {
    head: "Кто уже с нами", lead: "Кто уже входил и как у кого настроено утреннее письмо. Только даты — ничего о том, кто что делает.",
    week: (a: number, m: number) => `На этой неделе распорядок отмечают ${a} из ${m}.`,
    last: "Последний вход", first: "впервые", never: "Входа ещё не было", letter: (t: string) => `Утреннее письмо в ${t}`, letterOff: "Письма выключены",
    pk: { on: "Ключ доступа: есть", off: "Ключ доступа: нет" }, resend: "Отправить ссылку ещё раз", queued: "Уйдёт в ближайшие 5 минут", queuedQuiet: "Уйдёт утром после 07:00 (тихие часы)", sentToday: (t: string) => `Приглашение отправлено сегодня в ${t}`, sent: (d: string) => `Приглашение отправлено ${d}`,
    already: "Сегодня уже отправляли.", error: "Не удалось отправить — попробуй ещё раз.", child: "ребёнок", adult: "взрослый",
    endAll: "Завершить все сеансы", endAllLead: "Если потерян телефон или ноутбук: все, включая тебя, войдут заново по ссылке из письма, прежде чем открыть документы, добавить ключ или изменить доступы.",
    endAllConfirm: "Завершить все открытые сеансы в семье?", endAllYes: "Завершить все сеансы", endAllNo: "Отмена", endAllDone: "Готово. Для документов, ключей и доступов теперь нужен новый вход.", endAllErr: "Не получилось — попробуй ещё раз.",
  },
} as const;

const fmt = (d: string, lang: Lang) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

const londonHM = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
/** «Приглашение отправлено сегодня в 14:05» / «Уйдёт утром после 07:00 (тихие часы)» / «Уйдёт в ближайшие 5 минут». */
function inviteText(t: (typeof T)[Lang], inv: NonNullable<OsAdoptionRow["invite"]>, today: string, lang: Lang) {
  if (inv.sent && inv.sent_at) return inv.on_date === today ? t.sentToday(londonHM(inv.sent_at)) : t.sent(fmt(inv.on_date, lang));
  const h = Number(londonHM(new Date().toISOString()).slice(0, 2));
  return h >= 21 || h < 7 ? t.queuedQuiet : t.queued;
}

function Row({ lang, r, today }: { lang: Lang; r: OsAdoptionRow; today: string }) {
  const t = T[lang];
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const name = lang === "EN" ? r.name_en : r.name_ru;
  const invitedToday = r.invite?.on_date === today;
  const resend = async () => {
    const res = await fetch(`/api/family-os/people/${r.id}/invite`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin", cache: "no-store" }).catch(() => null);
    if (res?.status === 202) { setMsg(""); router.refresh(); } // the row's own invite line says «Уйдёт…»
    else setMsg(res?.status === 409 ? t.already : t.error);
  };
  return (
    <li data-adoption-row={r.kind} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-[17px] text-[var(--foreground)]">{name} <span className="text-[15px] text-[var(--text-secondary)]">· {r.kind === "child" ? t.child : t.adult}</span></p>
        <p className="mt-1 text-[15px] text-[var(--text-secondary)]">
          {r.signed_in ? <>{t.last}: {fmt(r.signed_in.last_on, lang)}{r.signed_in.first_on !== r.signed_in.last_on && <> · {t.first} {fmt(r.signed_in.first_on, lang)}</>}</> : t.never}
        </p>
        <p className="mt-0.5 text-[15px] text-[var(--text-secondary)]">
          {r.digest.on ? t.letter(r.digest.time) : t.letterOff}
          {r.passkey !== null && <> · {r.passkey ? t.pk.on : t.pk.off}</>}
        </p>
        {r.invite && <p data-invite-state="" className="mt-0.5 text-[15px] text-[var(--text-secondary)]">{inviteText(t, r.invite, today, lang)}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        {/* bus 101: once a day — after that the row says what happened instead of a greyed-out button */}
        {!invitedToday && <button type="button" data-resend="" onClick={resend} className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]">{t.resend}</button>}
        <span role="status" aria-live="polite" className="text-[14px] text-[var(--text-secondary)]">{msg}</span>
      </div>
    </li>
  );
}

export default function FamilyAdoption({ lang, data }: { lang: Lang; data: OsAdoption }) {
  const t = T[lang];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  return (
    <section id="with-us" aria-labelledby="with-us-h" data-adoption="" className="mt-10 scroll-mt-24">
      <h2 id="with-us-h" className={H2}>{t.head}</h2>
      <p className={`${META} mt-2 max-w-[60ch]`}>{t.lead}</p>
      <p data-family-week="" className="mt-4 text-[17px] text-[var(--foreground)]">{t.week(data.family.active, data.family.of)}</p>
      <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {data.people.map((r) => <Row key={r.id} lang={lang} r={r} today={today} />)}
      </ul>
      <EndAll lang={lang} />
    </section>
  );
}

/** Go-live R1: the owner's «Завершить все сеансы» — a family-wide cut-off on the sensitive routes. */
function EndAll({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState("");
  const btn = "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)]";
  const go = async () => {
    const r = await fetch("/api/family-os/sessions/end-all", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin", cache: "no-store" }).catch(() => null);
    setAsk(false); setMsg(r?.ok ? t.endAllDone : t.endAllErr);
  };
  return (
    <div data-end-all="" className="mt-6">
      <p className="max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.endAllLead}</p>
      {ask ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-[15px] text-[var(--foreground)]">{t.endAllConfirm}</span>
          <button type="button" data-end-all-yes="" onClick={go} className={btn}>{t.endAllYes}</button>
          <button type="button" onClick={() => setAsk(false)} className={btn}>{t.endAllNo}</button>
        </div>
      ) : <p className="mt-3"><button type="button" data-end-all-ask="" onClick={() => { setMsg(""); setAsk(true); }} className={btn}>{t.endAll}</button></p>}
      <p role="status" aria-live="polite" className="mt-2 text-[15px] text-[var(--text-secondary)]">{msg}</p>
    </div>
  );
}
