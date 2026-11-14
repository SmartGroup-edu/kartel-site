/**
 * Live Eureka-daily-report panel for the Operations Console.
 * Server-side fetch of RusJAz GET /api/internal/eureka-daily-report (Bearer). Returns an HTML
 * fragment styled with the console's own CSS classes, injected into the static console shell.
 * FAIL-SOFT + no synthetic: if the env is unset, the fetch fails, or no report exists yet, it
 * renders an honest "live data unavailable" notice — never fabricated numbers.
 */

import registry from "@/app/content/registry.public.json";

/** Live registry panel — reads the vendored public registry at request time (reflects the
 *  currently-deployed registry, updated on each publish). No external fetch, cannot fail-open. */
export function renderRegistryPanel(): string {
  const r = registry as Record<string, unknown>;
  const layers = Array.isArray(r.canonicalLayers) ? r.canonicalLayers.length : 0;
  const projects = Array.isArray(r.projects) ? r.projects.length : 0;
  const findCampuses = (o: unknown): unknown[] | null => {
    if (!o || typeof o !== "object") return null;
    const obj = o as Record<string, unknown>;
    if (Array.isArray(obj.campuses)) return obj.campuses;
    for (const k of Object.keys(obj)) {
      const f = findCampuses(obj[k]);
      if (f) return f;
    }
    return null;
  };
  const campuses = findCampuses(r)?.length ?? 0;
  const gateItems = (r.federationGate as { items?: unknown[] })?.items;
  const gate = Array.isArray(gateItems) ? gateItems.length : Array.isArray(r.federationGate) ? (r.federationGate as unknown[]).length : 0;
  const tile = (k: string, v: string) =>
    `<div class="panel stat" style="padding:12px 14px"><div class="k">${escLocal(k)}</div><div class="v tnum" style="font-size:20px">${escLocal(v)}</div></div>`;
  return (
    // The registry projection is vendored at build time — a snapshot, not a live feed (audit #3).
    `<div class="eyebrow"><span data-ru="Снимок реестра · v${escLocal(r.version)} · данные на ${escLocal(r.updated)}">Registry snapshot · v${escLocal(r.version)} · data as of ${escLocal(r.updated)}</span></div>` +
    `<div class="grid reg4" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">` +
    tile("Canonical layers", String(layers)) +
    tile("Campuses", String(campuses)) +
    tile("Projects", String(projects)) +
    tile("Federation gate", gate ? `${gate}-pt` : "—") +
    `</div>`
  );
}

const escLocal = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Strip = { reportDate: string; status: string };
type DailyReport = {
  status?: string;
  blockers?: string[];
  risks?: string[];
  spend?: { todayMicros?: number; capMicros?: number; pct?: number };
  academic?: {
    calibration?: { n?: number; agreement?: number; passed?: boolean };
    moderationQueue?: number;
    reviewQueue?: { pending?: number; disagreeRate?: number };
    scope?: string;
  };
};
type ReportResponse = {
  ok?: boolean;
  reportDate?: string | null;
  status?: string | null;
  generatedAt?: string | null;
  report?: DailyReport | null;
  strip?: Strip[];
};

const statusChip = (s: string | null | undefined) => {
  const v = (s ?? "").toLowerCase();
  const cls = v === "green" ? "s-live" : v === "red" ? "s-blocked" : v === "amber" ? "s-gated" : "";
  const label = v ? v.toUpperCase() : "—";
  return `<span class="chip ${cls}"><span class="dot"></span>${esc(label)}</span>`;
};

/** User-facing fallback carries no configuration detail (audit #3): the reason goes to the
 *  server log only — never env var names or upstream status in the page. */
function notice(reason: string): string {
  console.warn(`[console] Eureka daily report unavailable: ${reason}`);
  return (
    `<div class="eyebrow"><span data-ru="Ежедневный отчёт Eureka">Eureka daily report</span></div>` +
    `<div class="panel" style="padding:14px 16px;border-left:3px solid var(--gated);color:var(--ink-dim);font-size:13px">` +
    `<b style="color:var(--ink)" data-ru="Данные временно недоступны.">Live data is temporarily unavailable.</b></div>`
  );
}

export async function renderLivePanel(): Promise<string> {
  const url = process.env.EUREKA_REPORT_URL;
  const secret = process.env.EUREKA_REPORT_SECRET;
  if (!url || !secret) return notice("Live feed not configured (EUREKA_REPORT_URL / secret unset).");

  let data: ReportResponse;
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return notice(`Report source returned HTTP ${res.status}.`);
    data = (await res.json()) as ReportResponse;
  } catch {
    return notice("Could not reach the report source (RusJAz).");
  }

  const r = data.report;
  if (!data.ok || !r || !data.reportDate) return notice("No daily report generated yet.");

  const spendPct = r.spend?.pct != null ? `${Math.round(r.spend.pct)}%` : "—";
  const modQ = r.academic?.moderationQueue ?? "—";
  const revQ = r.academic?.reviewQueue?.pending ?? "—";
  const calib = r.academic?.calibration?.passed == null ? "—" : r.academic.calibration.passed ? "pass" : "fail";
  const blockers = (r.blockers ?? []).slice(0, 6);
  const risks = (r.risks ?? []).slice(0, 6);
  const strip = (data.strip ?? []).slice(0, 14).reverse();

  const stripDots = strip
    .map((d) => {
      const v = (d.status ?? "").toLowerCase();
      const c = v === "green" ? "var(--live)" : v === "red" ? "var(--blocked)" : "var(--gated)";
      return `<i title="${esc(d.reportDate)}: ${esc(d.status)}" style="width:9px;height:9px;border-radius:2px;background:${c};display:inline-block"></i>`;
    })
    .join("");

  const list = (items: string[], color: string, empty: string) =>
    items.length
      ? `<ul style="margin:6px 0 0;padding-left:16px;display:flex;flex-direction:column;gap:4px">` +
        items.map((b) => `<li style="font-size:12px;color:var(--ink-dim)"><span style="color:${color}">•</span> ${esc(b)}</li>`).join("") +
        `</ul>`
      : `<div style="font-size:12px;color:var(--ink-faint);margin-top:4px">${esc(empty)}</div>`;

  const tile = (k: string, v: string) =>
    `<div class="panel stat" style="padding:12px 14px"><div class="k">${esc(k)}</div><div class="v tnum" style="font-size:20px">${esc(v)}</div></div>`;

  return (
    `<div class="eyebrow">Live · Eureka daily report — ${esc(data.reportDate)} ${statusChip(data.status)}` +
    `<span style="margin-left:auto;display:flex;gap:3px;align-items:center">${stripDots}</span></div>` +
    `<div class="grid reg4" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">` +
    tile("AI spend today", spendPct) +
    tile("Moderation queue", String(modQ)) +
    tile("Review queue", String(revQ)) +
    tile("Calibration", calib) +
    `</div>` +
    `<div class="split" style="margin-bottom:14px">` +
    `<div class="panel" style="padding:14px 16px"><div class="k" style="font-family:var(--sans);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--blocked)">Blockers</div>${list(blockers, "var(--blocked)", "none — no red signals")}</div>` +
    `<div class="panel" style="padding:14px 16px"><div class="k" style="font-family:var(--sans);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--gated)">Risks</div>${list(risks, "var(--gated)", "none — no amber signals")}</div>` +
    `</div>`
  );
}
