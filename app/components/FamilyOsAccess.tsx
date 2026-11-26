"use client";

/**
 * Family OS admin screen (Stage 2): people and guardian grants. Admin only — the service refuses
 * every write here from anyone else. The admin manages who is in the family and who may see what,
 * but this screen shows no one's notes, routines or documents.
 */
import { checkEnded } from "../lib/family-ended";
import Disclosure from "./Disclosure";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { H1, META } from "../lib/typeScale";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, OS_H2, OS_H3 } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";
import FamilyJumpNav from "./FamilyJumpNav";
import type { OsPerson, OsGrant, OsScope, OsRule, OsAdoption } from "../lib/family-os";
import { avatars as avatarsOf } from "../lib/family-avatars.mjs";
import FamilyRules from "./FamilyRules";
import FamilyAdoption from "./FamilyAdoption";
import FamilyPasskeys from "./FamilyPasskeys";
import { addedSensitive, confirmGrantText } from "../lib/family-access.mjs";

type Lang = "EN" | "RU";
const SCOPES: OsScope[] = ["routines", "health", "education", "documents"];
const T = {
  EN: {
    title: "Access and security", jump: "On this page", rulesTab: "Rules", withUs: "Who is with us", intro: "Who sees what, and how everyone signs in.",
    roles: "Roles", roleName: { owner: "owner", editor: "heritage editor", member: "family member", child: "child" } as Record<string, string>,
    sees: { owner: "Everything, including access and security", editor: "Like a family member, plus the heritage editor — every change waits for the owner", parent: "Today, tasks, calendar, decisions, people, documents; decides the children's queue and approves the plan", relative: (x: string) => `Today, tasks, calendar, decisions, people, documents; for ${x}`, adult: "Today, tasks, calendar, decisions, people, documents and rules", child: "My day and the calendar" } as const,
    noGuest: "There is no guest role: everyone here is an adult or a child of the family.",
    signin: "Sign-in and protection", readOnly: "Read only: these are set when the site is deployed.",
    pkOn: "Passkey (Face ID / Touch ID)", pkOnHint: (n: number | null, of: number | null) => (n !== null && of !== null ? `The main way in · ${n} of ${of} have one` : "The main way in"), pkOffHint: "Not switched on yet",
    code: "A letter with a link and a 6-digit code", codeHint: "The fallback, always on", on: "on", off: "off",
    letter: "Morning letter", letterHint: "Each person sets their own time on their page",
    last: "Latest sign-in", lastHint: (n: string, d: string) => `${n} · ${d}`, lastNone: "No one has signed in yet", never: (n: number) => `${n} not signed in yet`, datesOnly: "Family OS keeps the day only — not the time or the device.",
    people: "People", adult: "Adult", child: "Child", edit: "Edit", save: "Save", cancel: "Cancel", nameEn: "Name (English)", nameRu: "Name (Russian)", email: "Email", kind: "Role",
    addPerson: "Add a person", add: "Add", grants: "Guardians and access", noGrants: "No guardians yet.", guardian: "Guardian", relation: "Relation",
    rel: { parent: "Parent", relative: "Relative" }, scope: { routines: "Routines", health: "Health", education: "School", documents: "Documents" },
    addGrant: "Give access", revoke: "Revoke", confirm: "Revoke access?", keep: "Keep", saved: "Saved.", undo: "Undo", undone: "Change undone.", yes: "Give access", no: "Cancel", adults: "Adults", children: "Children", error: "Could not save", needScope: "Keep at least one area.",
    errors: { exists: "Already exists.", bad_person: "Check the name, email and role.", bad_scopes: "Choose at least one area.", guardian_not_adult: "A guardian must be an adult.", subject_not_child: "Access is given for a child." } as Record<string, string>,
  },
  RU: {
    title: "Доступ и безопасность", jump: "На этой странице", rulesTab: "Правила", withUs: "Кто уже с нами", intro: "Кто что видит и как входит.",
    roles: "Роли", roleName: { owner: "владелец", editor: "редактор наследия", member: "член семьи", child: "ребёнок" } as Record<string, string>,
    sees: { owner: "Всё, включая доступ и безопасность", editor: "Как член семьи, плюс редактор наследия — каждая правка ждёт владельца", parent: "Сегодня, задачи, календарь, решения, люди, документы; решает очередь детей и утверждает план", relative: (x: string) => `Сегодня, задачи, календарь, решения, люди, документы; доступ: ${x}`, adult: "Сегодня, задачи, календарь, решения, люди, документы и правила", child: "Мой день и календарь" } as const,
    noGuest: "Роли «гость» нет: каждый здесь — взрослый или ребёнок семьи.",
    signin: "Вход и защита", readOnly: "Только просмотр: это настраивается при выпуске сайта.",
    pkOn: "Ключ доступа (Face ID / Touch ID)", pkOnHint: (n: number | null, of: number | null) => (n !== null && of !== null ? `Основной способ входа · есть у ${n} из ${of}` : "Основной способ входа"), pkOffHint: "Пока не включён",
    code: "Письмо со ссылкой и 6-значным кодом", codeHint: "Запасной способ, включён всегда", on: "вкл.", off: "выкл.",
    letter: "Утреннее письмо", letterHint: "Время каждый выбирает на своей странице",
    last: "Последний вход", lastHint: (n: string, d: string) => `${n} · ${d}`, lastNone: "Пока никто не входил", never: (n: number) => `ещё не входили: ${n}`, datesOnly: "Family OS хранит только день входа — без времени и устройства.",
    people: "Люди", adult: "Взрослый", child: "Ребёнок", edit: "Изменить", save: "Сохранить", cancel: "Отмена", nameEn: "Имя (латиницей)", nameRu: "Имя (кириллицей)", email: "Почта", kind: "Роль",
    addPerson: "Добавить человека", add: "Добавить", grants: "Опекуны и доступ", noGrants: "Опекунов пока нет.", guardian: "Опекун", relation: "Кем приходится",
    rel: { parent: "Родитель", relative: "Родственник" }, scope: { routines: "Распорядок", health: "Здоровье", education: "Учёба", documents: "Документы" },
    addGrant: "Дать доступ", revoke: "Отозвать", confirm: "Отозвать доступ?", keep: "Оставить", saved: "Сохранено.", undo: "Отменить", undone: "Изменение отменено.", yes: "Дать доступ", no: "Отмена", adults: "Взрослые", children: "Дети", error: "Не удалось сохранить", needScope: "Оставь хотя бы одну область.",
    errors: { exists: "Уже есть.", bad_person: "Проверь имя, почту и роль.", bad_scopes: "Выбери хотя бы одну область.", guardian_not_adult: "Опекуном может быть только взрослый.", subject_not_child: "Доступ даётся к ребёнку." } as Record<string, string>,
  },
} as const;
type Dict = (typeof T)[Lang];

