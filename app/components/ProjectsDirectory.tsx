"use client";

import { useLangToggle, type Lang } from "./useLang";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { projectsContent } from "../content/projects";
import { projectSummaries } from "../content/federationCopy";
import { roleLabel, statusLabel } from "../content/tokens";
import registry from "../content/registry.public.json";

// `value` is the raw English token (drives colour logic); `label` is the
// localised display text. Kept separate so translation never shifts the tone.
function RolePill({ value, label }: { value: string; label?: string }) {
  const authority = /authority/i.test(value);
  const planned = /planned/i.test(value);
  const tone = authority
    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)]"
    : planned
      ? "border-[var(--border)] text-[var(--muted)]"
      : "border-[var(--accent)] text-[var(--accent)]";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}>
      {label ?? value}
    </span>
  );
}

function StatusPill({ value, label }: { value?: string; label?: string }) {
  if (!value) return <span className="text-[var(--muted)]">—</span>;
  const active = /(connected|consumed|producer|steward|geo-anchored)/i.test(value);
  const tone = active ? "text-[var(--text-body)]" : "text-[var(--muted)]";
  return <span className={`text-xs ${tone}`}>{label ?? value}</span>;
}

export default function ProjectsDirectory({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = projectsContent[lang];

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} navItems={[...c.nav]} />

      <main id="main" className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        <FadeInSection>
          <header className="border-b border-[var(--border)] pb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">{c.eyebrow}</p>
            <h1 className="mt-2 font-serif text-4xl text-[var(--foreground)] sm:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--text-body)]">{c.intro}</p>
          </header>
        </FadeInSection>

        <FadeInSection>
          <div className="mt-8 overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">{c.cols.project}</th>
                  <th className="px-4 py-3 font-medium">{c.cols.role}</th>
                  <th className="px-4 py-3 font-medium">{c.cols.identity}</th>
                  <th className="px-4 py-3 font-medium">{c.cols.geography}</th>
                  <th className="px-4 py-3 font-medium">{c.cols.organisation}</th>
                </tr>
              </thead>
              <tbody>
                {registry.projects.map((p) => {
                  const layers = p.layers as unknown as Record<string, string>;
                  return (
                    <tr key={p.key} className="border-b border-[var(--border)] align-top last:border-0">
                      <td className="px-4 py-4">
                        <div className="font-serif text-base text-[var(--foreground)]">{p.name}</div>
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]">
                            {p.url.replace(/^https?:\/\//, "")} ↗
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">{p.type}</span>
                        )}
                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--muted)]">{projectSummaries[lang][p.key] ?? p.summary}</p>
                      </td>
                      <td className="px-4 py-4"><RolePill value={(p as { role?: string }).role ?? "—"} label={roleLabel(lang, (p as { role?: string }).role ?? "—")} /></td>
                      <td className="px-4 py-4"><StatusPill value={layers.identity} label={statusLabel(lang, layers.identity)} /></td>
                      <td className="px-4 py-4"><StatusPill value={layers.geography} label={statusLabel(lang, layers.geography)} /></td>
                      <td className="px-4 py-4"><StatusPill value={layers.organisation} label={statusLabel(lang, layers.organisation)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FadeInSection>

        {/* Role legend */}
        <FadeInSection>
          <section className="mt-10">
            <h2 className="font-serif text-lg text-[var(--foreground)]">{c.roleLegendTitle}</h2>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {c.roleLegend.map((r) => (
                <div key={r.role} className="flex gap-2 rounded-md border border-[var(--border)] p-3">
                  <dt><RolePill value={r.role} label={roleLabel(lang, r.role)} /></dt>
                  <dd className="text-xs text-[var(--muted)]">{r.desc}</dd>
                </div>
              ))}
            </dl>
          </section>
        </FadeInSection>

        <FadeInSection>
          <p className="mt-12 border-t border-[var(--border)] pt-6 text-xs leading-relaxed text-[var(--muted)]">
            {c.publicNote}
          </p>
        </FadeInSection>
      </main>

      <SiteFooter motto={c.motto} copy={c.copy} contactEmail={null} />
    </>
  );
}
