"use client";

import { useState } from "react";

export default function FamilyClient() {
  const [lang, setLang] = useState<"EN" | "RU">("RU");

  const family = {
    EN: {
      title: "The Kartel Family",
      intro:
        "The Kartel family is presented here as a living line of continuity: a family joined by name, memory, responsibility, and the conscious preservation of legacy.",
      homeLabel: "Home",
      people: [
        { name: "Igor Gor Kartel", description: "Family representative in London." },
        { name: "Diana Kartel", description: "Member of the Kartel family." },
        { name: "Dominika Kartel", description: "Next generation." },
        { name: "Arina Kartel", description: "Next generation." },
        { name: "Igor Kaid Kartel", description: "Next generation." },
        { name: "Feliks Kartel", description: "Next generation." },
        { name: "Piotr Kartel", description: "Representative of the older generation of the Kartel family." },
        { name: "Valentina Kartel", description: "Representative of the older generation of the Kartel family." },
      ],
    },
    RU: {
      title: "Семья Картель",
      intro:
        "Семья Картель — это линия преемственности, объединённая именем, памятью и наследием.",
      homeLabel: "Главная",
      people: [
        { name: "Игорь Гор Картель", description: "Представитель семьи в Лондоне." },
        { name: "Диана Картель", description: "Член семьи Картель." },
        { name: "Доминика Картель", description: "Новое поколение." },
        { name: "Арина Картель", description: "Новое поколение." },
        { name: "Игорь Каид Картель", description: "Новое поколение." },
        { name: "Феликс Картель", description: "Новое поколение." },
        { name: "Петр Картель", description: "Представитель старшего поколения семьи Картель." },
        { name: "Валентина Картель", description: "Представительница старшего поколения семьи Картель." },
      ],
    },
  };

  const t = family[lang];

  return (
    <div className="min-h-screen bg-[#eeebe5] text-[#2b2824]">
      <header className="border-b border-[#d7d1c7] bg-[#eeebe5]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10 lg:py-5">
          <a
            href="/"
            className="text-[22px] tracking-[0.12em] text-[#9b723a] sm:text-[24px] lg:text-[28px]"
            style={{ fontFamily: "Georgia, Times New Roman, serif" }}
          >
            KARTEL
          </a>
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="/" className="text-xs text-[#786e5e] hover:text-[#9b723a] sm:text-sm">
              {t.homeLabel}
            </a>
            <button
              onClick={() => setLang(lang === "EN" ? "RU" : "EN")}
              className="text-xs tracking-[0.2em] text-[#9b723a] hover:opacity-80 sm:text-sm"
            >
              {lang === "EN" ? "RU" : "EN"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-20">
        <header className="border-b border-[#d7d1c7] pb-8">
          <div
            className="text-[28px] leading-[1.2] text-[#9b723a] sm:text-[36px] lg:text-[48px]"
            style={{ fontFamily: "Georgia, Times New Roman, serif" }}
          >
            {t.title}
          </div>
          <p className="mt-6 max-w-4xl text-[16px] leading-[1.8] text-[#3a3630] sm:text-[18px] lg:text-[19px]">
            {t.intro}
          </p>
        </header>

        <section className="py-10 lg:py-16">
          <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
            {t.people.map((p) => (
              <div key={p.name} className="border border-[#d7d1c7] bg-[#f4f1eb] p-5 sm:p-6">
                <h2
                  className="text-[20px] leading-[1.3] text-[#9b723a] sm:text-[22px] lg:text-[24px]"
                  style={{ fontFamily: "Georgia, Times New Roman, serif" }}
                >
                  {p.name}
                </h2>
                <p className="mt-3 text-[15px] leading-[1.8] text-[#3a3630] sm:text-[16px]">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}