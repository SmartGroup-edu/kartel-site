"use client";

/**
 * First-login onboarding (bus 172 P4, mockup v5 «Первый вход»): welcome → a passkey (the existing WebAuthn flow,
 * with the email link + 6-digit code as the fallback) → name and the letter settings that exist → three places →
 * done. The letter settings load in the browser on that step. Shown on «Сегодня» while Family OS says `onboarded: false`; «Открыть» records it (POST /onboarding, date only)
 * and it never shows again. Closing it («Позже») records nothing — it comes back on the next visit.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Check, KeyRound } from "lucide-react";
import { checkEnded } from "../lib/family-ended";
import { BTN_PRIMARY, BTN_SECONDARY } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import type { OsPrefs } from "../lib/family-os";

type Lang = "EN" | "RU";
const T = {
  RU: {
    later: "Позже", step: (n: number) => `Шаг ${n} из 5`,
    hi: (n: string) => `${n}, добро пожаловать в семейный раздел KARTEL`, hiLead: "Здесь дела, календарь, решения и важные документы семьи — в одном месте.", hiTime: "Настройка займёт около минуты.", start: "Начать",
    pkHead: "Вход без пароля", pkLead: "Создадим ключ доступа на этом устройстве: входить можно по Face ID, Touch ID или PIN. Пароль не нужен.",
    pkMake: "Создать ключ доступа", pkBusy: "Подтверди на устройстве…", pkDone: "Ключ создан на этом устройстве. На почту ушло письмо об этом.", pkFail: "Не получилось создать ключ. Можно попробовать ещё раз или пропустить.",
    pkMany: "Ключей уже много — лишний можно отозвать на своей странице.", pkLater: "Слишком много попыток — попробуй через час.",
    pkSkip: "Пропустить — входить по письму с кодом", pkOff: "Входить будешь по письму со ссылкой и 6-значным кодом. Ключи доступа (Face ID, Touch ID) пока не включены.",
    pkNoBrowser: "Этот браузер не умеет ключи доступа. Входить будешь по письму со ссылкой и 6-значным кодом.",
    pkReauth: "Ключ можно создать только сразу после входа по ссылке из письма — так чужое устройство не добавит свой ключ. Это можно сделать позже на своей странице.",
    profHead: "Твой профиль", name: "Имя", nameNote: "Имя меняет владелец семьи.", letters: "Письма",
    morning: "Утреннее письмо: что на сегодня", morningAt: "Время утреннего письма", evening: "Вечернее письмо: что ещё открыто", eveningAt: "Время вечернего письма", lang: "Язык писем", ru: "Русский", en: "English",
    quiet: "Письма не приходят с 21:00 до 07:00.", loading: "Загружаю настройки писем…", noPrefs: "Письма настраиваются на твоей странице.", saveFail: "Не получилось сохранить письма. Их можно настроить позже на своей странице.",
    tourHead: "Три главных места",
    tour: [["Сегодня", "Твои дела, расписание и то, что ждёт твоего ответа, — на одном экране."], ["Календарь", "Общий для семьи: неделя или месяц, у каждого свой цвет."], ["Решения", "Что ждёт решения родителей: передать, перенести, утвердить план. Голосования нет — действует первое решение."]],
    tourChild: [["Мой день", "Твои дела на сегодня. Сделал — нажми на карточку."], ["Календарь", "Что будет в семье на неделе и в месяце."], ["Моя страница", "Нажми на своё имя внизу меню: там твой распорядок и письма."]],
    got: "Понятно", doneHead: (n: string) => `Всё готово, ${n}!`, doneLead: "Раздел открыт. Начни с «Сегодня».", doneChild: "Раздел открыт. Начни с «Мой день».", openToday: "Открыть «Сегодня»", openMyDay: "Открыть «Мой день»",
    finishFail: "Не получилось отметить настройку — она покажется ещё раз при следующем входе.", back: "← Назад", next: "Далее",
  },
  EN: {
    later: "Later", step: (n: number) => `Step ${n} of 5`,
    hi: (n: string) => `${n}, welcome to the KARTEL family area`, hiLead: "Tasks, the calendar, decisions and the family's important documents — in one place.", hiTime: "Setting up takes about a minute.", start: "Start",
    pkHead: "Sign in without a password", pkLead: "Let's create a passkey on this device: sign in with Face ID, Touch ID or a PIN. No password needed.",
    pkMake: "Create a passkey", pkBusy: "Confirm on your device…", pkDone: "Passkey created on this device. An email about it is on its way.", pkFail: "Could not create the passkey. Try again or skip.",
    pkMany: "There are many keys already — revoke one on your page.", pkLater: "Too many tries — please try again in an hour.",
    pkSkip: "Skip — sign in with an emailed code", pkOff: "You will sign in with an email link and a 6-digit code. Passkeys (Face ID, Touch ID) are not switched on yet.",
    pkNoBrowser: "This browser does not support passkeys. You will sign in with an email link and a 6-digit code.",
    pkReauth: "A passkey can be created only right after signing in with an email link — so a stranger's device cannot add its own. You can do it later on your page.",
    profHead: "Your profile", name: "Name", nameNote: "The family owner changes names.", letters: "Emails",
    morning: "Morning email: today's list", morningAt: "Morning email time", evening: "Evening email: what is still open", eveningAt: "Evening email time", lang: "Email language", ru: "Русский", en: "English",
    quiet: "No emails between 21:00 and 07:00.", loading: "Loading the email settings…", noPrefs: "Emails are set on your page.", saveFail: "Could not save the email settings. You can set them later on your page.",
    tourHead: "Three main places",
    tour: [["Today", "Your tasks, schedule and what waits for your answer — on one screen."], ["Calendar", "Shared by the family: a week or a month, a colour for each person."], ["Decisions", "What waits for a parent: hand over, carry over, approve the plan. There is no vote — the first decision stands."]],
    tourChild: [["My day", "Your tasks for today. Done? Tap the card."], ["Calendar", "What the family has this week and this month."], ["My page", "Tap your name at the bottom of the menu: your routine and emails are there."]],
    got: "Got it", doneHead: (n: string) => `All set, ${n}!`, doneLead: "The area is open. Start with Today.", doneChild: "The area is open. Start with My day.", openToday: "Open Today", openMyDay: "Open My day",
    finishFail: "Could not record the setup — it will show again next time.", back: "← Back", next: "Next",
  },
} as const;

const TIMES = Array.from({ length: 14 }, (_, i) => `${String(7 + i).padStart(2, "0")}:00`).flatMap((h) => [h, h.replace(":00", ":30")]).filter((x) => x <= "20:30");
const send = (method: "POST" | "PUT", path: string, body: unknown = {}) =>
  fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null).then(checkEnded);
const field = "mt-1 block min-h-[46px] w-full rounded-[var(--fos-control,10px)] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";

export default function FamilyOnboarding({ lang, me, passkeys }: {
  lang: Lang; me: { id: string; name: string; kind: "adult" | "child" }; passkeys: { on: boolean; canAdd: boolean };
}) {
  const t = tx(T, lang);
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [pk, setPk] = useState<"" | "busy" | "done" | "fail" | "many" | "later">("");
  const [supported, setSupported] = useState(true);
  const [p, setP] = useState<OsPrefs | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);
  const first = me.name.trim().split(/\s+/)[0] || me.name;
  const child = me.kind === "child";
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser capability, known only after mount
  useEffect(() => { setSupported(browserSupportsWebAuthn()); }, []);
  useEffect(() => { if (step > 0) head.current?.focus(); }, [step]);
  // The letter settings, once, when the profile step opens (no Family OS call in the page render for the tour).
  useEffect(() => {
    if (step !== 2 || loaded) return;
    fetch(`/api/family-os/people/${me.id}/prefs`, { credentials: "same-origin", cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
      .then((j: { prefs?: OsPrefs } | null) => { setP(j?.prefs ?? null); setLoaded(true); }).catch(() => setLoaded(true));
  }, [step, loaded, me.id]);
  const go = (n: number) => { setMsg(""); setStep(n); };

  const makeKey = async () => {
    setPk("busy");
    try {
      const o = await send("POST", "/api/family-auth/passkey/register/options");
      if (!o?.ok) { setPk(o?.status === 409 ? "many" : o?.status === 429 ? "later" : "fail"); return; }
      const { options } = await o.json();
      const response = await startRegistration({ optionsJSON: options });
      const v = await send("POST", "/api/family-auth/passkey/register/verify", { response });
      setPk(v?.status === 201 ? "done" : v?.status === 429 ? "later" : "fail");
    } catch { setPk("fail"); }
  };

  const saveProfile = async () => {
    if (p) {
      setBusy(true);
      const r = await send("PUT", `/api/family-os/people/${me.id}/prefs`, { email_on: p.email_on, digest_time: p.digest_time, evening_on: p.evening_on, evening_time: p.evening_time, lang: p.lang, ...(p.count_mode ? { count_mode: p.count_mode } : {}) });
      setBusy(false);
      if (!r?.ok) { setMsg(t.saveFail); return; }
    }
    go(3);
  };

  const finish = async () => {
    setBusy(true);
    const r = await send("POST", "/api/family-os/onboarding");
    setBusy(false);
    if (!r?.ok) { setMsg(t.finishFail); return; }
    setOpen(false); router.refresh();
  };

  const title = [t.hi(first), t.pkHead, t.profHead, t.tourHead, t.doneHead(first)][step];
  const pkLine = !passkeys.on ? t.pkOff : !supported ? t.pkNoBrowser : !passkeys.canAdd ? t.pkReauth : pk === "done" ? t.pkDone : pk === "fail" ? t.pkFail : pk === "many" ? t.pkMany : pk === "later" ? t.pkLater : pk === "busy" ? t.pkBusy : "";
  const canMake = passkeys.on && supported && passkeys.canAdd && pk !== "done";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) setOpen(false); }}>
      <DialogContent closeLabel={t.later} data-onboarding="" data-step={step}
        className="left-0 top-0 grid h-dvh w-full max-w-none translate-x-0 translate-y-0 place-items-center overflow-y-auto rounded-none border-0 bg-[radial-gradient(90%_70%_at_50%_0%,var(--fos-panel-2),var(--fos-bg))] p-4 sm:max-w-none sm:p-8">
        <div className="flex w-full max-w-[520px] flex-col gap-4 rounded-[24px] border border-[var(--border)] bg-[var(--fos-panel)] p-6 shadow-[var(--fos-shadow-lg)] sm:p-8">
          <div aria-hidden="true" className="flex gap-1.5">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={`h-1 flex-1 rounded ${i <= step ? "bg-[var(--fos-accent-2)]" : "bg-[var(--border)]"}`} />)}</div>
          {step === 0 && <span aria-hidden="true" className="grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-[var(--accent)] font-serif text-[26px] font-semibold text-[var(--on-accent)]">K</span>}
          {step === 4 && <span aria-hidden="true" className="mx-auto grid h-[84px] w-[84px] place-items-center rounded-full bg-[var(--fos-accent-2)] text-[var(--fos-on-accent-2)]"><Check size={40} strokeWidth={2.5} /></span>}
          <div>
            <DialogTitle ref={head} tabIndex={-1} className={`font-serif text-[26px] font-semibold leading-[1.15] text-[var(--foreground)] outline-none sm:text-[28px] ${step === 4 ? "text-center" : ""}`}>{title}</DialogTitle>
            <DialogDescription className={`mt-1 text-[13px] text-[var(--muted)] ${step === 4 ? "text-center" : ""}`}>{t.step(step + 1)}</DialogDescription>
          </div>

          {step === 0 && (<>
            <p className="text-[16px] text-[var(--text-secondary)]">{t.hiLead}</p>
            <p className="text-[14px] text-[var(--text-secondary)]">{t.hiTime}</p>
            <button type="button" data-ob-next="" autoFocus onClick={() => go(1)} className={`${BTN_PRIMARY} w-full`}>{t.start}</button>
          </>)}

          {step === 1 && (<>
            <p className="text-[16px] text-[var(--text-secondary)]">{t.pkLead}</p>
            <span aria-hidden="true" className={`mx-auto grid h-[84px] w-[84px] place-items-center rounded-[24px] text-[34px] ${pk === "done" ? "bg-[var(--fos-accent-2)] text-[var(--fos-on-accent-2)]" : "bg-[var(--fos-panel-2)]"}`}>{pk === "done" ? <Check size={36} strokeWidth={2.5} /> : <KeyRound size={34} strokeWidth={1.75} className="text-[var(--fos-accent-2)]" />}</span>
            <p role="status" aria-live="polite" data-ob-passkey={pk || (canMake ? "ready" : "unavailable")} className="text-center text-[14px] text-[var(--text-secondary)]">{pkLine}</p>
            {canMake ? (<>
              <button type="button" data-ob-passkey-make="" disabled={pk === "busy"} onClick={() => void makeKey()} className={`${BTN_PRIMARY} w-full`}>{t.pkMake}</button>
              <button type="button" data-ob-skip="" onClick={() => go(2)} className={`${BTN_SECONDARY} w-full`}>{t.pkSkip}</button>
            </>) : <button type="button" data-ob-next="" onClick={() => go(2)} className={`${BTN_PRIMARY} w-full`}>{t.next}</button>}
          </>)}

          {step === 2 && (<>
            <div>
              <p className={label}>{t.name}</p>
              <p className="mt-1 text-[17px] text-[var(--foreground)]">{me.name}</p>
              <p className="text-[13px] text-[var(--muted)]">{t.nameNote}</p>
            </div>
            {!loaded ? <p role="status" className="text-[15px] text-[var(--text-secondary)]">{t.loading}</p> : p ? (
              <fieldset className="grid gap-3">
                <legend className={label}>{t.letters}</legend>
                <label className="flex min-h-11 items-center gap-3 text-[15px] text-[var(--foreground)]">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--fos-accent-2)]" checked={p.email_on} onChange={(e) => setP({ ...p, email_on: e.target.checked })} />{t.morning}
                </label>
                {p.email_on && <label className={label}>{t.morningAt}<select className={field} value={p.digest_time} onChange={(e) => setP({ ...p, digest_time: e.target.value })}>{[...new Set([p.digest_time, ...TIMES])].sort().map((x) => <option key={x}>{x}</option>)}</select></label>}
                <label className="flex min-h-11 items-center gap-3 text-[15px] text-[var(--foreground)]">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--fos-accent-2)]" checked={p.evening_on} onChange={(e) => setP({ ...p, evening_on: e.target.checked })} />{t.evening}
                </label>
                {p.evening_on && <label className={label}>{t.eveningAt}<select className={field} value={p.evening_time} onChange={(e) => setP({ ...p, evening_time: e.target.value })}>{[...new Set([p.evening_time, ...TIMES])].sort().map((x) => <option key={x}>{x}</option>)}</select></label>}
                <label className={label}>{t.lang}<select className={field} value={p.lang} onChange={(e) => setP({ ...p, lang: e.target.value === "en" ? "en" : "ru" })}><option value="ru">{t.ru}</option><option value="en">{t.en}</option></select></label>
                <p className="text-[13px] text-[var(--muted)]">{t.quiet}</p>
              </fieldset>
            ) : <p className="text-[15px] text-[var(--text-secondary)]">{t.noPrefs}</p>}
            <button type="button" data-ob-next="" disabled={busy || !loaded} onClick={() => void saveProfile()} className={`${BTN_PRIMARY} w-full`}>{t.next}</button>
          </>)}

          {step === 3 && (<>
            <ul className="grid gap-2.5">
              {(child ? t.tourChild : t.tour).map(([h, d]) => (
                <li key={h} className="rounded-[14px] border border-[var(--border)] p-3">
                  <b className="block text-[15px] text-[var(--foreground)]">{h}</b><span className="text-[14px] text-[var(--text-secondary)]">{d}</span>
                </li>
              ))}
            </ul>
            <button type="button" data-ob-next="" onClick={() => go(4)} className={`${BTN_PRIMARY} w-full`}>{t.got}</button>
          </>)}

          {step === 4 && (<>
            <p className="text-center text-[16px] text-[var(--text-secondary)]">{child ? t.doneChild : t.doneLead}</p>
            <button type="button" data-ob-finish="" disabled={busy} onClick={() => void finish()} className={`${BTN_PRIMARY} w-full`}>{child ? t.openMyDay : t.openToday}</button>
          </>)}

          {msg && <p role="alert" className="text-[14px] text-[var(--destructive)]">{msg}</p>}
          {step > 0 && step < 4 && <button type="button" onClick={() => go(step - 1)} className={`${BTN_SECONDARY} self-start`}>{t.back}</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
