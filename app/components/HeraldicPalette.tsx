"use client";

import { useState } from "react";

interface ColourPair {
  id: string;
  nameEN: string;
  nameRU: string;
  heraldEN: string;
  heraldRU: string;
  color: string;
  textColor: string;
  meaningEN: string;
  meaningRU: string;
}

const COLOURS: ColourPair[] = [
  {
    id: "or",
    nameEN: "Gold",
    nameRU: "Золото",
    heraldEN: "Or (Yellow)",
    heraldRU: "Золото (жёлтый)",
    color: "#c9964e",
    textColor: "#1a1816",
    meaningEN: "Nobility, wisdom, enlightenment, stability, greatness, loyalty, warmth, wealth",
    meaningRU: "Благородство, мудрость, просвещённость, стабильность, величие, верность, теплота, богатство",
  },
  {
    id: "sable",
    nameEN: "Sable",
    nameRU: "Чернь",
    heraldEN: "Sable (Black)",
    heraldRU: "Чернь (чёрный)",
    color: "#1a1816",
    textColor: "#e8e4dd",
    meaningEN: "Willpower, endurance, humility, discipline, composure under any circumstances",
    meaningRU: "Воля, стойкость, скромность, дисциплина, способность сохранять хладнокровие",
  },
  {
    id: "argent",
    nameEN: "Silver",
    nameRU: "Серебро",
    heraldEN: "Argent (White)",
    heraldRU: "Серебро (белый)",
    color: "#e8e4dd",
    textColor: "#1a1816",
    meaningEN: "Truth, virtue, sincerity, nobility, honour, openness, intuitive insight",
    meaningRU: "Истина, добродетель, искренность, благородство, честь, открытость, проницательность",
  },
  {
    id: "gules",
    nameEN: "Gules",
    nameRU: "Червлень",
    heraldEN: "Gules (Red)",
    heraldRU: "Червлень (красный)",
    color: "#8b2020",
    textColor: "#e8e4dd",
    meaningEN: "Courage, determination, passion, love, bravery, sacrifice, leadership, strength of spirit",
    meaningRU: "Отвага, решительность, страсть, любовь, мужество, жертвенность, лидерство, сила духа",
  },
];

interface HeraldicPaletteProps {
  lang: "EN" | "RU";
}

export default function HeraldicPalette({ lang }: HeraldicPaletteProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const title = lang === "EN" ? "Heraldic Colours" : "Геральдические цвета";

  return (
    <div className="mx-auto max-w-3xl">
      <h3 className="mb-6 text-center font-serif text-[18px] tracking-wide text-[var(--accent)] sm:text-[22px] lg:text-[24px]">
        {title}
      </h3>

      {/* Colour pairs */}
      <div className="grid gap-4 sm:grid-cols-2">
        {COLOURS.map((c) => {
          const isActive = activeId === c.id;
          const name = lang === "EN" ? c.nameEN : c.nameRU;
          const heraldic = lang === "EN" ? c.heraldEN : c.heraldRU;
          const meaning = lang === "EN" ? c.meaningEN : c.meaningRU;

          return (
            <button
              key={c.id}
              onClick={() => setActiveId(isActive ? null : c.id)}
              aria-expanded={isActive}
              className="group overflow-hidden rounded border border-[var(--border)] text-left transition-all duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {/* Colour swatch */}
              <div
                className="flex items-center justify-between px-4 py-3 transition-transform duration-300 sm:px-5 sm:py-4"
                style={{ backgroundColor: c.color, color: c.textColor }}
              >
                <div>
                  <p className="font-serif text-[16px] sm:text-[18px]">{name}</p>
                  <p className="text-[11px] opacity-70 sm:text-[12px]">{heraldic}</p>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${isActive ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Meaning (expandable) */}
              <div
                className={`overflow-hidden bg-[var(--surface)] transition-all duration-300 ${
                  isActive ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="px-4 py-3 text-[13px] leading-[1.7] text-[var(--text-secondary)] sm:px-5 sm:text-[14px]">
                  {meaning}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Visual pairing indicators */}
      <div className="mt-6 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#c9964e" }} />
          <span className="text-[11px] text-[var(--muted)]">+</span>
          <span className="inline-block h-3 w-3 rounded-full border border-[var(--border)]" style={{ backgroundColor: "#1a1816" }} />
          <span className="ml-1 text-[11px] tracking-wide text-[var(--muted-light)]">
            {lang === "EN" ? "Light & Shadow" : "Свет и тень"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-[var(--border)]" style={{ backgroundColor: "#e8e4dd" }} />
          <span className="text-[11px] text-[var(--muted)]">+</span>
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#8b2020" }} />
          <span className="ml-1 text-[11px] tracking-wide text-[var(--muted-light)]">
            {lang === "EN" ? "Mind & Heart" : "Разум и сердце"}
          </span>
        </div>
      </div>
    </div>
  );
}
