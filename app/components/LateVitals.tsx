"use client";

// bus 176 P1b: Vercel Web Analytics and Speed Insights start after the page has loaded and the main thread is idle, so
// their scripts never compete with the crest (LCP) for the first paint. Speed Insights still reports LCP / CLS / INP:
// web-vitals reads the buffered performance entries.
import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function LateVitals() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const go = () => (w.requestIdleCallback ? w.requestIdleCallback(() => setOn(true), { timeout: 3000 }) : window.setTimeout(() => setOn(true), 500));
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);
  return on ? (<><Analytics /><SpeedInsights /></>) : null;
}
