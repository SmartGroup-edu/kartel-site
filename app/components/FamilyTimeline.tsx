"use client";

interface TimelineEvent {
  id: string;
  yearEN: string;
  yearRU: string;
  titleEN: string;
  titleRU: string;
  descEN: string;
  descRU: string;
}

const EVENTS: TimelineEvent[] = [
  {
    id: "origins",
    yearEN: "Origins",
    yearRU: "Истоки",
    titleEN: "The Kartel Name",
    titleRU: "Имя Картель",
    descEN: "The family name Kartel carries within it an echo of strength and unity — a name that became the foundation of identity and memory across generations.",
    descRU: "Фамилия Картель несёт в себе отголосок силы и единства — имя, ставшее основой идентичности и памяти на протяжении поколений.",
  },
  {
    id: "elders",
    yearEN: "Elder Generation",
    yearRU: "Старшее поколение",
    titleEN: "Piotr & Valentina Kartel",
    titleRU: "Пётр и Валентина Картель",
    descEN: "The elder generation laid the foundation of values, discipline, and faith that would define the family for decades to come.",
    descRU: "Старшее поколение заложило фундамент ценностей, дисциплины и веры, определивших семью на десятилетия вперёд.",
  },
  {
    id: "london",
    yearEN: "London",
    yearRU: "Лондон",
    titleEN: "A New Chapter in London",
    titleRU: "Новая глава в Лондоне",
    descEN: "The family established its presence in London — bringing heritage, ambition, and the conscious continuation of legacy to a new horizon.",
    descRU: "Семья обосновалась в Лондоне — привнеся наследие, амбиции и осознанное продолжение традиций на новый горизонт.",
  },
  {
    id: "present",
    yearEN: "Present",
    yearRU: "Настоящее",
    titleEN: "Igor Gor & Diana Kartel",
    titleRU: "Игорь Гор и Диана Картель",
    descEN: "The present generation carries forward the family name with purpose — building, creating, and preserving what matters most.",
    descRU: "Настоящее поколение продолжает семейное имя с целеустремлённостью — созидая, строя и сохраняя самое важное.",
  },
  {
    id: "next",
    yearEN: "Next Generation",
    yearRU: "Новое поколение",
    titleEN: "Dominika, Arina, Igor Kaid & Feliks",
    titleRU: "Доминика, Арина, Игорь Каид и Феликс",
    descEN: "The next generation — the living continuation of the Kartel legacy. Each carrying the name forward into a future yet to be written.",
    descRU: "Новое поколение — живое продолжение наследия Картель. Каждый несёт имя вперёд, в будущее, которое ещё предстоит написать.",
  },
  {
    id: "crest",
    yearEN: "The Coat of Arms",
    yearRU: "Герб",
    titleEN: "Virtus et Potestas",
    titleRU: "Virtus et Potestas",
    descEN: "The creation of the family coat of arms — a heraldic symbol uniting all generations under one motto: Strength and Power.",
    descRU: "Создание фамильного герба — геральдического символа, объединяющего все поколения под одним девизом: Сила и Власть.",
  },
];

interface FamilyTimelineProps {
  lang: "EN" | "RU";
}

export default function FamilyTimeline({ lang }: FamilyTimelineProps) {
  const title = lang === "EN" ? "Family Chronicle" : "Семейная хроника";

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-8 text-center font-serif text-[22px] tracking-wide text-[var(--accent)] sm:text-[28px] lg:mb-10 lg:text-[32px]">
        {title}
      </h2>

      <div className="relative" role="list" aria-label={title}>
        {/* Vertical line */}
        <div
          className="absolute left-4 top-0 h-full w-px bg-[var(--border)] sm:left-6"
          aria-hidden="true"
        />

        {EVENTS.map((event, i) => {
          const year = lang === "EN" ? event.yearEN : event.yearRU;
          const eventTitle = lang === "EN" ? event.titleEN : event.titleRU;
          const desc = lang === "EN" ? event.descEN : event.descRU;
          const isLast = i === EVENTS.length - 1;

          return (
            <div
              key={event.id}
              role="listitem"
              className={`relative pl-12 sm:pl-16 ${isLast ? "" : "pb-8 sm:pb-10"}`}
            >
              {/* Timeline dot */}
              <div
                className="absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 border-[var(--accent)] bg-[var(--background)] sm:left-4.5 sm:h-3.5 sm:w-3.5"
                aria-hidden="true"
                style={{ left: "calc(1rem - 6px)", }}
              />

              {/* Date/era label */}
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)] sm:text-[12px]">
                {year}
              </p>

              {/* Event title */}
              <h3 className="mt-1 font-serif text-[17px] text-[var(--foreground)] sm:text-[19px]">
                {eventTitle}
              </h3>

              {/* Description */}
              <p className="mt-2 text-[14px] leading-[1.7] text-[var(--text-secondary)] sm:text-[15px]">
                {desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
