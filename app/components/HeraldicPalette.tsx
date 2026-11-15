"use client";

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
    // Argent toned down from near-white, which glared in dark mode (home cycle 1 #4).
    color: "#d9d6cf",
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

/** All four meanings shown open — they are short, and a click per card hid them (home cycle 1 #4). */
export default function HeraldicPalette({ lang }: HeraldicPaletteProps) {
  const title = lang === "EN" ? "Heraldic Colours" : "Геральдические цвета";

  return (
    <div className="mx-auto max-w-3xl">
      <h3 className="mb-6 text-center font-serif text-[22px] tracking-wide text-[var(--accent)] lg:text-[26px]">
        {title}
      </h3>

      <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2">
        {COLOURS.map((c) => {
          const name = lang === "EN" ? c.nameEN : c.nameRU;
          const heraldic = lang === "EN" ? c.heraldEN : c.heraldRU;
          const meaning = lang === "EN" ? c.meaningEN : c.meaningRU;
          return (
            <li key={c.id} className="flex h-full flex-col overflow-hidden rounded border border-[var(--border)]">
              <div className="px-4 py-3 sm:px-5 sm:py-4" style={{ backgroundColor: c.color, color: c.textColor }}>
                <p className="font-serif text-[18px] sm:text-[20px]">{name}</p>
                <p className="text-[14px]">{heraldic}</p>
              </div>
              <p className="flex-1 bg-[var(--surface)] px-4 py-4 text-[17px] leading-[1.6] text-[var(--text-body)] sm:px-5">
                {meaning}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Visual pairing indicators */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#c9964e" }} aria-hidden="true" />
          <span className="text-[14px] text-[var(--muted)]" aria-hidden="true">+</span>
          <span className="inline-block h-3 w-3 rounded-full border border-[var(--border)]" style={{ backgroundColor: "#1a1816" }} aria-hidden="true" />
          <span className="ml-1 text-[14px] tracking-wide text-[var(--muted-light)]">
            {lang === "EN" ? "Light & Shadow" : "Свет и тень"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-[var(--border)]" style={{ backgroundColor: "#d9d6cf" }} aria-hidden="true" />
          <span className="text-[14px] text-[var(--muted)]" aria-hidden="true">+</span>
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#8b2020" }} aria-hidden="true" />
          <span className="ml-1 text-[14px] tracking-wide text-[var(--muted-light)]">
            {lang === "EN" ? "Mind & Heart" : "Разум и сердце"}
          </span>
        </div>
      </div>
    </div>
  );
}
