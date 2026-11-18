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
    pk: { on: "Passkey: yes", off: "Passkey: no" }, resend: "Send the link again", queued: "Will go out shortly (not at night)", sent: (d: string) => `Invitation sent ${d}`,
    already: "Already sent today.", error: "Could not send — please try again.", child: "child", adult: "adult",
  },
  RU: {
    head: "Кто уже с нами", lead: "Кто уже входил и как у кого настроено утреннее письмо. Только даты — ничего о том, кто что делает.",
    week: (a: number, m: number) => `На этой неделе распорядок отмечают ${a} из ${m}.`,
    last: "Последний вход", first: "впервые", never: "Входа ещё не было", letter: (t: string) => `Утреннее письмо в ${t}`, letterOff: "Письма выключены",
    pk: { on: "Ключ доступа: есть", off: "Ключ доступа: нет" }, resend: "Отправить ссылку ещё раз", queued: "Уйдёт в ближайшие минуты (ночью — утром)", sent: (d: string) => `Приглашение отправлено ${d}`,
    already: "Сегодня уже отправляли.", error: "Не удалось отправить — попробуй ещё раз.", child: "ребёнок", adult: "взрослый",
  },
} as const;

const fmt = (d: string, lang: Lang) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

function Row({ lang, r, today }: { lang: Lang; r: OsAdoptionRow; today: string }) {
  const t = T[lang];
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const name = lang === "EN" ? r.name_en : r.name_ru;
  const invitedToday = r.invite?.on_date === today;
  const resend = async () => {
    const res = await fetch(`/api/family-os/people/${r.id}/invite`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin", cache: "no-store" }).catch(() => null);
    if (res?.status === 202) { setMsg(t.queued); router.refresh(); }
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
        {r.invite && <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">{r.invite.sent ? t.sent(fmt(r.invite.on_date, lang)) : t.queued}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <button type="button" data-resend="" onClick={resend} disabled={invitedToday} className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-60">{t.resend}</button>
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
    </section>
  );
}
