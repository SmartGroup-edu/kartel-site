"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { latinMotto } from "../lib/latin";
import { H3 } from "../lib/typeScale";
import Image from "next/image";
import { noDashLineStart } from "../lib/typography";

interface HeraldicElement {
  id: string;
  labelEN: string;
  labelRU: string;
  descEN: string;
  descRU: string;
  // Position as % of crest.jpeg (900×1000), verified on a 10% grid 2026-11-15 (motto on the ribbon's left tail, 28/72: the centre of the ribbon is all lettering — checked on a 1% grid). The image renders
  // at its natural aspect (no crop), so the percentages map 1:1.
  x: number;
  y: number;
  // Icon SVG path
  icon: string;
}

const ELEMENTS: HeraldicElement[] = [
  {
    id: "coronet",
    labelEN: "Coronet",
    labelRU: "Корона",
    descEN:
      "The coronet crowns the composition, pointing the way upward — toward the heights a person can reach through actions and faith. Not a mark of birthright, but a sign of the true qualities of a ruler: wisdom, justice, willpower, and faith in destiny. Authority granted not by blood, but by merit.",
    descRU:
      "Корона венчает композицию, задавая направление — к вершинам, которых человек способен достичь своими поступками и верой. Это не признак происхождения, а знак качеств истинного правителя: мудрости, справедливости, силы воли и веры в предназначение. Власть, даруемая не по крови, а по достоинству.",
    x: 50,
    y: 29,
    icon: "M12 2l3 7h-6l3-7zm-8 7l2-4 2 4H4zm12 0l2-4 2 4h-4z",
  },
  {
    id: "fleurdelis",
    labelEN: "Fleur-de-lis",
    labelRU: "Лилии",
    descEN:
      "Three heraldic fleur-de-lis embody purity of intention and nobility of spirit. Elegant, restrained, and strict in form, they extend the symbolism of the coronet from the side of moral virtues — a reminder that the summit belongs to those who demand the most from themselves.",
    descRU:
      "Три геральдические лилии воплощают чистоту помыслов и возвышенность духа. Изящные и строгие по форме, они продолжают образ короны со стороны нравственных добродетелей — напоминание о том, что вершина принадлежит тем, кто предъявляет самые высокие требования прежде всего к себе.",
    x: 50,
    y: 19,
    icon: "M12 2C12 2 8 8 8 12c0 2.2 1.8 4 4 4s4-1.8 4-4c0-4-4-10-4-10z",
  },
  {
    id: "swords",
    labelEN: "Swords",
    labelRU: "Мечи",
    descEN:
      "Two symmetrical swords rise behind the shield with blades pointing upward, symbolising readiness to stand between danger and what is dear. They express the right to act — when action becomes the only possible answer. This right is passed down as part of the family heritage.",
    descRU:
      "Два симметричных меча за щитом, клинки направлены вверх — готовность встать между опасностью и тем, что дорого. Мечи выражают право на действие, когда поступок становится единственным возможным ответом. Это право передается дальше как часть семейного наследия.",
    x: 22,
    y: 57,
    icon: "M12 2v16m-3-13l3-3 3 3m-6 10l3 3 3-3",
  },
  {
    id: "griffin",
    labelEN: "Griffin",
    labelRU: "Грифон",
    descEN:
      "At the heart of the shield walks a griffin — embodying strength, protection, and foresight. Combining the lion and the eagle into one form, it unites earthly and celestial, tangible and intangible. Depicted in motion with head held high, the griffin never sleeps and is always ready to act, led by its heart and unwavering sense of duty.",
    descRU:
      "Сердце щита занимает шествующий грифон — олицетворение силы, защиты и дальновидности. Объединяя льва и орла, он сливает земное и небесное, осязаемое и бестелесное. Изображён в движении, с поднятой головой — тот, кто никогда не спит и готов действовать, ведомый сердцем и чувством долга.",
    x: 47,
    y: 55,
    icon: "M12 4a4 4 0 014 4v2a2 2 0 01-2 2h-4a2 2 0 01-2-2V8a4 4 0 014-4zm-3 14l3-2 3 2v2H9v-2z",
  },
  {
    id: "staff",
    labelEN: "Staff",
    labelRU: "Жезл",
    descEN:
      "In its raised paw, the griffin holds a staff reminiscent of a shepherd's crook — alluding to Christian faith and spiritual authority. Not dominion, but service: to principles, beliefs, values, God, and one's calling. The attribute of those who bear responsibility and guide others beside them.",
    descRU:
      "В поднятой лапе грифона — жезл, близкий по форме к посоху пастыря. Он отсылает к христианской вере и духовной власти, указывающей не на господство, а на служение — принципам, убеждениям, ценностям, Богу и своему предназначению. Атрибут тех, кто привык брать на себя ответственность.",
    x: 35,
    y: 42,
    icon: "M7 2v20M5 4h4M5 8h4",
  },
  {
    id: "wings",
    labelEN: "Wings",
    labelRU: "Крылья",
    descEN:
      "Wings extend on either side of the shield, embodying silent and invisible divine protection. They echo the heraldic tradition of the Eastern European lands of the family's ancestors — present-day Belarus, Ukraine and western Russia — and stand for freedom of spirit, courage and readiness to defend family, honour and heritage.",
    descRU:
      "Крылья по обеим сторонам щита воплощают безмолвное и незримое Божественное покровительство. Они перекликаются с геральдической традицией восточноевропейских земель, где жили предки семьи, — современной Беларуси, Украины и западных областей России — и олицетворяют свободу духа, мужество и готовность защитить семью, честь и наследие.",
    x: 20,
    y: 22,
    icon: "M2 12c3-6 8-8 10-8M22 12c-3-6-8-8-10-8",
  },
  {
    id: "keys",
    labelEN: "Crossed Keys",
    labelRU: "Ключи",
    descEN:
      "Two crossed keys at the base of the shield — a symbol of ecclesiastical authority rooted in the Apostle Peter, and a sign of deep knowledge. Their intersection forms a cross, affirming belief in one's own strength. A reminder that every person holds the keys to their own destiny.",
    descRU:
      "Два скрещённых ключа у основания щита — символ церковной власти, восходящий к апостолу Петру, и знак глубоких знаний. Их пересечение образует крест, утверждая веру в собственные силы. Напоминание о том, что каждый человек владеет ключами от собственной судьбы.",
    x: 50,
    y: 73,
    icon: "M8 11l-5 5m0 0l2 2m-2-2l-2 2m7-7l5-5m0 0l-2-2m2 2l2-2",
  },
  {
    id: "motto",
    labelEN: "Motto",
    labelRU: "Девиз",
    descEN:
      "'Virtus et Potestas' — Strength and Power. The core around which the entire image of the Kartel family is built. Strength is the ability to go all the way, following the call of the heart. Power is the measure of maturity, confidence, and acknowledgment of the heights attained. The motto awakens the inner will — to act decisively and live in accordance with what one believes is right.",
    descRU:
      "«Virtus et Potestas» — Сила и Власть. Стержень, вокруг которого выстраивается весь образ семьи Картель. Сила — это способность идти до конца, следуя зову сердца. Власть — мерило зрелости и признания достигнутых высот. Девиз призван пробуждать внутреннюю волю — действовать решительно и жить в соответствии с тем, что считаешь правильным.",
    x: 28,
    y: 72,
    icon: "M4 19h16M6 15h12M8 11h8",
  },
];

