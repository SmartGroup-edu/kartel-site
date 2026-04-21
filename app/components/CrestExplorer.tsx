"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";

interface HeraldicElement {
  id: string;
  labelEN: string;
  labelRU: string;
  descEN: string;
  descRU: string;
  // Position as percentage of image dimensions
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
    y: 5,
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
    y: 18,
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
    x: 50,
    y: 32,
    icon: "M12 2v16m-3-13l3-3 3 3m-6 10l3 3 3-3",
  },
  {
    id: "griffin",
    labelEN: "Griffin",
    labelRU: "Грифон",
    descEN:
      "At the heart of the shield walks a griffin — embodying superiority, protection, and foresight. Combining the lion and the eagle into one form, it unites earthly and celestial, tangible and intangible. Depicted in motion with head held high, the griffin never sleeps and is always ready to act, led by its heart and unwavering sense of duty.",
    descRU:
      "Сердце щита занимает шествующий грифон — олицетворение превосходства, защиты и дальновидности. Объединяя льва и орла, он сливает земное и небесное, осязаемое и бестелесное. Изображён в движении, с поднятой головой — тот, кто никогда не спит и готов действовать, ведомый сердцем и чувством долга.",
    x: 50,
    y: 50,
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
    y: 46,
    icon: "M7 2v20M5 4h4M5 8h4",
  },
  {
    id: "wings",
    labelEN: "Wings",
    labelRU: "Крылья",
    descEN:
      "Wings extend on either side of the shield, embodying silent and invisible divine protection — trust, inner composure, and a sense of belonging to something greater. They also allude to the elite Polish cavalry, conveying power, militancy, and readiness to act with lightning speed.",
    descRU:
      "Крылья по обеим сторонам щита воплощают безмолвное божественное покровительство — доверие, собранность и принадлежность к чему-то большему. Они также отсылают к элитной польской кавалерии, передавая смысл силы, воинственности и готовности молниеносно действовать.",
    x: 18,
    y: 42,
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
    y: 68,
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
    x: 50,
    y: 85,
    icon: "M4 19h16M6 15h12M8 11h8",
  },
];

interface CrestExplorerProps {
  lang: "EN" | "RU";
}

export default function CrestExplorer({ lang }: CrestExplorerProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);

  // Staggered hotspot reveal
  useEffect(() => {
    if (revealedCount >= ELEMENTS.length) return;
    const timer = setTimeout(() => setRevealedCount((c) => c + 1), 120);
    return () => clearTimeout(timer);
  }, [revealedCount]);

  const activeElement = ELEMENTS.find((el) => el.id === activeId) ?? null;

  const handleSelect = useCallback(
    (id: string) => {
      if (activeId === id) {
        setIsClosing(true);
        setTimeout(() => {
          setActiveId(null);
          setIsClosing(false);
        }, 200);
      } else {
        setIsClosing(false);
        setActiveId(id);
      }
    },
    [activeId]
  );

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setActiveId(null);
      setIsClosing(false);
    }, 200);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeId) handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, handleClose]);

  // Scroll description into view on mobile
  useEffect(() => {
    if (activeId && descRef.current) {
      const rect = descRef.current.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.7) {
        descRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeId]);

  const title = lang === "EN" ? "Explore the Coat of Arms" : "Исследуйте герб";
  const hint =
    lang === "EN"
      ? "Select an element to learn its meaning"
      : "Выберите элемент, чтобы узнать его значение";

  return (
    <div ref={containerRef} className="mx-auto max-w-5xl">
      <h3 className="mb-2 text-center font-serif text-[20px] tracking-wide text-[var(--accent)] sm:text-[24px] lg:text-[28px]">
        {title}
      </h3>
      <p className="mb-8 text-center text-[13px] text-[var(--muted)] sm:text-[14px]">
        {hint}
      </p>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Crest with hotspots */}
        <div className="relative mx-auto w-full max-w-[400px] lg:max-w-none">
          <Image
            src="/crest.jpeg"
            alt={
              lang === "EN"
                ? "Kartel family coat of arms — interactive explorer"
                : "Герб семьи Картель — интерактивный просмотр"
            }
            width={540}
            height={540}
            className="w-full rounded object-contain"
            sizes="(max-width: 640px) 85vw, (max-width: 1024px) 50vw, 400px"
          />

          {/* Hotspot dots overlay */}
          <div className="absolute inset-0" aria-hidden="true">
            {ELEMENTS.map((el, i) => (
              <button
                key={el.id}
                onClick={() => handleSelect(el.id)}
                className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-all duration-300 sm:h-8 sm:w-8 ${
                  i < revealedCount ? "scale-100 opacity-100" : "scale-0 opacity-0"
                } ${
                  activeId === el.id
                    ? "scale-125 border-[var(--accent)] bg-[var(--accent)] text-white shadow-lg"
                    : "border-[var(--accent)]/60 bg-[var(--background)]/80 text-[var(--accent)] shadow-md backdrop-blur-sm hover:scale-110 hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                }`}
                style={{ left: `${el.x}%`, top: `${el.y}%` }}
                aria-label={lang === "EN" ? el.labelEN : el.labelRU}
                aria-pressed={activeId === el.id}
              >
                <span className="text-[10px] font-bold sm:text-[11px]">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Element list + description panel */}
        <div className="flex flex-col gap-3">
          {/* Element buttons */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3" role="tablist" aria-label={title}>
            {ELEMENTS.map((el, i) => {
              const label = lang === "EN" ? el.labelEN : el.labelRU;
              const isActive = activeId === el.id;
              return (
                <button
                  key={el.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="crest-desc-panel"
                  onClick={() => handleSelect(el.id)}
                  className={`flex items-center gap-2 rounded border px-3 py-2.5 text-left text-[13px] transition-all duration-200 sm:px-4 sm:py-3 sm:text-[14px] ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--muted-light)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--muted-light)]/30 text-[var(--muted)]"
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
            aria-live="polite"
            className={`relative min-h-[120px] overflow-hidden rounded border border-[var(--border)] bg-[var(--surface)] transition-all duration-300 ${
              activeElement && !isClosing
                ? "opacity-100"
                : "opacity-0"
            }`}
          >
            {activeElement ? (
              <div className="p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-serif text-[18px] text-[var(--accent)] sm:text-[20px]">
                    {lang === "EN" ? activeElement.labelEN : activeElement.labelRU}
                  </h4>
                  <button
                    onClick={handleClose}
                    className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    aria-label={lang === "EN" ? "Close" : "Закрыть"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <p className="text-[14px] leading-[1.75] text-[var(--text-secondary)] sm:text-[15px]">
                  {lang === "EN" ? activeElement.descEN : activeElement.descRU}
                </p>
              </div>
            ) : (
              <div className="flex h-full min-h-[120px] items-center justify-center p-5">
                <p className="text-center text-[13px] italic text-[var(--muted-light)] sm:text-[14px]">
                  {hint}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
