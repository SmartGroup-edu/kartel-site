"use client";

import { useLangToggle, type Lang } from "./useLang";
import { noDashLineStart } from "../lib/typography";
import { H1, H2, H3, PROSE, EYEBROW, META, TH, snapshotLine } from "../lib/typeScale";
import Pill from "./Pill";
import SiteHeader from "./SiteHeader";
import { registryNav } from "../content/siteNav";
import SiteFooter from "./SiteFooter";
import FadeInSection from "./FadeInSection";
import { federationContent } from "../content/federation";
import { statusLabel, roleLabel, tierLabel, layerKeyLabel, bandLabel } from "../content/tokens";
import fed from "../content/federation.public.json";

// `value` is the raw English token (drives colour logic); `label` is the
// localised display text. Kept separate so translation never shifts the tone.
function StatusPill({ value, label }: { value: string; label?: string }) {
  const on = /(live|active|ratified|connected|consumed|producer|steward|anchored)/i.test(value);
  return <Pill tone={on ? "accent" : "muted"}>{label ?? value}</Pill>;
}

/** Member-count band: privacy-banded, never an exact value < 5 at a named entity. */
function Band({ value, label }: { value: string; label?: string }) {
  const zero = value === "0";
  return (
    <span className={`font-mono text-[14px] ${zero ? "text-[var(--muted)]" : "text-[var(--text-body)]"}`}>{label ?? value}</span>
  );
}

export default function FederationMap({ lang }: { lang: Lang }) {
  const toggleLang = useLangToggle(lang);
  const c = federationContent[lang];
  const integrity = fed.integrity as Record<string, unknown>;

  return (
    <>
      <SiteHeader lang={lang} toggleLang={toggleLang} subNav={registryNav(lang)} />

      <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        <FadeInSection>
          <header className="border-b border-[var(--border)] pb-8">
            <p className={EYEBROW}>{c.eyebrow}</p>
            <h1 className={`mt-2 ${H1}`}>{c.title}</h1>
            <p className={`mt-4 max-w-[68ch] ${PROSE}`}>{noDashLineStart(c.intro)}</p>
            <p className={`mt-4 ${META}`}>{snapshotLine(lang, null, fed.generatedAt)}</p>
          </header>
        </FadeInSection>

        {/* Canonical layers + contracts */}
        <FadeInSection>
          <section className="mt-12">
            <h2 className={H2}>{c.sections.layers}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {fed.canonicalLayers.map((l) => (
                <span key={l.key} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                  <span className="font-serif text-[var(--foreground)]">{c.layerNames[l.key] ?? l.name}</span>
                  <StatusPill value={l.status} label={statusLabel(lang, l.status)} />
                </span>
              ))}
            </div>
            <h3 className={`mt-8 ${H3}`}>{c.sections.contracts}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {fed.contracts.map((ct) => (
                <span key={ct.key} className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
                  <span className="font-mono text-[14px] text-[var(--text-body)]">{ct.name}</span>
                  <StatusPill value={ct.status} label={statusLabel(lang, ct.status)} />
                </span>
              ))}
            </div>
          </section>
        </FadeInSection>

        {/* Platform participation */}
        <FadeInSection>
          <section className="mt-12">
            <h2 className={H2}>{c.sections.platforms}</h2>
            <div tabIndex={0} role="region" aria-label={c.sections.platforms} className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left">
                    <th className={TH}>{c.cols.platform}</th>
                    <th className={TH}>{c.cols.role}</th>
                    <th className={TH}>{c.cols.cpif}</th>
                    <th className={TH}>{c.cols.layers}</th>
                  </tr>
                </thead>
                <tbody>
                  {fed.platforms.map((p) => (
                    <tr key={p.key} className="border-b border-[var(--border)] align-top last:border-0">
                      <td className="px-4 py-4 font-serif text-base text-[var(--foreground)]">{p.name}</td>
                      <td className="px-4 py-4 text-[var(--text-body)]">{roleLabel(lang, p.role)}</td>
                      <td className="px-4 py-4"><Band value={p.cpifLinked} label={bandLabel(lang, p.cpifLinked)} /></td>
                      <td className="px-4 py-4 text-[14px] text-[var(--muted)]">
                        {Object.entries(p.layers as Record<string, string>).map(([k, v]) => `${layerKeyLabel(lang, k)}: ${statusLabel(lang, v)}`).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </FadeInSection>

        {/* Topology */}
        <FadeInSection>
          <section className="mt-12">
            <h2 className={H2}>{c.sections.topology}</h2>
            <div tabIndex={0} role="region" aria-label={c.sections.topology} className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left">
                    <th className={TH}>{c.cols.anchor}</th>
                    <th className={TH}>{c.cols.tier}</th>
                    <th className={TH}>{c.cols.region}</th>
                    <th className={TH}>{c.cols.members}</th>
                  </tr>
                </thead>
                <tbody>
                  {fed.topology.map((t) => (
                    <FedRows key={t.code} node={t} lang={lang} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </FadeInSection>

        {/* Integrity */}
        <FadeInSection>
          <section className="mt-12">
            <h2 className={H2}>{c.sections.integrity}</h2>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(["orphanOrg", "orphanCampus", "orphanRegion", "drift", "strayNodes", "subjectsOnNonCanonicalNodes"] as const).map((k) => (
                <div key={k} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3">
                  <dt className="text-[14px] text-[var(--muted)]">{c.integrityLabels[k]}</dt>
                  <dd className="font-mono text-sm text-[var(--foreground)]">{String(integrity[k])}</dd>
                </div>
              ))}
            </dl>
            <p className={`mt-4 ${META}`}>{noDashLineStart(c.bandNote)}</p>
          </section>
        </FadeInSection>

        <FadeInSection>
          <p className={`mt-12 border-t border-[var(--border)] pt-6 ${META}`}>
            {noDashLineStart(c.publicNote)}
          </p>
        </FadeInSection>
      </main>

      <SiteFooter motto={c.motto} copy={c.copy} contactEmail={null} />
    </>
  );
}

type FedNode = {
  code: string;
  name: string;
  tier: string;
  region: string | null;
  members: string;
  campuses?: { code: string; location: string; region: string; members: string }[];
};

function FedRows({ node, lang }: { node: FedNode; lang: Lang }) {
  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0">
        <td className="px-4 py-3">
          <span className="font-mono text-[14px] text-[var(--accent)]">{node.code}</span>
          <span className="ml-2 text-[14px] text-[var(--muted)]">{node.name}</span>
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">{tierLabel(lang, node.tier)}</td>
        <td className="px-4 py-3 font-mono text-[14px] text-[var(--text-body)]">{node.region ?? "—"}</td>
        <td className="px-4 py-3"><Band value={node.members} label={bandLabel(lang, node.members)} /></td>
      </tr>
      {(node.campuses ?? []).map((cp) => (
        <tr key={cp.code} className="border-b border-[var(--border)] last:border-0">
          <td className="px-4 py-3 pl-8">
            <span className="text-[var(--muted)]">↳ </span>
            <span className="font-mono text-[14px] text-[var(--text-body)]">{cp.code}</span>
            <span className="ml-2 text-[14px] text-[var(--muted)]">{cp.location}</span>
          </td>
          <td className="px-4 py-3 text-[14px] text-[var(--muted)]">{tierLabel(lang, "campus")}</td>
          <td className="px-4 py-3 font-mono text-[14px] text-[var(--text-body)]">{cp.region}</td>
          <td className="px-4 py-3"><Band value={cp.members} label={bandLabel(lang, cp.members)} /></td>
        </tr>
      ))}
    </>
  );
}
