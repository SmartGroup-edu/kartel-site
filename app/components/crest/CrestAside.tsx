"use client";

import { useEffect, useRef, useState } from "react";
import { CrestImg, Hatching, crestStyles as s } from "./CrestChrome";

/** The left panel of the sign-in and pending pages, from 900 px (signin-v2 mockup): the crest over the heraldic
 *  hatching with a light that follows the cursor (it breathes on touch), the motto, three plain promises. No business. */
export default function CrestAside({ label, mottoTr, features }: { label: string; mottoTr: string; features: readonly string[] }) {
  const ref = useRef<HTMLElement>(null);
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mm = (q: string) => window.matchMedia(q).matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a device capability, known only after mount
    setTouch(!mm("(pointer: fine)") || mm("(prefers-reduced-motion: reduce)"));
  }, []);
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const a = ref.current;
    if (!a || touch) return;
    const r = a.getBoundingClientRect();
    a.style.setProperty("--px", `${e.clientX - r.left}px`);
    a.style.setProperty("--py", `${e.clientY - r.top}px`);
  };
  return (
    <aside ref={ref} className={`${s.aside} ${touch ? s.touch : ""}`} aria-label={label} onPointerMove={move}>
      <Hatching />
      <div className={s.acontent}>
        <div className={s.acrest}><div className={s.masked}><CrestImg sizes="300px" eager /></div></div>
        <p className={s.amotto} lang="la">Virtus et Potestas</p>
        <p className={s.atr}>{mottoTr}</p>
        <ul className={s.afeat}>{features.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
    </aside>
  );
}
