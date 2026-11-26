"use client";

/**
 * «+ Пригласить» and «Ждут ответа» on «Люди» (bus 172 P4, mockup v5). The owner only — the page passes nothing to
 * anyone else, and the service refuses every call here from anyone else.
 *
 * The wizard: 1 who (names, email, role, whose areas) → 2 what they will see (the menu rules + the areas, and whether
 * the address is on the site's access list) → 3 the letter exactly as the relay sends it → «Отправить». Sending is
 * the invitation Family OS already has: POST /people, POST /grants, POST /people/:id/invite (one a day per person,
 * 10 a day per owner, audited). Rules live in app/lib/family-invite.mjs.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkEnded } from "../lib/family-ended";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, OS_H2 } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";
import { avatars as avatarsOf } from "../lib/family-avatars.mjs";
import { SCOPES, SENSITIVE, accessPreview, checkStep1, firstWord, inviteLetter, invitePlan } from "../lib/family-invite.mjs";
import { ADOPTION_T, inviteText } from "./FamilyAdoption";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import type { OsAdoptionRow, OsPerson, OsScope } from "../lib/family-os";

type Lang = "EN" | "RU";
type Role = "parent" | "relative" | "adult" | "child";
type ListState = "listed" | "not_listed" | "revoked" | "unknown";
export type PendingInvite = { id: string; name_ru: string; name_en: string; kind: "adult" | "child"; invite: OsAdoptionRow["invite"]; canCancel: boolean; access: ListState };
type Draft = { name_ru: string; name_en: string; email: string; role: Role; children: string[]; parents: string[]; scopes: OsScope[] };

const T = {
  RU: {
    open: "+ Пригласить", title: "Пригласить в семью", close: "Закрыть", step: (n: number) => `Шаг ${n} из 3`, s1: "кто это", s2: "доступ", s3: "письмо",
    nameRu: "Имя (кириллицей)", nameEn: "Имя (латиницей)", nameHint: "В письме будет первое слово имени.", email: "Почта", role: "Роль",
    roles: {
      parent: ["Родитель", "Сегодня, задачи, календарь, решения, люди, свои документы; решает очередь детей и утверждает план"],
      relative: ["Родственник", "Как взрослый, и выбранные области детей"],
      adult: ["Взрослый член семьи", "Сегодня, задачи, календарь, решения, люди, свои документы"],
      child: ["Ребёнок", "Только «Мой день» и календарь"],
    } as Record<Role, [string, string]>,
    noGuest: "Роли «гость» нет: каждый здесь — взрослый или ребёнок семьи.",
    whose: "Чей родитель или родственник", parentsOf: "Родители ребёнка", noKids: "Детей в семье пока нет.", noAdults: "Взрослых в семье пока нет — родителей можно добавить позже.",
    areas: "Области ребёнка", always: "всегда",
    scope: { routines: "Распорядок", education: "Учёба", health: "Здоровье", documents: "Документы" } as Record<OsScope, string>,
    errors: { name_ru: "Напиши имя кириллицей: только буквы, дефис или апостроф.", name_en: "Напиши имя латиницей: только буквы, дефис или апостроф.", email: "Проверь адрес почты.", email_taken: "Этот адрес уже есть в семье.", role: "Выбери роль.", children: "Выбери хотя бы одного ребёнка.", scopes: "Выбери хотя бы одну область." } as Record<string, string>,
    sees: (n: string) => `Что увидит ${n}`, sections: { today: "Сегодня", myday: "Мой день", board: "Задачи", calendar: "Календарь", council: "Решения", people: "Люди", docs: "Свои документы", access: "Доступ и безопасность" } as Record<string, string>,
    yes: "есть", no: "нет", areaLine: (c: string) => `${c}:`, sensitive: (xs: string) => `Чувствительное: ${xs}. «Отправить» на следующем шаге — это подтверждение.`,
    change: "Изменить доступ можно в любой момент в разделе «Доступ и безопасность».",
    list: { checking: "Проверяю список доступа сайта…", listed: "Адрес есть в списке доступа: по письму можно будет войти.", not_listed: "Адреса нет в списке доступа сайта. Письмо не отправится: войти по нему пока нельзя. Человек будет добавлен, а письмо можно отправить с его карточки, когда адрес появится в списке (Edge Config «familyAccessEmails» или FAMILY_APPROVED_EMAILS).", revoked: "Доступ для этого адреса отозван в списке доступа сайта. Письмо не отправится.", unknown: "Список доступа сайта сейчас не читается. Письмо отправится, но войти получится, только если адрес в списке." } as Record<ListState | "checking", string>,
    check: (n: string) => `Так увидит письмо ${n}`, from: "От: KARTEL", to: (e: string) => `Кому: ${e}`, subj: (s: string) => `Тема: ${s}`,
    letterNote: "Письмо уходит на русском, в ближайшие 5 минут, а в тихие часы (21:00–07:00) — утром. Ссылка в письме ведёт на обычный вход: письмо со ссылкой и 6-значным кодом, потом ключ доступа.",
    back: "Назад", cancel: "Отмена", next: "Далее", send: "Отправить приглашение", addOnly: "Добавить без письма", sending: "Отправляю…",
    done: (n: string) => `${n}: приглашение отправлено.`, doneQuiet: (n: string) => `${n} добавлен(а). Письмо не отправлено: адреса нет в списке доступа.`,
    partial: (n: string) => `${n} добавлен(а), но не всё получилось — проверь доступы в «Доступ и безопасность».`, capped: "Сегодня приглашений уже 10 — письмо можно отправить завтра с карточки.",
    failed: "Не получилось добавить. Попробуй ещё раз.", exists: "Этот адрес уже есть в семье.",
    pendingHead: "Ждут ответа", pendingLead: "Кто ещё не входил. Отмена приглашения не убирает человека и его доступы.",
    notInvited: "Приглашение ещё не отправлено", resend: "Отправить ещё раз", sendFirst: "Отправить приглашение", cancelInv: "Отменить приглашение",
    confirm: "Отменить приглашение? Неотправленное письмо не уйдёт.", keep: "Оставить", doCancel: "Отменить", cancelled: "Приглашение отменено.",
    noList: "Адреса нет в списке доступа — войти пока не получится.", already: "Сегодня уже отправляли.", error: "Не получилось — попробуй ещё раз.",
    child: "ребёнок", adult: "взрослый",
  },
  EN: {
    open: "+ Invite", title: "Invite to the family", close: "Close", step: (n: number) => `Step ${n} of 3`, s1: "who", s2: "access", s3: "letter",
    nameRu: "Name (Russian)", nameEn: "Name (English)", nameHint: "The letter uses the first word of the name.", email: "Email", role: "Role",
    roles: {
      parent: ["Parent", "Today, tasks, calendar, decisions, people, own documents; decides the children's queue and approves the plan"],
      relative: ["Relative", "Like an adult, plus the chosen areas of the children"],
      adult: ["Adult family member", "Today, tasks, calendar, decisions, people, own documents"],
      child: ["Child", "Only My day and the calendar"],
    } as Record<Role, [string, string]>,
    noGuest: "There is no guest role: everyone here is an adult or a child of the family.",
    whose: "Parent or relative of", parentsOf: "The child's parents", noKids: "There are no children in the family yet.", noAdults: "There are no adults yet — parents can be added later.",
    areas: "The child's areas", always: "always",
    scope: { routines: "Routines", education: "School", health: "Health", documents: "Documents" } as Record<OsScope, string>,
    errors: { name_ru: "Write the Russian name: letters, a hyphen or an apostrophe only.", name_en: "Write the English name: letters, a hyphen or an apostrophe only.", email: "Check the email address.", email_taken: "This address is already in the family.", role: "Choose a role.", children: "Choose at least one child.", scopes: "Choose at least one area." } as Record<string, string>,
    sees: (n: string) => `What ${n} will see`, sections: { today: "Today", myday: "My day", board: "Tasks", calendar: "Calendar", council: "Decisions", people: "People", docs: "Own documents", access: "Access and security" } as Record<string, string>,
    yes: "yes", no: "no", areaLine: (c: string) => `${c}:`, sensitive: (xs: string) => `Sensitive: ${xs}. «Send» on the next step is the confirmation.`,
    change: "Access can be changed at any time in Access and security.",
    list: { checking: "Checking the site's access list…", listed: "The address is on the access list: the letter will let them in.", not_listed: "The address is not on the site's access list. No letter will go: it could not sign them in yet. The person is added, and the letter can be sent from their card once the address is on the list (Edge Config “familyAccessEmails” or FAMILY_APPROVED_EMAILS).", revoked: "Access for this address is revoked on the site's access list. No letter will go.", unknown: "The site's access list cannot be read right now. The letter will go, but it signs them in only if the address is on the list." } as Record<ListState | "checking", string>,
    check: (n: string) => `The letter as ${n} will see it`, from: "From: KARTEL", to: (e: string) => `To: ${e}`, subj: (s: string) => `Subject: ${s}`,
    letterNote: "The letter goes in Russian, within 5 minutes, or in the morning during quiet hours (21:00–07:00). Its link leads to the normal sign-in: an email link with a 6-digit code, then a passkey.",
    back: "Back", cancel: "Cancel", next: "Next", send: "Send the invitation", addOnly: "Add without a letter", sending: "Sending…",
    done: (n: string) => `${n}: invitation sent.`, doneQuiet: (n: string) => `${n} added. No letter: the address is not on the access list.`,
    partial: (n: string) => `${n} added, but not everything worked — check Access and security.`, capped: "10 invitations today already — send the letter tomorrow from the card.",
    failed: "Could not add. Please try again.", exists: "This address is already in the family.",
    pendingHead: "Waiting to join", pendingLead: "Who has not signed in yet. Cancelling an invitation does not remove the person or their access.",
    notInvited: "No invitation sent yet", resend: "Send again", sendFirst: "Send the invitation", cancelInv: "Cancel the invitation",
    confirm: "Cancel the invitation? An unsent letter will not go.", keep: "Keep", doCancel: "Cancel it", cancelled: "Invitation cancelled.",
    noList: "The address is not on the access list — they cannot sign in yet.", already: "Already sent today.", error: "Could not do that — please try again.",
    child: "child", adult: "adult",
  },
} as const;
type Dict = (typeof T)[Lang];

const field = "mt-1 block min-h-[46px] w-full rounded-[var(--fos-control,10px)] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)] aria-[invalid=true]:border-[var(--destructive)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const ERR = "mt-1 text-[14px] text-[var(--destructive)]";
const CARD = "rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] p-5 shadow-[var(--fos-shadow)]";
const post = (method: "POST" | "DELETE", path: string, body?: unknown) =>
  fetch(`/api/${path}`, { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null).then(checkEnded);
const empty = (): Draft => ({ name_ru: "", name_en: "", email: "", role: "adult", children: [], parents: [], scopes: ["routines"] });
const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

function Steps({ n }: { n: number }) {
  return <div aria-hidden="true" data-invite-steps="" className="flex gap-1.5 pr-8">{[1, 2, 3].map((i) => <i key={i} className={`h-1 flex-1 rounded ${i <= n ? "bg-[var(--fos-accent-2)]" : "bg-[var(--border)]"}`} />)}</div>;
}

/** The header button and the 3-step dialog. */
export function InviteWizard({ lang, people, onDone }: { lang: Lang; people: OsPerson[]; onDone: (msg: string) => void }) {
  const t = tx(T, lang);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>(empty);
  const [errs, setErrs] = useState<string[]>([]);
  const [list, setList] = useState<ListState | "checking">("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const head = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const kids = people.filter((p) => p.kind === "child"), adults = people.filter((p) => p.kind === "adult");
  const nameOf = (p: OsPerson) => (lang === "EN" ? p.name_en : p.name_ru);
  const shown = (lang === "EN" ? d.name_en : d.name_ru).trim() || (lang === "EN" ? "them" : "участник");
  useEffect(() => { if (open && step > 1) head.current?.focus(); }, [open, step]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggle = (k: "children" | "parents" | "scopes", v: string) => setD((x) => ({ ...x, [k]: (x[k] as string[]).includes(v) ? (x[k] as string[]).filter((y) => y !== v) : [...(x[k] as string[]), v] }));
  const reset = () => { setStep(1); setD(empty()); setErrs([]); setMsg(""); setList("checking"); };

  const next = async () => {
    if (step === 1) {
      const e = checkStep1(d, { people }) as string[];
      setErrs(e);
      // The first problem's field; a group with nothing to tick (no children yet) falls back to the role cards.
      if (e.length) { (document.getElementById(`inv-${e[0] === "email_taken" ? "email" : e[0]}`) ?? document.getElementById("inv-role"))?.focus(); return; }
      setList("checking"); setStep(2);
      const r = await post("POST", "family-invite", { email: d.email });
      const j = r?.ok ? ((await r.json().catch(() => null)) as { state?: ListState } | null) : null;
      setList(j?.state ?? "unknown");
      return;
    }
    setStep(3);
  };

  const send = async () => {
    setBusy(true); setMsg(t.sending);
    const plan = invitePlan(d) as { person: Record<string, string>; grants: { guardian_id: string | null; child_id: string | null; relation: string; scopes: OsScope[] }[] };
    const name = (lang === "EN" ? d.name_en : d.name_ru).trim();
    try {
      const r = await post("POST", "family-os/people", plan.person);
      if (!r || r.status !== 201) { const code = ((await r?.json().catch(() => null)) as { error?: string } | null)?.error; setMsg(code === "exists" ? t.exists : t.failed); return; }
      const { id } = (await r.json()) as { id: string };
      let ok = true;
      for (const g of plan.grants) {
        const gr = await post("POST", "family-os/grants", { ...g, guardian_id: g.guardian_id ?? id, child_id: g.child_id ?? id });
        if (gr?.status !== 201) ok = false;
      }
      let line = ok ? t.done(name) : t.partial(name);
      if (list === "not_listed" || list === "revoked") line = ok ? t.doneQuiet(name) : t.partial(name);
      else {
        const ir = await post("POST", `family-os/people/${id}/invite`, {});
        if (ir?.status === 429) line = t.capped;
        else if (ir?.status !== 202) line = t.partial(name);
      }
      setOpen(false); reset(); onDone(line); router.refresh();
    } finally { setBusy(false); }
  };

  const err = (k: string) => (errs.includes(k) ? t.errors[k] : "");
  const prev = accessPreview(d, { people, lang }) as { sections: { key: string; on: boolean }[]; areas: { child: string; scopes: OsScope[]; sensitive: OsScope[] }[] };
  const letter = inviteLetter("RU", firstWord(d.name_ru) || "…", londonToday());
  const quiet = list === "not_listed" || list === "revoked";
  const needKids = d.role === "parent" || d.role === "relative";

  return (
    <>
      <button ref={opener} type="button" data-invite-open="" onClick={() => { reset(); setOpen(true); }} className={BTN_PRIMARY}>{t.open}</button>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) setOpen(false); }}>
        <DialogContent closeLabel={t.close} data-invite-wizard="" data-step={step}
          onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.focus(); }}
          className="max-h-[92dvh] w-[calc(100%-24px)] max-w-[640px] content-start gap-4 overflow-y-auto rounded-[20px] border border-[var(--border)] bg-[var(--fos-panel)] p-6 shadow-[var(--fos-shadow-lg)]">
          <Steps n={step} />
          <div>
            <DialogTitle ref={head} tabIndex={-1} className="font-serif text-[22px] font-semibold leading-tight text-[var(--foreground)] outline-none">
              {step === 1 ? t.title : step === 2 ? t.sees(shown) : t.check(shown)}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[14px] text-[var(--muted)]">{t.step(step)} · {step === 1 ? t.s1 : step === 2 ? t.s2 : t.s3}</DialogDescription>
          </div>

          {step === 1 && (
            <form noValidate onSubmit={(e) => { e.preventDefault(); void next(); }} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>{t.nameRu}
                  <input id="inv-name_ru" value={d.name_ru} onChange={(e) => set("name_ru", e.target.value)} lang="ru" maxLength={200} autoComplete="off" aria-invalid={Boolean(err("name_ru"))} aria-describedby="inv-name-hint inv-name_ru-err" className={field} autoFocus />
                  {err("name_ru") && <span id="inv-name_ru-err" className={ERR}>{err("name_ru")}</span>}
                </label>
                <label className={label}>{t.nameEn}
                  <input id="inv-name_en" value={d.name_en} onChange={(e) => set("name_en", e.target.value)} lang="en" maxLength={200} autoComplete="off" aria-invalid={Boolean(err("name_en"))} aria-describedby="inv-name-hint inv-name_en-err" className={field} />
                  {err("name_en") && <span id="inv-name_en-err" className={ERR}>{err("name_en")}</span>}
                </label>
              </div>
              <p id="inv-name-hint" className="-mt-2 text-[13px] text-[var(--muted)]">{t.nameHint}</p>
              <label className={label}>{t.email}
                <input id="inv-email" type="email" value={d.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" inputMode="email" aria-invalid={Boolean(err("email") || err("email_taken"))} aria-describedby="inv-email-err" className={field} />
                {(err("email") || err("email_taken")) && <span id="inv-email-err" className={ERR}>{err("email") || err("email_taken")}</span>}
              </label>
              <fieldset>
                <legend id="inv-role-l" className={label}>{t.role}</legend>
                <div id="inv-role" tabIndex={-1} role="radiogroup" aria-labelledby="inv-role-l" className="mt-2 grid gap-2">
                  {(["parent", "relative", "adult", "child"] as Role[]).map((r) => (
                    <label key={r} data-role-card={r} className={`flex cursor-pointer items-start gap-3 rounded-[14px] border-2 px-3.5 py-3 ${d.role === r ? "border-[var(--fos-accent-2)] bg-[var(--fos-panel-2)]" : "border-[var(--border)]"}`}>
                      <input type="radio" name="inv-role" value={r} checked={d.role === r} onChange={() => setD((x) => ({ ...x, role: r, scopes: ["routines"] }))} className="mt-1 h-4 w-4 accent-[var(--fos-accent-2)]" />
                      <span><b className="block text-[15px] text-[var(--foreground)]">{t.roles[r][0]}</b><small className="text-[13px] text-[var(--muted)]">{t.roles[r][1]}</small></span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[13px] text-[var(--muted)]">{t.noGuest}</p>
              </fieldset>
              {(needKids || d.role === "child") && (
                <fieldset>
                  <legend id="inv-children-l" className={label}>{needKids ? t.whose : t.parentsOf}</legend>
                  {(needKids ? kids : adults).length === 0 ? <p className="mt-1 text-[14px] text-[var(--muted)]">{needKids ? t.noKids : t.noAdults}</p> : (
                    <div id="inv-children" tabIndex={-1} role="group" aria-labelledby="inv-children-l" aria-describedby="inv-children-err" className="mt-2 flex flex-wrap gap-2">
                      {(needKids ? kids : adults).map((p) => {
                        const k = needKids ? "children" : "parents", on = (d[k] as string[]).includes(p.id);
                        return (
                          <label key={p.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[15px] ${on ? "border-[var(--fos-accent-2)] text-[var(--foreground)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>
                            <input type="checkbox" className="h-4 w-4 accent-[var(--fos-accent-2)]" checked={on} onChange={() => toggle(k, p.id)} />{nameOf(p)}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {err("children") && <p id="inv-children-err" className={ERR}>{err("children")}</p>}
                </fieldset>
              )}
              {(needKids || (d.role === "child" && d.parents.length > 0)) && (
                <fieldset>
                  <legend id="inv-scopes-l" className={label}>{t.areas}</legend>
                  <div id="inv-scopes" tabIndex={-1} role="group" aria-labelledby="inv-scopes-l" aria-describedby="inv-scopes-err" className="mt-2 flex flex-wrap gap-2">
                    {(SCOPES as OsScope[]).map((s) => {
                      const fixed = s === "routines" && d.role !== "relative", on = fixed || d.scopes.includes(s);
                      return (
                        <label key={s} className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-[15px] ${fixed ? "" : "cursor-pointer"} ${on ? "border-[var(--fos-accent-2)] text-[var(--foreground)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>
                          <input type="checkbox" className="h-4 w-4 accent-[var(--fos-accent-2)]" checked={on} disabled={fixed} onChange={() => toggle("scopes", s)} />
                          {t.scope[s]}{fixed && <span className="text-[13px] text-[var(--muted)]">· {t.always}</span>}
                        </label>
                      );
                    })}
                  </div>
                  {err("scopes") && <p id="inv-scopes-err" className={ERR}>{err("scopes")}</p>}
                </fieldset>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={BTN_SECONDARY}>{t.cancel}</button>
                <button type="submit" data-invite-next="" className={BTN_PRIMARY}>{t.next}</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <ul data-invite-preview="" className="grid grid-cols-1 gap-x-5 gap-y-1.5 text-[15px] sm:grid-cols-2">
                {prev.sections.map((s) => (
                  <li key={s.key} data-on={s.on ? "1" : "0"} className={`flex items-center gap-2 ${s.on ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>
                    <b aria-hidden="true" className={s.on ? "text-[var(--fos-accent-2)]" : ""}>{s.on ? "✓" : "—"}</b>{t.sections[s.key]}<span className="sr-only">: {s.on ? t.yes : t.no}</span>
                  </li>
                ))}
              </ul>
              {prev.areas.length > 0 && (
                <ul className="grid gap-1 text-[15px] text-[var(--foreground)]">
                  {prev.areas.map((a) => <li key={a.child}><b className="font-semibold">{t.areaLine(a.child)}</b> {a.scopes.map((s) => t.scope[s]).join(", ")}</li>)}
                </ul>
              )}
              {prev.areas.some((a) => a.sensitive.length) && (
                <p data-invite-sensitive="" className="rounded-md border border-[var(--fos-amber)] px-3 py-2 text-[14px] text-[var(--foreground)]">
                  {t.sensitive(SENSITIVE.filter((s) => prev.areas.some((a) => a.sensitive.includes(s as OsScope))).map((s) => t.scope[s as OsScope]).join(", "))}
                </p>
              )}
              <p data-access-list={list} role="status" className={`rounded-md border px-3 py-2 text-[14px] ${list === "listed" ? "border-[var(--border)] text-[var(--text-secondary)]" : "border-[var(--fos-amber)] text-[var(--foreground)]"}`}>{t.list[list]}</p>
              <p className="text-[13px] text-[var(--muted)]">{t.change}</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setStep(1)} className={BTN_SECONDARY}>{t.back}</button>
                <button type="button" data-invite-next="" disabled={list === "checking"} onClick={() => void next()} className={BTN_PRIMARY}>{t.next}</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <div data-invite-letter="" lang="ru" className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--fos-panel-2)]">
                <p className="border-b border-[var(--border)] px-3.5 py-2.5 text-[12px] text-[var(--muted)]">{t.from} · {t.to(d.email.trim().toLowerCase())} · {t.subj(letter.subject)}</p>
                <div className="bg-[var(--fos-panel)] px-5 py-6">
                  <p className="text-[13px] uppercase tracking-[.12em] text-[var(--accent)]">KARTEL</p>
                  <p className="mt-3 font-serif text-[20px] font-semibold leading-snug text-[var(--foreground)]">{letter.hello}</p>
                  <p className="mt-0.5 text-[14px] text-[var(--muted)]" suppressHydrationWarning>{letter.dateLine}</p>
                  <p className="mt-3 text-[15px] text-[var(--foreground)]">{letter.lead}</p>
                  <p className="mt-4"><span aria-hidden="true" className="inline-block rounded-md bg-[var(--accent)] px-5 py-2.5 text-[15px] font-semibold text-[var(--on-accent)]">{letter.button}</span></p>
                  <p className="mt-5 border-t border-[var(--border)] pt-3 text-[13px] text-[var(--muted)]">{letter.off} <u>{letter.offLink}</u></p>
                </div>
              </div>
              <p className="text-[13px] text-[var(--muted)]">{t.letterNote}</p>
              {quiet && <p role="status" className="rounded-md border border-[var(--fos-amber)] px-3 py-2 text-[14px] text-[var(--foreground)]">{t.list[list]}</p>}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span role="status" aria-live="polite" className="mr-auto text-[14px] text-[var(--text-secondary)]">{msg}</span>
                <button type="button" disabled={busy} onClick={() => setStep(2)} className={BTN_SECONDARY}>{t.back}</button>
                <button type="button" data-invite-send="" disabled={busy} onClick={() => void send()} className={BTN_PRIMARY}>{quiet ? t.addOnly : t.send}</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** «Ждут ответа»: one dashed card per person who has not signed in yet. */
export function PendingInvites({ lang, items, roleOf }: { lang: Lang; items: PendingInvite[]; roleOf: (id: string) => string }) {
  const t = tx(T, lang);
  if (!items.length) return null;
  const av = avatarsOf(items.map((x) => ({ id: x.id, name: lang === "EN" ? x.name_en : x.name_ru }))) as Map<string, { text: string; bg: string }>;
  return (
    <section aria-labelledby="pending-h" data-pending-invites="" className="mt-10">
      <h2 id="pending-h" className={OS_H2}>{t.pendingHead}</h2>
      <p className="mt-1 max-w-[60ch] text-[14px] text-[var(--muted)]">{t.pendingLead}</p>
      <ul className="mt-4 grid grid-cols-1 gap-[18px] min-[640px]:grid-cols-2 min-[1100px]:grid-cols-3">
        {items.map((x) => <PendingCard key={x.id} t={t} lang={lang} x={x} av={av.get(x.id)} role={roleOf(x.id)} />)}
      </ul>
    </section>
  );
}

function PendingCard({ t, lang, x, av, role }: { t: Dict; lang: Lang; x: PendingInvite; av?: { text: string; bg: string }; role: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState("");
  const today = londonToday();
  const name = lang === "EN" ? x.name_en : x.name_ru;
  const invitedToday = x.invite?.on_date === today && !x.invite.cancelled;
  const blocked = x.access === "not_listed" || x.access === "revoked";
  const resend = async () => {
    const r = await post("POST", `family-os/people/${x.id}/invite`, {});
    if (r?.status === 202) { setMsg(""); router.refresh(); } else setMsg(r?.status === 409 ? t.already : r?.status === 429 ? t.capped : t.error);
  };
  const cancel = async () => {
    const r = await post("DELETE", `family-os/people/${x.id}/invite`);
    setAsk(false);
    if (r?.ok) { setMsg(t.cancelled); router.refresh(); } else setMsg(t.error);
  };
  return (
    <li data-pending={x.id} className={`${CARD} border-2 border-dashed bg-transparent shadow-none`}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" style={{ background: av?.bg }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] font-semibold text-white">{av?.text}</span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold leading-snug text-[var(--foreground)]">{name}</h3>
          <p className="text-[13px] text-[var(--muted)]">{role || (x.kind === "child" ? t.child : t.adult)} · <span data-invite-state="">{x.invite ? inviteText(tx(ADOPTION_T, lang), x.invite, today, lang) : t.notInvited}</span></p>
        </div>
      </div>
      {blocked && <p data-not-listed="" className="mt-3 text-[13px] text-[var(--foreground)]">{t.noList}</p>}
      {ask ? (
        <div role="alertdialog" aria-label={t.confirm} className="mt-3 flex flex-wrap items-center gap-2">
          <span className="w-full text-[14px] text-[var(--foreground)]">{t.confirm}</span>
          <button type="button" autoFocus onClick={() => setAsk(false)} className={BTN_SECONDARY}>{t.keep}</button>
          <button type="button" data-invite-cancel-yes="" onClick={() => void cancel()} className={BTN_DANGER}>{t.doCancel}</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {!invitedToday && !blocked && <button type="button" data-invite-resend="" onClick={() => void resend()} className={BTN_SECONDARY}>{x.invite && !x.invite.cancelled ? t.resend : t.sendFirst}</button>}
          {x.canCancel && <button type="button" data-invite-cancel="" onClick={() => { setMsg(""); setAsk(true); }} className={BTN_SECONDARY}>{t.cancelInv}</button>}
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-[13px] text-[var(--text-secondary)]">{msg}</p>
    </li>
  );
}
