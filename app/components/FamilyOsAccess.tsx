"use client";

/**
 * Family OS admin screen (Stage 2): people and guardian grants. Admin only — the service refuses
 * every write here from anyone else. The admin manages who is in the family and who may see what,
 * but this screen shows no one's notes, routines or documents.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FamilySubNav from "./FamilySubNav";
import { familyNav } from "../content/siteNav";
import { FAMILY_MAIN, FAMILY_HEADER_MAX } from "../lib/family-nav.mjs";
import { useLangToggle } from "./useLang";
import { H1, H2, META } from "../lib/typeScale";
import type { OsPerson, OsGrant, OsScope } from "../lib/family-os";

type Lang = "EN" | "RU";
const SCOPES: OsScope[] = ["routines", "health", "education", "documents"];
const T = {
  EN: {
    title: "People and access", intro: "Who is in the family and who may see what. Changes apply on the next page load.",
    people: "People", adult: "Adult", child: "Child", edit: "Edit", save: "Save", cancel: "Cancel", nameEn: "Name (English)", nameRu: "Name (Russian)", email: "Email", kind: "Role",
    addPerson: "Add a person", add: "Add", grants: "Guardians and access", noGrants: "No guardians yet.", guardian: "Guardian", relation: "Relation",
    rel: { parent: "Parent", relative: "Relative" }, scope: { routines: "Routines", health: "Health", education: "School", documents: "Documents" },
    addGrant: "Give access", revoke: "Revoke", confirm: "Revoke access?", keep: "Keep", saved: "Saved.", error: "Could not save", needScope: "Keep at least one area.",
    errors: { exists: "Already exists.", bad_person: "Check the name, email and role.", bad_scopes: "Choose at least one area.", guardian_not_adult: "A guardian must be an adult.", subject_not_child: "Access is given for a child." } as Record<string, string>,
  },
  RU: {
    title: "Люди и доступы", intro: "Кто в семье и кто что видит. Изменения действуют со следующей загрузки страницы.",
    people: "Люди", adult: "Взрослый", child: "Ребёнок", edit: "Изменить", save: "Сохранить", cancel: "Отмена", nameEn: "Имя (латиницей)", nameRu: "Имя (кириллицей)", email: "Почта", kind: "Роль",
    addPerson: "Добавить человека", add: "Добавить", grants: "Опекуны и доступ", noGrants: "Опекунов пока нет.", guardian: "Опекун", relation: "Кем приходится",
    rel: { parent: "Родитель", relative: "Родственник" }, scope: { routines: "Распорядок", health: "Здоровье", education: "Учёба", documents: "Документы" },
    addGrant: "Дать доступ", revoke: "Отозвать", confirm: "Отозвать доступ?", keep: "Оставить", saved: "Сохранено.", error: "Не удалось сохранить", needScope: "Оставьте хотя бы одну область.",
    errors: { exists: "Уже есть.", bad_person: "Проверьте имя, почту и роль.", bad_scopes: "Выберите хотя бы одну область.", guardian_not_adult: "Опекуном может быть только взрослый.", subject_not_child: "Доступ даётся к ребёнку." } as Record<string, string>,
  },
} as const;
type Dict = (typeof T)[Lang];

const send = (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) =>
  fetch(`/api/family-os/${path}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin", cache: "no-store" }).catch(() => null);
const field = "mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[16px] text-[var(--foreground)]";
const label = "block text-[14px] font-medium text-[var(--text-secondary)]";
const btn = "inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[15px] text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-50";
const primary = "inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]";

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

export default function FamilyOsAccess({ lang, people, grants }: { lang: Lang; people: OsPerson[]; grants: OsGrant[] }) {
  const t = T[lang];
  const toggleLang = useLangToggle(lang);
  const nameOf = (p: OsPerson) => (lang === "EN" ? p.name_en : p.name_ru);
  const sorted = [...people].sort((a, b) => a.kind.localeCompare(b.kind) || nameOf(a).localeCompare(nameOf(b), lang === "EN" ? "en" : "ru"));
  const children = sorted.filter((p) => p.kind === "child"), adults = sorted.filter((p) => p.kind === "adult");
  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={familyNav(lang)} maxWidth={FAMILY_HEADER_MAX} />
      <main id="main" className={FAMILY_MAIN}>
        <FamilySubNav lang={lang} admin os active="access" />
        <div className="max-w-4xl pb-8">
          <h1 className={H1}>{t.title}</h1>
          <p className={`${META} mt-3 max-w-[60ch]`}>{t.intro}</p>

          <section aria-labelledby="ppl-h" className="mt-10">
            <h2 id="ppl-h" className={H2}>{t.people}</h2>
            <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {sorted.map((p) => <PersonRow key={p.id} t={t} p={p} />)}
            </ul>
            <AddPerson t={t} />
          </section>

          <section aria-labelledby="grants-h" className="mt-12">
            <h2 id="grants-h" className={H2}>{t.grants}</h2>
            {children.map((c) => (
              <div key={c.id} data-child-grants="" className="mt-6">
                <h3 className="font-serif text-[20px] text-[var(--foreground)]">{nameOf(c)}</h3>
                {grants.filter((g) => g.child_id === c.id).length === 0 && <p className={`${META} mt-2`}>{t.noGrants}</p>}
                <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {grants.filter((g) => g.child_id === c.id).map((g) => {
                    const who = people.find((x) => x.id === g.guardian_id);
                    return <GrantRow key={g.id} t={t} g={g} name={who ? nameOf(who) : "—"} />;
                  })}
                </ul>
                <AddGrant t={t} child={c} adults={adults.filter((a) => !grants.some((g) => g.child_id === c.id && g.guardian_id === a.id))} nameOf={nameOf} />
              </div>
            ))}
          </section>
        </div>
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}

function PersonRow({ t, p }: { t: Dict; p: OsPerson }) {
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
            <p className="text-[16px] text-[var(--foreground)]">{p.name_en} <span className="text-[var(--text-secondary)]">/ {p.name_ru}</span></p>
            <p className="mt-0.5 text-[14px] text-[var(--muted)]">{p.kind === "adult" ? t.adult : t.child}</p>
            {p.email && <p className="text-[14px] text-[var(--muted)] [overflow-wrap:anywhere]">{p.email}</p>}
          </div>
          <button type="button" className={btn} onClick={() => setEdit(true)} aria-label={`${t.edit}: ${p.name_en}`}>{t.edit}</button>
          <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
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
    <details className="mt-6 rounded-lg border border-[var(--border)] p-4">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-[var(--foreground)]">{t.addPerson}</summary>
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
    </details>
  );
}

function ScopeBoxes({ t, value, onChange, name }: { t: Dict; value: OsScope[]; onChange: (v: OsScope[]) => void; name: string }) {
  return (
    <fieldset>
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

function GrantRow({ t, g, name }: { t: Dict; g: OsGrant; name: string }) {
  const [scopes, setScopes] = useState<OsScope[]>(g.scopes);
  const [ask, setAsk] = useState(false);
  const { msg, run } = useSave(t);
  const [local, setLocal] = useState("");
  const change = async (next: OsScope[]) => {
    if (next.length === 0) return setLocal(t.needScope);
    setLocal(""); const prev = scopes; setScopes(next);
    if (!(await run(send("PATCH", `grants/${g.id}`, { scopes: next })))) setScopes(prev);
  };
  return (
    <li data-grant={g.relation} className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[16px] text-[var(--foreground)]">{name} <span className="text-[14px] text-[var(--text-secondary)]">· {t.rel[g.relation]}</span></p>
        {ask ? (
          <span className="flex gap-2">
            <button type="button" className={btn} onClick={() => run(send("DELETE", `grants/${g.id}`))}>{t.confirm}</button>
            <button type="button" className={btn} onClick={() => setAsk(false)}>{t.keep}</button>
          </span>
        ) : <button type="button" className={btn} onClick={() => setAsk(true)} aria-label={`${t.revoke}: ${name}`}>{t.revoke}</button>}
      </div>
      <div className="mt-2"><ScopeBoxes t={t} value={scopes} onChange={change} name={`${t.grants}: ${name}`} /></div>
      <p role="status" aria-live="polite" className="mt-1 text-[14px] text-[var(--muted)]">{local || msg}</p>
    </li>
  );
}

function AddGrant({ t, child, adults, nameOf }: { t: Dict; child: OsPerson; adults: OsPerson[]; nameOf: (p: OsPerson) => string }) {
  const [scopes, setScopes] = useState<OsScope[]>(["routines"]);
  const { msg, run } = useSave(t);
  if (adults.length === 0) return null;
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(send("POST", "grants", { guardian_id: f.get("guardian_id"), child_id: child.id, relation: f.get("relation"), scopes }));
  };
  return (
    <details className="mt-3 rounded-lg border border-[var(--border)] p-4">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-[var(--foreground)]">{t.addGrant}</summary>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label}>{t.guardian}<select name="guardian_id" className={field}>{adults.map((a) => <option key={a.id} value={a.id}>{nameOf(a)}</option>)}</select></label>
        <label className={label}>{t.relation}<select name="relation" className={field} defaultValue="relative"><option value="parent">{t.rel.parent}</option><option value="relative">{t.rel.relative}</option></select></label>
        <div className="sm:col-span-2"><ScopeBoxes t={t} value={scopes} onChange={setScopes} name={t.addGrant} /></div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={primary}>{t.addGrant}</button>
          <span role="status" aria-live="polite" className="text-[14px] text-[var(--muted)]">{msg}</span>
        </div>
      </form>
    </details>
  );
}
