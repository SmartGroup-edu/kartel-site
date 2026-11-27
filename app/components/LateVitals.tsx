"use client";

// bus 176 P1b: Vercel Web Analytics and Speed Insights start after the page has loaded and the main thread is idle —
// their code is fetched only then (next/dynamic), so it never competes with the crest (LCP) for the first paint. Speed
// Insights still reports LCP / CLS / INP: web-vitals reads the buffered performance entries. bus 176c: both send the
// route pattern only, never the full address (app/lib/vitals-privacy.mjs).
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { vitalsBeforeSend } from "../lib/vitals-privacy.mjs";

const Analytics = dynamic(() => import("@vercel/analytics/next").then((m) => m.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights), { ssr: false });

export default function LateVitals() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const go = () => (w.requestIdleCallback ? w.requestIdleCallback(() => setOn(true), { timeout: 3000 }) : window.setTimeout(() => setOn(true), 500));
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);
  return on ? (<><Analytics beforeSend={vitalsBeforeSend} /><SpeedInsights beforeSend={vitalsBeforeSend} /></>) : null;
}