/** Marker positions (% of crest.jpeg) for reuse as crops — the Кодекс page thumbnails (bus 86). */
export const CREST_MARKERS: Record<string, { x: number; y: number; icon: string }> = Object.fromEntries(ELEMENTS.map((e) => [e.id, { x: e.x, y: e.y, icon: e.icon }]));

interface CrestExplorerProps {
  lang: "EN" | "RU";
}

export default function CrestExplorer({ lang }: CrestExplorerProps) {
  // WAI-ARIA tabs (UI/UX audit 2026-11-14 #6): one tab is always selected (first by default),
  // roving tabindex, ←/→/Home/End move the selection, the panel is labelled by its tab.
  const [activeId, setActiveId] = useState<string>(ELEMENTS[0].id);
  const [revealedCount, setRevealedCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const userChose = useRef(false);

  // Staggered hotspot reveal
  useEffect(() => {
    if (revealedCount >= ELEMENTS.length) return;
    const timer = setTimeout(() => setRevealedCount((c) => c + 1), 120);
    return () => clearTimeout(timer);
  }, [revealedCount]);

  const activeElement = ELEMENTS.find((el) => el.id === activeId) ?? ELEMENTS[0];

  const handleSelect = useCallback((id: string) => {
    userChose.current = true;
    setActiveId(id);
  }, []);

  // Deep links (cycle 10 #1): #explorer-<id> selects that element, brings the explorer into view
  // (instant under reduced motion) and puts focus on its tab. Works on load and on hashchange; the
  // Meaning essay's "See on the crest" links use it.
  useEffect(() => {
    const apply = () => {
      const m = /^#explorer-([a-z]+)$/.exec(window.location.hash);
      const i = m ? ELEMENTS.findIndex((el) => el.id === m[1]) : -1;
      if (i < 0) return;
      setActiveId(ELEMENTS[i].id);
      const section = document.getElementById("explorer");
      if (section) {
        // Explicit offset under the sticky header and section row (the global [id] scroll-margin is
        // shorter than that chrome on desktop).
        const chrome = Math.max(0, ...[...document.querySelectorAll("header, [data-section-nav]")].map((e) => e.getBoundingClientRect().bottom));
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top - chrome, behavior: reduce ? "auto" : "smooth" });
      }
      requestAnimationFrame(() => requestAnimationFrame(() => tabRefs.current[i]?.focus({ preventScroll: true })));
    };
    const onLoad = window.setTimeout(apply, 0);
    window.addEventListener("hashchange", apply);
    return () => {
      window.clearTimeout(onLoad);
      window.removeEventListener("hashchange", apply);
    };
  }, []);

  const onTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = ELEMENTS.length - 1;
    const next =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation(); // keep the page-level section keys (useSectionKeyboard) out of the tablist
    userChose.current = true;
    setActiveId(ELEMENTS[next].id);
    tabRefs.current[next]?.focus();
  }, []);

  // Keep the description in view after a choice (home cycle 1 #1): scroll only when the panel is
  // not fully visible below the sticky header; no smooth scrolling under reduced motion.
  useEffect(() => {
    if (!userChose.current || !descRef.current) return;
    const rect = descRef.current.getBoundingClientRect();
    // The mobile section row is absolutely positioned under the header, so measure its navs too.
    const chromeBottom = Math.max(0, ...[...document.querySelectorAll("header, [data-section-nav]")].map((e) => e.getBoundingClientRect().bottom));
    const visible = rect.top >= chromeBottom && rect.bottom <= window.innerHeight;
    if (!visible) {
      // Explicit offset rather than scroll-margin: the global [id] rule in globals.css outranks utilities.
      const delta = rect.top < chromeBottom ? rect.top - chromeBottom - 12 : rect.bottom - window.innerHeight + 12;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
    }
  }, [activeId]);

  const title = lang === "EN" ? "Explore the Coat of Arms" : "Исследуйте герб";
  const hint =
    lang === "EN"
      ? "Select an element to learn its meaning"
      : "Выберите элемент, чтобы узнать его значение";

  return (
    <div ref={containerRef} className="mx-auto max-w-5xl">
      <h3 className={`mb-2 text-center ${H3}`}>
        {title}
      </h3>
      <p className="mb-8 text-center text-[15px] text-[var(--muted)] print:hidden">
        {hint}
      </p>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1fr] lg:items-stretch">
        {/* Crest with hotspots */}
        {/* self-start: this box must stay exactly the image's size — the hotspot layer is
            inset-0, so a stretched box would shift every marker (seen in the 2026-11-15 visual pass). */}
        <div className="relative mx-auto w-full max-w-[400px] self-start lg:max-w-none short-land:max-w-[calc((100svh-5.5rem)*0.9)]">
          <Image
            src="/crest.jpeg"
            alt={
              lang === "EN"
                ? "Kartel family coat of arms — interactive explorer"
                : "Фамильный герб Картель — интерактивный просмотр"
            }
            width={900}
            height={1000}
            className="h-auto w-full rounded"
            sizes="(max-width: 640px) 85vw, (max-width: 1024px) 50vw, 520px"
          />

          {/* Hotspot dots overlay */}
          <div className="absolute inset-0" aria-hidden="true">
            {ELEMENTS.map((el, i) => (
              <button
                key={el.id}
                onClick={() => handleSelect(el.id)}
                // 24px markers (32px selected) so they cover less of the art; an invisible 40px hit area
                // keeps the target comfortable (design pass #9).
                // The art is the same in both themes, so the markers are too (cycle 9 #1): opaque
                // burgundy + 2px white ring + white numeral. The theme accent turned gold in dark
                // mode and vanished on the gold wings and coronet.
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#7b1e2d] text-white ring-2 ring-white transition-all duration-200 motion-reduce:transition-none after:absolute after:-inset-2 after:content-[''] ${
                  i < revealedCount ? "opacity-100" : "opacity-0"
                } ${
                  activeId === el.id
                    ? "h-8 w-8 shadow-lg"
                    : "h-6 w-6 shadow-md hover:scale-110"
                }`}
                style={{ left: `${el.x}%`, top: `${el.y}%` }}
                aria-label={lang === "EN" ? el.labelEN : el.labelRU}
                aria-pressed={activeId === el.id}
                // Pointer shortcut only: the layer is aria-hidden and the tabs carry keyboard and
                // screen-reader access, so the markers stay out of the tab order (cycle 8, axe).
                tabIndex={-1}
              >
                <span className="text-[12px] font-bold">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Element list + description panel */}
        <div className="flex flex-col gap-3">
          {/* Element buttons */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 print:hidden" role="tablist" aria-label={title}>
            {ELEMENTS.map((el, i) => {
              const label = lang === "EN" ? el.labelEN : el.labelRU;
              const isActive = activeId === el.id;
              return (
                <button
                  key={el.id}
                  ref={(node) => { tabRefs.current[i] = node; }}
                  id={`crest-tab-${el.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="crest-desc-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleSelect(el.id)}
                  onKeyDown={(e) => onTabKeyDown(e, i)}
                  // Three distinct states (design pass #8): hover = tint only; selected = burgundy
                  // border + tint; keyboard focus = ring.
                  className={`flex items-center gap-2 rounded border px-3 py-2.5 text-left text-[15px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:px-4 sm:py-3 ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--accent)]/5"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                      isActive
                        ? "bg-[var(--accent)] text-[var(--on-accent)]"
                        : "bg-[var(--background)] text-[var(--accent)] ring-1 ring-[var(--border)]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="font-medium">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Description panel */}
          <div
            id="crest-desc-panel"
            ref={descRef}
            role="tabpanel"
            aria-labelledby={`crest-tab-${activeElement.id}`}
            tabIndex={0}
            // Below 1024px the panel sits right under the art (before the tabs) — CSS order only, so
            // the DOM keeps tablist → tabpanel for assistive tech.
            className="relative min-h-[120px] overflow-hidden rounded border max-lg:order-first lg:flex-1 border-[var(--border)] bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <div className="p-5 sm:p-6">
              <h4 className="mb-3 font-serif text-[18px] text-[var(--accent)] sm:text-[20px]">
                {lang === "EN" ? activeElement.labelEN : activeElement.labelRU}
              </h4>
              <p className="text-[17px] leading-[1.65] text-[var(--text-body)] lg:text-[19px] lg:leading-[1.7]">
                {latinMotto(noDashLineStart(lang === "EN" ? activeElement.descEN : activeElement.descRU))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
