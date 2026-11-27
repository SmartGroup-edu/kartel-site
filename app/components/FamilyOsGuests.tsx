"use client";

/**
 * «Гости» on «Доступ и безопасность» (bus 176 P4, R0 27.11): the owner invites a read-only guest — an address, who
 * they are, the sections from the allow-list, an end date (required, a year at most) — sees every guest with their
 * sections, end date, last sign-in and reads, opens the log (who, which section, when), and revokes with «Отозвать»,
 * which works on the guest's next request. The service enforces all of it; this file only draws and sends.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Disclosure from "./Disclosure";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, OS_H2 } from "../lib/family-ui";
import { META } from "../lib/typeScale";
import { tx } from "../lib/typograph.mjs";
import { checkEnded } from "../lib/family-ended";
import { GUEST_SECTIONS, GUEST_MAX_DAYS, guestDate, plusDays } from "../lib/family-guest.mjs";
import type { OsGuests, OsGuestRow } from "../lib/family-os";

type Lang = "EN" | "RU";
type Section = (typeof GUEST_SECTIONS)[number];
const T = {
  RU: {
    title: "Гости — только чтение",
    intro: "Гость видит только разделы, которые ты откроешь, и ничего не может изменить: ни задач, ни событий, ни решений. У доступа есть срок — не дольше года. Людей семьи, детей, здоровье и личные документы гость не видит. Каждый вход и просмотр записываются в журнал, он хранится 12 месяцев.",
    unread: "Список гостей сейчас не читается: Family OS не ответил. Попробуй позже.",
    none: "Гостей пока нет.",
    section: { calendar: "Календарь", kodeks: "Документы и правила", companies: "Компании и проекты", review: "Обзор недели" } as Record<Section, string>,
    until: (d: string) => `доступ до ${d}`, ended: (d: string) => `срок закончился ${d}`, revoked: (d: string) => `отозван ${d}`,
    lastIn: (d: string) => `последний вход ${d}`, neverIn: "ещё не входил", reads: (n: number) => `просмотров за 30 дней: ${n}`,
    log: "Журнал", logLoading: "Загружаю журнал…", logError: "Журнал не загрузился.", logEmpty: "Записей пока нет.",
    act: { signin: "вход", read: "просмотр" } as Record<string, string>, page: "страница",
    revoke: "Отозвать", confirm: "Отозвать доступ сейчас?", keep: "Оставить",
    add: "Пригласить гостя", label: "Кто это", labelHint: "Например: Бухгалтер", email: "Почта гостя", sections: "Разделы (только чтение)", end: "Доступ до", endHint: (max: string) => `Обязательно. Не позже ${max}.`,
    finance: "«Финансы» появятся в списке, когда раздел будет готов.",
    send: "Пригласить", saved: "Гость добавлен. Письмо-приглашение не отправляется: скажи гостю открыть kartel.org.uk → «Войти» и ввести эту почту — придёт код.",
    revokedNow: "Доступ отозван.", error: "Не удалось сохранить",
    errors: { exists: "У этой почты уже есть открытый гостевой доступ.", is_member: "Эта почта уже в семье: гость не может быть членом семьи.", bad_email: "Проверь почту.", bad_label: "Напиши, кто это (до 60 знаков).", bad_sections: "Выбери хотя бы один раздел.", bad_until: "Дата — от сегодня и не дальше года." } as Record<string, string>,
  },
  EN: {
    title: "Guests — read only",
    intro: "A guest sees only the sections you open and cannot change anything: no tasks, events or decisions. Access has an end date — a year at most. A guest never sees the family's people, children, health or personal documents. Every sign-in and view is logged; the log is kept 12 months.",
    unread: "The guest list cannot be read right now: Family OS did not answer. Try again later.",
    none: "No guests yet.",
    section: { calendar: "Calendar", kodeks: "Documents and rules", companies: "Companies and projects", review: "Weekly review" } as Record<Section, string>,
    until: (d: string) => `access until ${d}`, ended: (d: string) => `ended ${d}`, revoked: (d: string) => `revoked ${d}`,
    lastIn: (d: string) => `last sign-in ${d}`, neverIn: "not signed in yet", reads: (n: number) => `views in 30 days: ${n}`,
    log: "Log", logLoading: "Loading the log…", logError: "The log did not load.", logEmpty: "Nothing logged yet.",
    act: { signin: "sign-in", read: "view" } as Record<string, string>, page: "page",
    revoke: "Revoke", confirm: "Revoke access now?", keep: "Keep",
    add: "Invite a guest", label: "Who is it", labelHint: "For example: Accountant", email: "Guest's email", sections: "Sections (read only)", end: "Access until", endHint: (max: string) => `Required. No later than ${max}.`,
    finance: "«Finance» joins the list when that section is ready.",
    send: "Invite", saved: "Guest added. No invitation letter is sent: tell the guest to open kartel.org.uk → «Sign in» and enter this email — a code will arrive.",
    revokedNow: "Access revoked.", error: "Could not save",
    errors: { exists: "This email already has open guest access.", is_member: "This email is already in the family: a guest cannot be a family member.", bad_email: "Check the email.", bad_label: "Say who this is (up to 60 characters).", bad_sections: "Choose at least one section.", bad_until: "From today, a year ahead at most." } as Record<string, string>,
  },
} as const;
type Dict = (typeof T)[Lang];

const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const send = (method: "GET" | "POST", path: string, body?: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin", cache: "no-store" }).catch(() => null).then(checkEnded);
const day = (iso: string | null, lang: Lang) => (iso ? guestDate(iso.slice(0, 10), lang) : "");
const stamp = (iso: string, lang: Lang) => new Date(iso).toLocaleString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export default function FamilyOsGuests({ lang, data }: { lang: Lang; data: OsGuests | null }) {
  const t = tx(T, lang);
  return (
    <section id="guests" aria-labelledby="guests-h" data-guests="" className="mt-12 scroll-mt-24">
      <h2 id="guests-h" className={OS_H2}>{t.title}</h2>
      <p className="mt-2 max-w-[64ch] text-[15px] text-[var(--text-body)]">{t.intro}</p>
      {!data ? <p role="status" className={`${META} mt-4`}>{t.unread}</p> : (
        <>
          {data.guests.length === 0 ? <p className={`${META} mt-4`}>{t.none}</p> : (
            <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {data.guests.map((g) => <GuestRow key={g.id} t={t} lang={lang} g={g} />)}
            </ul>
          )}
          <Invite t={t} lang={lang} today={data.today} />
        </>
      )}
    </section>
  );
}

function GuestRow({ t, lang, g }: { t: Dict; lang: Lang; g: OsGuestRow }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState("");
  // Active → its end date. Revoked before the end date → «отозван». Otherwise the end date passed (an expired grant
  // closed by a new invitation counts as ended, not revoked).
  const status = g.active ? t.until(guestDate(g.until, lang))
    : g.revoked_at && g.revoked_at.slice(0, 10) <= g.until ? t.revoked(day(g.revoked_at, lang)) : t.ended(guestDate(g.until, lang));
  const revoke = async () => {
    const r = await send("POST", `guests/${g.id}/revoke`, {});
    if (r?.ok) { setMsg(t.revokedNow); setAsk(false); router.refresh(); return; }
    const code = ((await r?.json().catch(() => null)) as { error?: string } | null)?.error ?? "";
    setMsg(t.errors[code] ?? `${t.error}${r ? ` (${r.status})` : ""}`);
  };
  return (
    <li data-guest={g.id} data-guest-active={g.active ? "" : undefined} className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-[var(--foreground)]">{g.label} <span className="font-normal text-[14px] text-[var(--text-secondary)] [overflow-wrap:anywhere]">· {g.email}</span></p>
          <p className="mt-0.5 text-[14px] text-[var(--text-body)]">{g.sections.map((s) => t.section[s as Section] ?? s).join(" · ")}</p>
          <p className={`${META} mt-0.5`}>{status} · {g.last_signin ? t.lastIn(day(g.last_signin, lang)) : t.neverIn} · {t.reads(g.reads_30d)}</p>
        </div>
        {g.active && (ask ? (
          <span className="flex flex-wrap gap-2">
            <button type="button" autoFocus className={BTN_SECONDARY} onClick={() => setAsk(false)}>{t.keep}</button>
            <button type="button" data-guest-revoke-yes="" className={BTN_DANGER} onClick={revoke}>{t.confirm}</button>
          </span>
        ) : <button type="button" data-guest-revoke="" className={BTN_DANGER} onClick={() => setAsk(true)} aria-label={`${t.revoke}: ${g.label}`}>{t.revoke}</button>)}
      </div>
      {msg && <p role="status" aria-live="polite" className={`${META} mt-2`}>{msg}</p>}
      <GuestLog t={t} lang={lang} id={g.id} />
    </li>
  );
}

function GuestLog({ t, lang, id }: { t: Dict; lang: Lang; id: string }) {
  const [rows, setRows] = useState<{ at: string; action: string; section: string | null; route: string }[] | null | "error">(null);
  const load = async () => {
    if (rows && rows !== "error") return;
    const r = await send("GET", `guests/${id}/log`);
    const j = r?.ok ? ((await r.json().catch(() => null)) as { log?: typeof rows } | null) : null;
    setRows(Array.isArray(j?.log) ? j.log : "error");
  };
  return (
    <Disclosure summary={t.log} className="mt-2" variant="inline" summaryClassName="w-fit text-[14px] text-[var(--accent)]" onToggle={(open: boolean) => { if (open) void load(); }}>
      {rows === null ? <p role="status" className={`${META} mt-2`}>{t.logLoading}</p>
        : rows === "error" ? <p role="status" className={`${META} mt-2`}>{t.logError}</p>
        : rows.length === 0 ? <p className={`${META} mt-2`}>{t.logEmpty}</p> : (
          <ul data-guest-log="" className="mt-2 grid gap-1 text-[14px] text-[var(--text-body)]">
            {rows.map((x, i) => (
              <li key={i}>{stamp(x.at, lang)} · {t.act[x.action] ?? x.action}{x.section ? ` · ${t.section[x.section as Section] ?? x.section}` : ""}{x.route === "page" ? ` (${t.page})` : ""}</li>
            ))}
          </ul>
        )}
    </Disclosure>
  );
}

function Invite({ t, lang, today }: { t: Dict; lang: Lang; today: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const max = plusDays(today, GUEST_MAX_DAYS);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const sections = GUEST_SECTIONS.filter((s) => f.get(`s-${s}`) === "on");
    if (!sections.length) return setMsg(t.errors.bad_sections);
    setBusy(true); setMsg("");
    const r = await send("POST", "guests", { label: String(f.get("label") ?? ""), email: String(f.get("email") ?? ""), sections, until: String(f.get("until") ?? "") });
    setBusy(false);
    if (r?.ok) { setMsg(t.saved); form.reset(); router.refresh(); return; }
    const code = ((await r?.json().catch(() => null)) as { error?: string } | null)?.error ?? "";
    setMsg(t.errors[code] ?? `${t.error}${r ? ` (${r.status})` : ""}`);
  };
  return (
    <Disclosure summary={t.add} className="mt-5" variant="inline" summaryClassName="w-fit font-medium text-[16px] text-[var(--accent)]">
      <form onSubmit={submit} data-guest-invite="" className="mt-3 grid max-w-xl gap-4">
        <label className={label}>{t.label}<input name="label" required maxLength={60} placeholder={t.labelHint} autoComplete="off" className={field} /></label>
        <label className={label}>{t.email}<input name="email" type="email" required autoComplete="off" className={field} /></label>
        <fieldset>
          <legend className={label}>{t.sections}</legend>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {GUEST_SECTIONS.map((s) => (
              <label key={s} className="flex min-h-11 items-center gap-2.5 text-[16px] text-[var(--foreground)]">
                <input type="checkbox" name={`s-${s}`} className="h-5 w-5 accent-[var(--accent)]" />{t.section[s as Section]}
              </label>
            ))}
          </div>
          <p className={`${META} mt-1`}>{t.finance}</p>
        </fieldset>
        <label className={label}>{t.end}
          <input name="until" type="date" required min={today} max={max} aria-describedby="guest-until-hint" className={field} />
          <span id="guest-until-hint" className={`${META} mt-1 block font-normal`}>{t.endHint(guestDate(max, lang))}</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>{t.send}</button>
          <span role="status" aria-live="polite" className="text-[14px] text-[var(--text-secondary)]">{msg}</span>
        </div>
      </form>
    </Disclosure>
  );
}
