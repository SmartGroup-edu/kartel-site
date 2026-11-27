"use client";

/**
 * The public home (bus 176 P1): the coat of arms page of the R0-approved mockup
 * bus/assets/2026-11-27-home-crest-v6-APPROVED.html — intro, header, hero, crest explorer, four colours, the motto
 * over the heraldic hatching, FAQ, the «Для членов семьи» card and the footer. Heraldry only; nothing here names a
 * business, a project or a person (R0 2026-11-27). Everything renders on the server (SEO); this file only adds the
 * motion: tilt / gloss (fine pointer, no reduced motion), the explorer, the cursor light, scroll reveals.
 * bus 176 P1b (LCP < 2.5 s): the hero crest and the H1 are painted in the first frame — the intro is played by the hero
 * crest itself (CSS), the hero effects and the explorer crest wait until the page has loaded (afterLoad).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { latinMotto } from "../../lib/latin";
import type { CrestHomeContent, CrestLang } from "../../content/crestHome";
import { CrestImg, HERO_SIZES, LangSwitch, SignInIcon, Brand, Hatching, crestStyles as s } from "./CrestChrome";

const SECTIONS = ["explore", "colours", "motto", "faq"] as const;

/** The ornament divider at the top of a section, drawn on scroll. */
function Orn() {
  return (
    <svg className={`${s.orn}`} data-orn="" viewBox="0 0 560 24" aria-hidden="true" focusable="false">
      <path d="M0 12H226" /><path d="M560 12H334" />
      <path d="M236 12c11-11 33-11 44 0s33 11 44 0" /><path d="M236 12c11 11 33 11 44 0s33-11 44 0" />
      <path className={s.gem} d="M280 5l7 7-7 7-7-7z" />
    </svg>
  );
}

/** Runs `fn` once the page has loaded (the hero crest included) and the main thread is idle — never before the LCP.
 *  Returns a cancel function for the effect cleanup. */
function afterLoad(fn: () => void): () => void {
  let idle = 0, timer = 0;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  const go = () => { if (w.requestIdleCallback) idle = w.requestIdleCallback(fn, { timeout: 1500 }); else timer = window.setTimeout(fn, 200); };
  if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
  return () => { window.removeEventListener("load", go); if (idle) w.cancelIdleCallback?.(idle); window.clearTimeout(timer); };
}

/** Runs before the first paint (inline, in the HTML): marks JS on (reveals may hide) and decides the intro —
 *  once per browser session, never under reduced motion. The intro is a CSS animation of the hero crest; it cannot
 *  hide anything (bus 176 P1b). */
const BOOT = `(function(){var d=document.documentElement;d.setAttribute('data-crest-js','');try{if(!sessionStorage.getItem('kartel-intro')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){d.setAttribute('data-intro','');sessionStorage.setItem('kartel-intro','1')}}catch(e){}})()`;

