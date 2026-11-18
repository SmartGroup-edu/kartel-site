"use client";

// «Вход» — passkeys on a person's page (bus 98/100). Three views from one component:
//  - own: list, rename, revoke, and «Добавить ключ на этом устройстве» — only from a session that came from the
//    email link ≤ 15 minutes ago (otherwise a link to sign in again);
//  - a parent of a child: the child's keys, revoke (no adding — a child adds their own);
//  - the owner: anyone's keys, revoke, and «Вернуть» for a key paused as suspicious.
// Dates only, never times; no credential ids anywhere in the page.
import { useCallback, useEffect, useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { H2, META } from "../lib/typeScale";

type Lang = "EN" | "RU";
type Key = { id: string; label: string; kind: string; synced: boolean; created_on: string; last_used_on: string | null; flagged: boolean };
type Data = { keys: Key[]; can: { add: boolean; revoke: boolean; rename: boolean; clear: boolean } };
const T = {
  RU: {
    head: "Вход", lead: "Ключ доступа — вход по Face ID, Touch ID, отпечатку или ключу безопасности, без письма. Ссылка из письма продолжает работать всегда.",
    leadOther: "Ключи доступа этого человека. Отзыв сразу закрывает вход с этим ключом; уже открытые сеансы закончатся сами в течение 8 часов.",
    none: "Ключей пока нет.", add: "Добавить ключ на этом устройстве", adding: "Подтверди на устройстве…", added: "Ключ добавлен. На почту ушло письмо об этом.",
    reauth: "Чтобы добавить ключ, войди заново по ссылке из письма — так чужое устройство не сможет добавить свой ключ.", reauthLink: "Войти по ссылке",
    unsupported: "Этот браузер не умеет ключи доступа. Вход по ссылке из письма работает как прежде.",
    failed: "Не получилось добавить ключ. Попробуй ещё раз.", tooMany: "Ключей уже много — сначала отзови ненужный.", later: "Слишком много попыток — попробуй через час.",
    added_on: (d: string) => `добавлен ${d}`, used_on: (d: string) => `последний вход ${d}`, synced: "синхронизируется", flagged: "Приостановлен: ключ повёл себя необычно",
    rename: "Переименовать", save: "Сохранить", cancel: "Отмена", name: "Название", revoke: "Отозвать", confirm: "Отозвать этот ключ? Войти с ним больше не получится.", yes: "Отозвать", no: "Оставить",
    restore: "Вернуть", error: "Не получилось — попробуй ещё раз.",
    kind: { iphone: "iPhone", ipad: "iPad", mac: "Mac", android: "Android", windows: "Windows", linux: "Linux", key: "Ключ безопасности", other: "Устройство" } as Record<string, string>,
  },
  EN: {
    head: "Sign-in", lead: "A passkey signs you in with Face ID, Touch ID, a fingerprint or a security key, without an email. The email link always keeps working.",
    leadOther: "This person's passkeys. Revoking closes sign-in with that key at once; sessions already open end by themselves within 8 hours.",
    none: "No passkeys yet.", add: "Add a passkey on this device", adding: "Confirm on your device…", added: "Passkey added. An email about it is on its way.",
    reauth: "To add a passkey, sign in again with an email link — so a stranger's device cannot add its own key.", reauthLink: "Sign in with a link",
    unsupported: "This browser does not support passkeys. The email link works as before.",
    failed: "Could not add the passkey. Please try again.", tooMany: "There are many keys already — revoke one first.", later: "Too many tries — please try again in an hour.",
    added_on: (d: string) => `added ${d}`, used_on: (d: string) => `last sign-in ${d}`, synced: "synced", flagged: "Paused: the key behaved unusually",
    rename: "Rename", save: "Save", cancel: "Cancel", name: "Name", revoke: "Revoke", confirm: "Revoke this passkey? It will no longer sign in.", yes: "Revoke", no: "Keep",
    restore: "Restore", error: "Could not do that — please try again.",
    kind: { iphone: "iPhone", ipad: "iPad", mac: "Mac", android: "Android", windows: "Windows", linux: "Linux", key: "Security key", other: "Device" } as Record<string, string>,
  },
} as const;

const btn = "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-60";
const primary = "inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60";
const day = (d: string, lang: Lang) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const post = (path: string, body: unknown = {}, method: "POST" | "PATCH" = "POST") =>
  fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" }).catch(() => null);

export default function FamilyPasskeys({ lang, personId, self, canAdd, signinHref }: { lang: Lang; personId: string | null; self: boolean; canAdd: boolean; signinHref: string }) {
  const t = T[lang];
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const src = self ? "/api/family-os/passkeys/mine" : `/api/family-os/people/${personId}/passkeys`;
  const load = useCallback(() => {
    fetch(src, { credentials: "same-origin", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => setData(d)).catch(() => setData(null));
  }, [src]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser capability, known only after mount
    setSupported(browserSupportsWebAuthn());
  }, [load]);

  const add = async () => {
    setBusy(true); setMsg(t.adding);
    try {
      const o = await post("/api/family-auth/passkey/register/options");
      if (!o?.ok) { setMsg(o?.status === 403 ? t.reauth : o?.status === 409 ? t.tooMany : o?.status === 429 ? t.later : t.failed); return; }
      const { options } = await o.json();
      const response = await startRegistration({ optionsJSON: options });
      const v = await post("/api/family-auth/passkey/register/verify", { response });
      setMsg(v?.status === 201 ? t.added : v?.status === 429 ? t.later : t.failed);
      load();
    } catch { setMsg(t.failed); } finally { setBusy(false); }
  };

  return (
    <section id="signin-keys" aria-labelledby="signin-keys-h" data-passkeys={self ? "self" : "other"} className="mt-12 scroll-mt-24">
      <h2 id="signin-keys-h" className={H2}>{t.head}</h2>
      <p className={`${META} mt-2 max-w-[60ch]`}>{self ? t.lead : t.leadOther}</p>
      {data && (data.keys.length ? (
        <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {data.keys.map((k) => <Row key={k.id} lang={lang} k={k} can={data.can} onChange={load} />)}
        </ul>
      ) : <p className="mt-4 text-[16px] text-[var(--text-secondary)]">{t.none}</p>)}
      {self && (!supported ? <p className="mt-4 text-[15px] text-[var(--text-secondary)]">{t.unsupported}</p>
        : canAdd ? <p className="mt-4"><button type="button" data-passkey-add="" onClick={add} disabled={busy} className={primary}>{t.add}</button></p>
        : <p data-passkey-reauth="" className="mt-4 max-w-[60ch] text-[15px] text-[var(--text-secondary)]">{t.reauth} <a href={signinHref} className="inline-flex min-h-11 items-center underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">{t.reauthLink}</a></p>)}
      <p role="status" aria-live="polite" className="mt-2 text-[15px] text-[var(--text-secondary)]">{msg}</p>
    </section>
  );
}

function Row({ lang, k, can, onChange }: { lang: Lang; k: Key; can: Data["can"]; onChange: () => void }) {
  const t = T[lang];
  const [mode, setMode] = useState<"" | "rename" | "confirm">("");
  const [label, setLabel] = useState(k.label);
  const [err, setErr] = useState("");
  const act = async (p: Promise<Response | null>) => { const r = await p; if (r?.ok) { setMode(""); setErr(""); onChange(); } else setErr(t.error); };
  return (
    <li data-passkey-row="" className="py-4">
      <p className="text-[17px] text-[var(--foreground)]">{k.label}</p>
      <p className="mt-0.5 text-[15px] text-[var(--text-secondary)]">
        {[t.kind[k.kind] ?? t.kind.other, k.synced ? t.synced : "", t.added_on(day(k.created_on, lang)), k.last_used_on ? t.used_on(day(k.last_used_on, lang)) : ""].filter(Boolean).join(" · ")}
      </p>
      {k.flagged && <p data-passkey-flagged="" className="mt-1 text-[15px] font-medium text-[var(--destructive)]">{t.flagged}</p>}
      {mode === "rename" ? (
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); act(post(`/api/family-os/passkeys/${k.id}`, { label }, "PATCH")); }}>
          <label className="block text-[14px] font-medium text-[var(--text-secondary)]">{t.name}
            <input value={label} maxLength={40} required onChange={(e) => setLabel(e.target.value)} className="mt-1 block min-h-[46px] w-64 max-w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-[16px] text-[var(--foreground)]" />
          </label>
          <button type="submit" className={primary}>{t.save}</button>
          <button type="button" onClick={() => setMode("")} className={btn}>{t.cancel}</button>
        </form>
      ) : mode === "confirm" ? (
        <div role="alertdialog" aria-label={t.confirm} className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-[15px] text-[var(--foreground)]">{t.confirm}</p>
          <button type="button" data-passkey-confirm="" onClick={() => act(post(`/api/family-os/passkeys/${k.id}/revoke`))} className={primary}>{t.yes}</button>
          <button type="button" onClick={() => setMode("")} className={btn}>{t.no}</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {can.rename && <button type="button" onClick={() => setMode("rename")} className={btn}>{t.rename}</button>}
          {can.revoke && <button type="button" data-passkey-revoke="" onClick={() => setMode("confirm")} className={btn}>{t.revoke}</button>}
          {can.clear && k.flagged && <button type="button" onClick={() => act(post(`/api/family-os/passkeys/${k.id}/clear-flag`))} className={btn}>{t.restore}</button>}
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-[15px] text-[var(--destructive)]">{err}</p>}
    </li>
  );
}
