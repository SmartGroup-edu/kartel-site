// bus 176 P1b: inline styles — this boundary belongs to the root [lang] segment, so a stylesheet imported here would
// load on the crest home too; the cabinet's tokens (app/globals.css) may not be loaded yet, hence the fallbacks.
export default function Loading() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--background, #ffffff)" }}>
      <style>{"@keyframes kartel-pulse{50%{opacity:.5}}"}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {/* bus 176 P1: a system serif — the web serif here made every page (the crest home included) fetch a 51 KB
            font at the highest priority, ahead of its LCP image. */}
        <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(24px, 4vw, 28px)", letterSpacing: "0.12em", color: "var(--accent, #7b1e2d)" }}>
          KARTEL
        </span>
        <div style={{ height: 1, width: 48, background: "var(--muted-light, #6e6759)", animation: "kartel-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
      </div>
    </div>
  );
}