export default function CrestHome({ lang, content }: { lang: CrestLang; content: CrestHomeContent }) {
  const { t, colours, faq, elements } = content;
  const signinHref = `/${lang}/family/signin`;
  const other: CrestLang = lang === "ru" ? "en" : "ru";
  const langHrefs = { ru: "/ru", en: "/en" };
  const [act, setAct] = useState(0);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [fine, setFine] = useState(false);
  const [touch, setTouch] = useState(false);
  const [late, setLate] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const mottoRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = elements.length;

  // After load and idle (bus 176 P1b — nothing here may compete with the hero crest): the pointer and motion
  // preferences switch on tilt / gloss / sheen and the motto light, the explorer crest starts loading, the grain, the
  // header blur and the crest shadow come in (data-crest-late, see crest.module.css), and the intro flag is cleared once its animation has played (≤ 1.8 s), so a client-side return does not replay it.
  useEffect(() => {
    let id = 0;
    const cancel = afterLoad(() => {
      const mm = (q: string) => window.matchMedia(q).matches;
      const reduce = mm("(prefers-reduced-motion: reduce)");
      setFine(mm("(pointer: fine)") && !reduce);
      setTouch(!mm("(pointer: fine)") || reduce);
      setLate(true);
      document.documentElement.setAttribute("data-crest-late", "");
      id = window.setTimeout(() => document.documentElement.removeAttribute("data-intro"), 1800);
    });
    return () => { cancel(); window.clearTimeout(id); };
  }, []);

  // Header border after the first 10 px of scroll.
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 10);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Scroll reveal: sections and ornament dividers get `in` once they enter the viewport.
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal], [data-orn]")];
    const show = (e: Element) => e.classList.add(s.in);
    if (!("IntersectionObserver" in window)) return els.forEach(show);
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { show(x.target); io.unobserve(x.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Escape closes the phone menu.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  // Hero spotlight, tilt and gloss — fine pointer only, never under reduced motion.
  const onHeroMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!fine) return;
    const hero = heroRef.current, tilt = tiltRef.current, box = boxRef.current;
    if (!hero || !tilt || !box) return;
    const r = hero.getBoundingClientRect();
    hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
    hero.style.setProperty("--my", `${e.clientY - r.top}px`);
    const b = box.getBoundingClientRect(), px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
    tilt.style.transform = `rotateY(${px * 10}deg) rotateX(${-py * 8}deg)`;
    tilt.style.setProperty("--gx", `${50 + px * 60}%`);
    tilt.style.setProperty("--gy", `${30 + py * 60}%`);
  };
  const onHeroLeave = () => { if (tiltRef.current) tiltRef.current.style.transform = ""; };

  // The motto's hatching: a light that follows the cursor (touch: it breathes, by CSS).
  const onMottoMove = (e: React.PointerEvent<HTMLElement>) => {
    const m = mottoRef.current;
    if (!m || touch) return;
    const r = m.getBoundingClientRect();
    m.style.setProperty("--px", `${e.clientX - r.left}px`);
    m.style.setProperty("--py", `${e.clientY - r.top}px`);
  };

  // Explorer: WAI-ARIA tabs with a roving tabindex; ←/→/Home/End move the selection, the hotspots are a pointer shortcut.
  const pick = (i: number, focus = false) => {
    setAct(i);
    if (focus) tabRefs.current[i]?.focus({ preventScroll: true });
  };
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const k = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    pick(k, true);
  };
  const el = elements[act];

  return (
    <div className={s.site}>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <a className={s.skip} href="#main">{t.skip}</a>

      <header className={`${s.header} ${scrolled ? s.scrolled : ""}`}>
        <div className={`${s.wrap} ${s.hd}`}>
          <Brand href="#main" label={t.brandHome} />
          <nav className={s.nav} aria-label={t.sections}>
            {SECTIONS.map((id) => <a key={id} href={`#${id}`}>{t.nav[id]}</a>)}
          </nav>
          <div className={s.right}>
            <LangSwitch lang={lang} hrefs={langHrefs} label={t.langGroup} className={s.langDesk} />
            <Link className={`${s.btn} ${s.gold} ${s.sm} ${s.sheen}`} href={signinHref} prefetch={false} aria-label={t.signin} data-signin="header">
              <SignInIcon /><span className={s.signinLabel}>{t.signin}</span>
            </Link>
            <button className={s.burger} type="button" aria-label={t.menu} aria-expanded={menu} aria-controls="crest-drawer" onClick={() => setMenu((v) => !v)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
        <nav className={`${s.drawer} ${menu ? s.on : ""}`} id="crest-drawer" aria-label={t.menu} hidden={!menu}>
          {SECTIONS.map((id) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)}>{t.nav[id]}</a>)}
          <LangSwitch lang={lang} hrefs={langHrefs} label={t.langGroup} />
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <section className={`${s.hero} ${fine ? s.fine : ""}`} id="hero" ref={heroRef} onPointerMove={onHeroMove} onPointerLeave={onHeroLeave}>
          <div className={`${s.wrap} ${s.hgrid}`}>
            <div className={s.rise}>
              <span className={s.eyebrow}>{t.eyebrow}</span>
              <h1 className={s.h1}>{t.h1}</h1>
              <div className={s.motto}>
                <span className={s.metal} lang="la">Virtus et Potestas</span>
                <small>{t.mottoTr}</small>
              </div>
              <p className={s.lead}>{t.lead}</p>
              <div className={s.ctas}>
                <Link className={`${s.btn} ${s.gold} ${s.sheen}`} href={signinHref} prefetch={false} data-signin="hero">{t.cta1}</Link>
                <a className={`${s.btn} ${s.ghost}`} href="#explore">{t.cta2}</a>
              </div>
            </div>
            <div className={s.crestbox} ref={boxRef}>
              <div className={s.tilt} ref={tiltRef}>
                <div className={s.masked}>
                  <CrestImg alt={t.alt} lcp className={s.crestimg} sizes={HERO_SIZES} />
                </div>
                <div className={s.gloss} />
                <div className={s.shine} />
              </div>
            </div>
          </div>
          <div className={s.scrollhint} aria-hidden="true"><span>{t.scroll}</span><i /></div>
        </section>

        <section className={`${s.s} ${s.d1}`} id="explore" aria-labelledby="explore-h">
          <Orn />
          <div className={s.wrap}>
            <div className={`${s.sh} ${s.reveal}`} data-reveal="">
              <span className={s.eyebrow}>{t.exEyebrow}</span>
              <h2 className={s.h2} id="explore-h">{t.exTitle}</h2>
              <p>{t.exSub}</p>
            </div>
            <div className={s.ex}>
              <div className={`${s.exstage} ${s.reveal}`} data-reveal="">
                <div className={`${s.frame} ${s.corners}`}>
                  <div className={s.zoom} style={{ transformOrigin: `${el.x}% ${el.y}%`, ["--fx" as string]: `${el.x}%`, ["--fy" as string]: `${el.y}%` }}>
                    {/* Lazy, low priority, and only after the hero has loaded: never a second download before the LCP. */}
                    {late ? <CrestImg alt={t.altEx} sizes="(max-width: 900px) 92vw, 540px" /> : <div className={s.zoomPh} />}
                    <div className={s.dim} />
                    <div className={s.halo} style={{ left: `${el.x}%`, top: `${el.y}%` }} />
                    {/* Pointer shortcut only: the tabs carry keyboard and screen-reader access, so the points stay out
                        of the tab order and the accessibility tree (the explorer's rule since cycle 8). */}
                    <div aria-hidden="true">
                      {elements.map((x, i) => (
                        <button key={x.id} type="button" tabIndex={-1} className={`${s.hot} ${i === act ? s.on : ""}`} style={{ left: `${x.x}%`, top: `${x.y}%` }} onClick={() => pick(i)} data-hot={x.id}>
                          <i />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className={s.reveal} data-reveal="">
                <div className={s.tabs} role="tablist" aria-label={t.exTabs}>
                  {elements.map((x, i) => (
                    <button key={x.id} ref={(node) => { tabRefs.current[i] = node; }} type="button" role="tab" id={`tab-${x.id}`} aria-selected={i === act} aria-controls="crest-panel" tabIndex={i === act ? 0 : -1} className={s.tab} onClick={() => pick(i)} onKeyDown={(e) => onTabKey(e, i)}>
                      {x.label}
                    </button>
                  ))}
                </div>
                <div className={`${s.panel} ${s.corners}`} role="tabpanel" id="crest-panel" aria-labelledby={`tab-${el.id}`} tabIndex={0}>
                  <div className={s.fade} key={el.id}>
                    <div className={s.k}><b>{el.roman}</b> · {elements[n - 1].roman}</div>
                    <h3>{el.label}</h3>
                    <p>{latinMotto(el.desc)}</p>
                    <div className={s.pnav}>
                      <button type="button" onClick={() => pick((act + n - 1) % n, true)}>{t.prev}</button>
                      <button type="button" onClick={() => pick((act + 1) % n, true)}>{t.next}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${s.s} ${s.d0}`} id="colours" aria-labelledby="colours-h">
          <Orn />
          <div className={s.wrap}>
            <div className={`${s.sh} ${s.reveal}`} data-reveal="">
              <span className={s.eyebrow}>{t.colEyebrow}</span>
              <h2 className={s.h2} id="colours-h">{t.colTitle}</h2>
            </div>
            <ul className={s.cols}>
              {colours.map((c) => (
                <li key={c.tincture} className={`${s.col} ${s.reveal}`} data-reveal="">
                  <div className={`${s.sw} ${c.sheen ? s.sheen : ""}`} style={{ background: c.swatch }} aria-hidden="true" />
                  <div className={s.colt}><b>{c.name}</b><small lang="fr">{c.tincture}</small><p>{c.meaning}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${s.mottos} ${touch ? s.touch : ""}`} id="motto" ref={mottoRef} onPointerMove={onMottoMove} aria-label={t.nav.motto}>
          <div className={s.pattern}><Hatching /></div>
          <div className={`${s.wrap} ${s.reveal}`} data-reveal="">
            <span className={s.engr} lang="la">Virtus et Potestas</span>
            <div className={s.tr}>{t.mottoTr}</div>
            <div className={s.two}>
              <div className={s.corners}><b>{t.m1t}</b><p>{t.m1}</p></div>
              <div className={s.corners}><b>{t.m2t}</b><p>{t.m2}</p></div>
            </div>
          </div>
        </section>

        <section className={`${s.s} ${s.d1}`} id="faq" aria-labelledby="faq-h">
          <Orn />
          <div className={s.wrap}>
            <div className={`${s.sh} ${s.reveal}`} data-reveal="">
              <span className={s.eyebrow}>{t.faqEyebrow}</span>
              <h2 className={s.h2} id="faq-h">{t.faqTitle}</h2>
            </div>
            <div className={`${s.faq} ${s.reveal}`} data-reveal="">
              {faq.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary><span>{latinMotto(f.q)}</span></summary>
                  <p>{latinMotto(f.a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={`${s.s} ${s.d0}`} style={{ padding: "90px 0" }} aria-labelledby="fam-h">
          <Orn />
          <div className={s.wrap}>
            <div className={`${s.famcard} ${s.corners} ${s.reveal}`} data-reveal="">
              <div>
                <h2 id="fam-h">{t.famTitle}</h2>
                <p>{t.famText}</p>
                <ul>{t.fam.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <Link className={`${s.btn} ${s.gold} ${s.sheen}`} href={signinHref} prefetch={false} data-signin="family">{t.cta1}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.ft}`}>
          <Brand href="#main" label={t.brandHome} small />
          <span>{t.copy}</span>
          <nav className={s.ftlinks} aria-label={lang === "ru" ? "Ссылки в подвале" : "Footer links"}>
            <a href="#explore">{t.nav.explore}</a>
            <Link href={signinHref} prefetch={false}>{t.famEnter}</Link>
            <Link href={`/${other}`} prefetch={false} hrefLang={other} lang={other}>{t.otherLang}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