const send = (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin", cache: "no-store" }).catch(() => null).then(checkEnded);
const field = "mt-1 block min-h-[46px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] leading-6 text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = BTN_SECONDARY;
const primary = BTN_PRIMARY;

function useSave(t: Dict) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const run = async (p: Promise<Response | null>) => {
    const r = await p;
    if (r?.ok) { setMsg(t.saved); router.refresh(); return true; }
    const code = ((await r?.json().catch(() => null)) as { error?: string } | null)?.error ?? "";
    setMsg(t.errors[code] ?? `${t.error}${r ? ` (${r.status})` : ""}`); return false;
  };
  return { msg, run };
}

/** bus 172 P3: built on the server by app/lib/family-people.mjs (roleRows, signinSummary). */
export type RoleRow = { id: string; name: string; role: "owner" | "editor" | "member" | "child"; rel: "parent" | "relative" | "adult" | "child"; sees: { child: string; scopes: OsScope[] }[] };
export type SigninSummary = { passkeys: boolean; withKey: number | null; of: number | null; last: { name: string; on: string } | null; never: number | null };

export default function FamilyOsAccess({ lang, people, grants, rules = null, adoption = null, ownKeys = null, roles = [], signin = null }: { lang: Lang; people: OsPerson[]; grants: OsGrant[]; rules?: OsRule[] | null; adoption?: OsAdoption | null; ownKeys?: { canAdd: boolean } | null; roles?: RoleRow[]; signin?: SigninSummary | null }) {
  const t = tx(T, lang);
  const nameOf = (p: OsPerson) => (lang === "EN" ? p.name_en : p.name_ru);
  const sorted = [...people].sort((a, b) => a.kind.localeCompare(b.kind) || nameOf(a).localeCompare(nameOf(b), lang === "EN" ? "en" : "ru"));
  const children = sorted.filter((p) => p.kind === "child"), adults = sorted.filter((p) => p.kind === "adult");
  return (
    <>
      <div data-fos-page="">
        <div className="pb-8">
          <h1 className={H1}>{t.title}</h1>
          <p className="mt-1 max-w-[60ch] text-[15px] text-[var(--muted)]">{t.intro}</p>
          <Overview t={t} lang={lang} roles={roles} signin={signin} />
          <div className="max-w-4xl">
          {/* bus 78 #5: one tap to each part of a long page (the same index as the person page, bus 157b D6) */}
          <FamilyJumpNav kind="access" label={t.jump} items={[...(adoption ? [["#with-us", t.withUs] as [string, string]] : []), ["#people", t.people], ["#grants", t.grants], ...(rules ? [["#rules", t.rulesTab] as [string, string]] : [])]} />

          {adoption && <FamilyAdoption lang={lang} data={adoption} />}
          {/* the owner who is not a person row: their own passkeys live here (bus 98/100) */}
          {ownKeys && <FamilyPasskeys lang={lang} personId={null} self canAdd={ownKeys.canAdd} signinHref={`/${lang === "EN" ? "en" : "ru"}/family/signin?returnTo=${encodeURIComponent(`/${lang === "EN" ? "en" : "ru"}/family/os/access#signin-keys`)}`} />}

          <section id="people" aria-labelledby="ppl-h" className="mt-10 scroll-mt-24">
            <h2 id="ppl-h" className={OS_H2}>{t.people}</h2>
            {([[t.adults, adults], [t.children, children]] as const).filter(([, xs]) => xs.length).map(([head, xs]) => (
              <div key={head} className="mt-6">
                <h3 className={OS_H3}>{head}</h3>
                <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {xs.map((p) => <PersonRow key={p.id} t={t} p={p} lang={lang} />)}
                </ul>
              </div>
            ))}
            <AddPerson t={t} />
          </section>

          <section id="grants" aria-labelledby="grants-h" className="mt-12 scroll-mt-24">
            <h2 id="grants-h" className={OS_H2}>{t.grants}</h2>
            {children.map((c) => (
              <div key={c.id} data-child-grants="" className="mt-6">
                <h3 className={OS_H3}>{nameOf(c)}</h3>
                {grants.filter((g) => g.child_id === c.id).length === 0 && <p className={`${META} mt-2`}>{t.noGrants}</p>}
                <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {grants.filter((g) => g.child_id === c.id).map((g) => {
                    const who = people.find((x) => x.id === g.guardian_id);
                    return <GrantRow key={g.id} t={t} lang={lang} g={g} name={who ? nameOf(who) : "—"} />;
                  })}
                </ul>
                <AddGrant t={t} lang={lang} child={c} adults={adults.filter((a) => !grants.some((g) => g.child_id === c.id && g.guardian_id === a.id))} nameOf={nameOf} />
              </div>
            ))}
          </section>

          {rules && <FamilyRules lang={lang} rules={rules} />}
          </div>
        </div>
      </div>
    </>
  );
}

const CARD_H = "text-[15px] font-semibold text-[var(--foreground)]";
const CARD = "rounded-[var(--fos-radius)] border border-[var(--border)] bg-[var(--fos-panel)] p-5 shadow-[var(--fos-shadow)]";
const ROW = "flex items-center gap-3 border-t border-[var(--border)] px-1.5 py-2.5 first:border-t-0";

/**
 * «Роли» and «Вход и защита» (bus 172 P3, mockup v5). Read-only: roles come from the allow-lists and the grants, the
 * sign-in methods from the deploy settings; the editing below (people, grants, rules) is unchanged.
 */
function Overview({ t, lang, roles, signin }: { t: Dict; lang: Lang; roles: RoleRow[]; signin: SigninSummary | null }) {
  const av = avatarsOf(roles.map((r) => ({ id: r.id, name: r.name }))) as Map<string, { text: string; bg: string }>;
  const sees = (r: RoleRow) => r.role === "owner" ? t.sees.owner : r.role === "editor" ? t.sees.editor : r.role === "child" ? t.sees.child
    : r.rel === "parent" ? t.sees.parent : r.rel === "relative" ? t.sees.relative(r.sees.map((s) => `${s.child} — ${s.scopes.map((k) => t.scope[k].toLowerCase()).join(", ")}`).join("; ")) : t.sees.adult;
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "EN" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  const state = (on: boolean) => <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${on ? "bg-[var(--ok-soft)] text-[var(--ok)]" : "bg-[var(--fos-panel-2)] text-[var(--muted)] ring-1 ring-[var(--border)]"}`}>{on ? t.on : t.off}</span>;
  return (
    <div data-access-overview="" className="mt-6 grid gap-[18px] min-[900px]:grid-cols-2">
      <section aria-labelledby="roles-h" data-roles="" className={CARD}>
        <h2 id="roles-h" className={CARD_H}>{t.roles}</h2>
        <ul className="mt-2">
          {roles.map((r) => (
            <li key={r.id} data-role={r.role} className={ROW}>
              <span aria-hidden="true" style={{ background: av.get(r.id)?.bg }} className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[12px] font-semibold text-white">{av.get(r.id)?.text}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-[var(--foreground)]">{r.name} — {t.roleName[r.role]}</p>
                <p className="text-[13px] text-[var(--muted)]">{sees(r)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-[var(--muted)]">{t.noGuest}</p>
      </section>
      <section aria-labelledby="signin-h" data-signin-methods="" className={CARD}>
        <h2 id="signin-h" className={CARD_H}>{t.signin}</h2>
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">{t.readOnly}</p>
        <ul className="mt-2">
          <li data-method="passkey" className={ROW}><div className="min-w-0 flex-1"><p className="text-[15px] font-medium">{t.pkOn}</p><p className="text-[13px] text-[var(--muted)]">{signin?.passkeys ? t.pkOnHint(signin.withKey, signin.of) : t.pkOffHint}</p></div>{state(Boolean(signin?.passkeys))}</li>
          <li data-method="code" className={ROW}><div className="min-w-0 flex-1"><p className="text-[15px] font-medium">{t.code}</p><p className="text-[13px] text-[var(--muted)]">{t.codeHint}</p></div>{state(true)}</li>
          <li data-method="letter" className={ROW}><div className="min-w-0 flex-1"><p className="text-[15px] font-medium">{t.letter}</p><p className="text-[13px] text-[var(--muted)]">{t.letterHint}</p></div></li>
          {signin && signin.of !== null && (
            <li data-method="last" className={ROW}><div className="min-w-0 flex-1"><p className="text-[15px] font-medium">{t.last}</p>
              <p className="text-[13px] text-[var(--muted)]" suppressHydrationWarning>{signin.last ? t.lastHint(signin.last.name, fmt(signin.last.on)) : t.lastNone}{signin.never ? ` · ${t.never(signin.never)}` : ""}</p>
              <p className="text-[13px] text-[var(--muted)]">{t.datesOnly}</p></div></li>
          )}
        </ul>
      </section>
    </div>
  );
}

function PersonRow({ t, p, lang }: { t: Dict; p: OsPerson; lang: Lang }) {
  const [edit, setEdit] = useState(false);
  const { msg, run } = useSave(t);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (await run(send("PATCH", `people/${p.id}`, { name_en: String(f.get("name_en") ?? "").trim(), name_ru: String(f.get("name_ru") ?? "").trim() }))) setEdit(false);
  };
  return (
    <li data-admin-person={p.kind} className="py-3">
      {edit ? (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <label className={label}>{t.nameEn}<input name="name_en" defaultValue={p.name_en} required maxLength={200} className={field} /></label>
          <label className={label}>{t.nameRu}<input name="name_ru" defaultValue={p.name_ru} required maxLength={200} lang="ru" className={field} /></label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" className={primary}>{t.save}</button>
            <button type="button" className={btn} onClick={() => setEdit(false)}>{t.cancel}</button>
            <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="text-[16px] text-[var(--foreground)]">{lang === "EN" ? p.name_en : p.name_ru} <span className="text-[var(--text-secondary)]">/ {lang === "EN" ? p.name_ru : p.name_en}</span></p>
            <p className="mt-0.5 text-[14px] text-[var(--muted)]">{p.kind === "adult" ? t.adult : t.child}</p>
            {p.email && <p className="text-[14px] text-[var(--muted)] [overflow-wrap:anywhere]">{p.email}</p>}
          </div>
          <button type="button" className={btn} onClick={() => setEdit(true)} aria-label={`${t.edit}: ${lang === "EN" ? p.name_en : p.name_ru}`}>{t.edit}</button>
          {msg && <p role="status" aria-live="polite" className="basis-full text-[14px] text-[var(--muted)]">{msg}</p>}
        </div>
      )}
    </li>
  );
}

function AddPerson({ t }: { t: Dict }) {
  const { msg, run } = useSave(t);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const body = { email: String(f.get("email") ?? "").trim(), name_en: String(f.get("name_en") ?? "").trim(), name_ru: String(f.get("name_ru") ?? "").trim(), kind: f.get("kind") };
    if (await run(send("POST", "people", body))) form.reset();
  };
  return (
    <Disclosure summary={t.addPerson} className="mt-6">
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label}>{t.nameEn}<input name="name_en" required maxLength={200} className={field} /></label>
        <label className={label}>{t.nameRu}<input name="name_ru" required maxLength={200} lang="ru" className={field} /></label>
        <label className={label}>{t.email}<input name="email" type="email" required autoComplete="off" className={field} /></label>
        <label className={label}>{t.kind}<select name="kind" className={field} defaultValue="adult"><option value="adult">{t.adult}</option><option value="child">{t.child}</option></select></label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={primary}>{t.add}</button>
          <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
        </div>
      </form>
    </Disclosure>
  );
}

function ScopeBoxes({ t, value, onChange, name, disabled = false }: { t: Dict; value: OsScope[]; onChange: (v: OsScope[]) => void; name: string; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">{name}</legend>
      <div className="flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <label key={s} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[15px] ${value.includes(s) ? "border-[var(--accent)] text-[var(--foreground)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={value.includes(s)} onChange={() => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s])} />
            {t.scope[s]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function GrantRow({ t, lang, g, name }: { t: Dict; lang: Lang; g: OsGrant; name: string }) {
  const [scopes, setScopes] = useState<OsScope[]>(g.scopes);
  const [ask, setAsk] = useState(false);
  const [pending, setPending] = useState<OsScope[] | null>(null); // a sensitive grant waiting for «Дать доступ»
  const [undo, setUndo] = useState<OsScope[] | null>(null);
  const { msg, run } = useSave(t);
  const [local, setLocal] = useState("");
  const save = async (next: OsScope[], prev: OsScope[], isUndo = false) => {
    setPending(null); setScopes(next);
    if (await run(send("PATCH", `grants/${g.id}`, { scopes: next }))) { setUndo(isUndo ? null : prev); setLocal(isUndo ? t.undone : ""); }
    else setScopes(prev);
  };
  const change = (next: OsScope[]) => {
    if (next.length === 0) return setLocal(t.needScope);
    setLocal(""); setUndo(null);
    if (addedSensitive(scopes, next).length) return setPending(next);
    void save(next, scopes);
  };
  const sensitive = pending ? addedSensitive(scopes, pending) : [];
  return (
    <li data-grant={g.relation} className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-[16px] text-[var(--foreground)]">{name} <span className="text-[14px] text-[var(--text-secondary)]">· {t.rel[g.relation]}</span></p>
        {/* D4: revoking is a danger action — its own style, a confirm first, and the safe «Оставить» first in line */}
        {ask ? (
          <span className="flex flex-wrap gap-2">
            <button type="button" autoFocus className={btn} onClick={() => setAsk(false)}>{t.keep}</button>
            <button type="button" data-grant-revoke-yes="" className={BTN_DANGER} onClick={() => run(send("DELETE", `grants/${g.id}`))}>{t.confirm}</button>
          </span>
        ) : <button type="button" data-grant-revoke="" className={BTN_DANGER} onClick={() => setAsk(true)} aria-label={`${t.revoke}: ${name}`}>{t.revoke}</button>}
      </div>
      <div className="mt-2"><ScopeBoxes t={t} value={pending ?? scopes} onChange={change} name={`${t.grants}: ${name}`} disabled={Boolean(pending)} /></div>
      {pending && (
        <div data-confirm-grant="" role="alertdialog" aria-label={confirmGrantText(sensitive, name, lang)} className="mt-3 rounded-md border border-[var(--accent)] p-3">
          <p className="text-[15px] text-[var(--foreground)]">{confirmGrantText(sensitive, name, lang)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={() => save(pending, scopes)}>{t.yes}</button>
            <button type="button" className={btn} onClick={() => setPending(null)}>{t.no}</button>
          </div>
        </div>
      )}
      <div className={`flex flex-wrap items-center gap-3 ${local || msg ? "mt-2 min-h-11" : ""}`}>
        <p role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{local || msg}</p>
        {undo && !local && msg === t.saved && <button type="button" className={btn} onClick={() => save(undo, scopes, true)}>{t.undo}</button>}
      </div>
    </li>
  );
}

function AddGrant({ t, lang, child, adults, nameOf }: { t: Dict; lang: Lang; child: OsPerson; adults: OsPerson[]; nameOf: (p: OsPerson) => string }) {
  const [scopes, setScopes] = useState<OsScope[]>(["routines"]);
  const { msg, run } = useSave(t);
  const [confirm, setConfirm] = useState<{ guardian_id: string; relation: string; name: string } | null>(null);
  if (adults.length === 0) return null;
  const give = (b: { guardian_id: string; relation: string }) => { setConfirm(null); return run(send("POST", "grants", { ...b, child_id: child.id, scopes })); };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b = { guardian_id: String(f.get("guardian_id")), relation: String(f.get("relation")) };
    if (addedSensitive([], scopes).length) return setConfirm({ ...b, name: nameOf(adults.find((a) => a.id === b.guardian_id)!) });
    await give(b);
  };
  return (
    <Disclosure summary={t.addGrant} className="mt-3">
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label}>{t.guardian}<select name="guardian_id" className={field}>{adults.map((a) => <option key={a.id} value={a.id}>{nameOf(a)}</option>)}</select></label>
        <label className={label}>{t.relation}<select name="relation" className={field} defaultValue="relative"><option value="parent">{t.rel.parent}</option><option value="relative">{t.rel.relative}</option></select></label>
        <div className="sm:col-span-2"><ScopeBoxes t={t} value={scopes} onChange={setScopes} name={t.addGrant} /></div>
        {confirm ? (
          <div data-confirm-grant="" role="alertdialog" aria-label={confirmGrantText(addedSensitive([], scopes), confirm.name, lang)} className="rounded-md border border-[var(--accent)] p-3 sm:col-span-2">
            <p className="text-[15px] text-[var(--foreground)]">{confirmGrantText(addedSensitive([], scopes), confirm.name, lang)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={primary} onClick={() => give(confirm)}>{t.yes}</button>
              <button type="button" className={btn} onClick={() => setConfirm(null)}>{t.no}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" className={primary}>{t.addGrant}</button>
            <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
          </div>
        )}
      </form>
    </Disclosure>
  );
}
