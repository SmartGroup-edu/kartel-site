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
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FamilySubNav from "./FamilySubNav";
import { familyNav } from "../content/siteNav";
import { FAMILY_MAIN, FAMILY_HEADER_MAX } from "../lib/family-nav.mjs";
import { useLangToggle } from "./useLang";
import { H1, META } from "../lib/typeScale";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, OS_H2, OS_H3 } from "../lib/family-ui";
import { tx } from "../lib/typograph.mjs";
import FamilyJumpNav from "./FamilyJumpNav";
import type { OsPerson, OsGrant, OsScope, OsRule, OsAdoption } from "../lib/family-os";
import FamilyRules from "./FamilyRules";
import FamilyAdoption from "./FamilyAdoption";
import FamilyPasskeys from "./FamilyPasskeys";
import { addedSensitive, confirmGrantText } from "../lib/family-access.mjs";

type Lang = "EN" | "RU";
const SCOPES: OsScope[] = ["routines", "health", "education", "documents"];
const T = {
  EN: {
    title: "People and access", jump: "On this page", rulesTab: "Rules", withUs: "Who is with us", intro: "Who is in the family and who may see what.",
    people: "People", adult: "Adult", child: "Child", edit: "Edit", save: "Save", cancel: "Cancel", nameEn: "Name (English)", nameRu: "Name (Russian)", email: "Email", kind: "Role",
    addPerson: "Add a person", add: "Add", grants: "Guardians and access", noGrants: "No guardians yet.", guardian: "Guardian", relation: "Relation",
    rel: { parent: "Parent", relative: "Relative" }, scope: { routines: "Routines", health: "Health", education: "School", documents: "Documents" },
    addGrant: "Give access", revoke: "Revoke", confirm: "Revoke access?", keep: "Keep", saved: "Saved.", undo: "Undo", undone: "Change undone.", yes: "Give access", no: "Cancel", adults: "Adults", children: "Children", error: "Could not save", needScope: "Keep at least one area.",
    errors: { exists: "Already exists.", bad_person: "Check the name, email and role.", bad_scopes: "Choose at least one area.", guardian_not_adult: "A guardian must be an adult.", subject_not_child: "Access is given for a child." } as Record<string, string>,
  },
  RU: {
    title: "Люди и доступы", jump: "На этой странице", rulesTab: "Правила", withUs: "Кто уже с нами", intro: "Кто в семье и кто что видит.",
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

export default function FamilyOsAccess({ lang, people, grants, rules = null, adoption = null, ownKeys = null, member = true }: { lang: Lang; member?: boolean; people: OsPerson[]; grants: OsGrant[]; rules?: OsRule[] | null; adoption?: OsAdoption | null; ownKeys?: { canAdd: boolean } | null }) {
  const t = tx(T, lang);
  const toggleLang = useLangToggle(lang);
  const nameOf = (p: OsPerson) => (lang === "EN" ? p.name_en : p.name_ru);
  const sorted = [...people].sort((a, b) => a.kind.localeCompare(b.kind) || nameOf(a).localeCompare(nameOf(b), lang === "EN" ? "en" : "ru"));
  const children = sorted.filter((p) => p.kind === "child"), adults = sorted.filter((p) => p.kind === "adult");
  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} />
      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin os member={member} active="access" />
        <div className="max-w-4xl pb-8">
          <h1 className={H1}>{t.title}</h1>
          <p className={`${META} mt-3 max-w-[60ch]`}>{t.intro}</p>
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
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
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
