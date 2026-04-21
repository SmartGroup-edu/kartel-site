"use client";

import { useState, useCallback } from "react";

interface TreeNode {
  id: string;
  nameEN: string;
  nameRU: string;
  roleEN: string;
  roleRU: string;
  generation: "elder" | "current" | "next";
}

interface FamilyTreeProps {
  lang: "EN" | "RU";
}

const NODES: TreeNode[] = [
  { id: "piotr", nameEN: "Piotr Kartel", nameRU: "Петр Картель", roleEN: "Elder generation", roleRU: "Старшее поколение", generation: "elder" },
  { id: "valentina", nameEN: "Valentina Kartel", nameRU: "Валентина Картель", roleEN: "Elder generation", roleRU: "Старшее поколение", generation: "elder" },
  { id: "igor", nameEN: "Igor Gor Kartel", nameRU: "Игорь Гор Картель", roleEN: "Family representative, London", roleRU: "Представитель семьи, Лондон", generation: "current" },
  { id: "diana", nameEN: "Diana Kartel", nameRU: "Диана Картель", roleEN: "Present generation", roleRU: "Настоящее поколение", generation: "current" },
  { id: "dominika", nameEN: "Dominika Kartel", nameRU: "Доминика Картель", roleEN: "Next generation", roleRU: "Новое поколение", generation: "next" },
  { id: "arina", nameEN: "Arina Kartel", nameRU: "Арина Картель", roleEN: "Next generation", roleRU: "Новое поколение", generation: "next" },
  { id: "kaid", nameEN: "Igor Kaid Kartel", nameRU: "Игорь Каид Картель", roleEN: "Next generation", roleRU: "Новое поколение", generation: "next" },
  { id: "feliks", nameEN: "Feliks Kartel", nameRU: "Феликс Картель", roleEN: "Next generation", roleRU: "Новое поколение", generation: "next" },
];

const GEN_COLORS: Record<string, string> = {
  elder: "var(--muted)",
  current: "var(--accent)",
  next: "var(--accent-hover, var(--accent))",
};

export default function FamilyTree({ lang }: FamilyTreeProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);

  const title = lang === "EN" ? "Family Tree" : "Родословное древо";
  const genLabels =
    lang === "EN"
      ? { elder: "Elders", current: "Present Generation", next: "Next Generation" }
      : { elder: "Старшее поколение", current: "Настоящее поколение", next: "Новое поколение" };

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="mb-3 text-center font-serif text-[22px] tracking-wide text-[var(--accent)] sm:text-[28px] lg:text-[32px]">
        {title}
      </h2>
      <p className="mb-8 text-center text-[13px] text-[var(--muted)] sm:text-[14px]">
        {lang === "EN" ? "Three generations united by name and legacy" : "Три поколения, объединённые именем и наследием"}
      </p>

      {/* Desktop tree — SVG lines + positioned cards */}
      <div className="hidden md:block" role="img" aria-label={title}>
        <div className="relative mx-auto" style={{ maxWidth: 800 }}>
          {/* SVG connecting lines */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 800 520"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Elder couple connector */}
            <line x1="280" y1="55" x2="520" y2="55" stroke="var(--border)" strokeWidth="1.5" />

            {/* Elder → Current vertical */}
            <line x1="400" y1="55" x2="400" y2="160" stroke="var(--border)" strokeWidth="1.5" />

            {/* Current couple connector */}
            <line x1="280" y1="215" x2="520" y2="215" stroke="var(--border)" strokeWidth="1.5" />

            {/* Current → Next vertical */}
            <line x1="400" y1="215" x2="400" y2="320" stroke="var(--border)" strokeWidth="1.5" />

            {/* Next generation horizontal spread */}
            <line x1="100" y1="370" x2="700" y2="370" stroke="var(--border)" strokeWidth="1.5" />

            {/* Vertical drops to each next-gen node */}
            <line x1="100" y1="320" x2="100" y2="370" stroke="var(--border)" strokeWidth="1.5" />
            <line x1="300" y1="320" x2="300" y2="370" stroke="var(--border)" strokeWidth="1.5" />
            <line x1="500" y1="320" x2="500" y2="370" stroke="var(--border)" strokeWidth="1.5" />
            <line x1="700" y1="320" x2="700" y2="370" stroke="var(--border)" strokeWidth="1.5" />

            {/* Central vertical connector to next-gen spread */}
            <line x1="400" y1="320" x2="400" y2="370" stroke="var(--border)" strokeWidth="1.5" opacity="0" />
          </svg>

          {/* Generation labels */}
          <div className="relative" style={{ height: 520 }}>
            {/* Elder generation */}
            <div className="absolute" style={{ left: 0, top: 0, right: 0 }}>
              <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--muted-light)]">
                {genLabels.elder}
              </p>
              <div className="flex justify-center gap-10">
                <TreeCard
                  node={NODES[0]}
                  lang={lang}
                  isHovered={hoveredId === "piotr"}
                  onHover={handleHover}
                />
                <TreeCard
                  node={NODES[1]}
                  lang={lang}
                  isHovered={hoveredId === "valentina"}
                  onHover={handleHover}
                />
              </div>
            </div>

            {/* Current generation */}
            <div className="absolute" style={{ left: 0, top: 160, right: 0 }}>
              <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--muted-light)]">
                {genLabels.current}
              </p>
              <div className="flex justify-center gap-10">
                <TreeCard
                  node={NODES[2]}
                  lang={lang}
                  isHovered={hoveredId === "igor"}
                  onHover={handleHover}
                />
                <TreeCard
                  node={NODES[3]}
                  lang={lang}
                  isHovered={hoveredId === "diana"}
                  onHover={handleHover}
                />
              </div>
            </div>

            {/* Next generation */}
            <div className="absolute" style={{ left: 0, top: 320, right: 0 }}>
              <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--muted-light)]">
                {genLabels.next}
              </p>
              <div className="flex justify-center gap-4">
                {NODES.filter((n) => n.generation === "next").map((node) => (
                  <TreeCard
                    key={node.id}
                    node={node}
                    lang={lang}
                    isHovered={hoveredId === node.id}
                    onHover={handleHover}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile tree — stacked vertical */}
      <div className="block md:hidden" role="list" aria-label={title}>
        {(["elder", "current", "next"] as const).map((gen) => (
          <div key={gen} className="mb-6 last:mb-0" role="listitem">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--muted-light)]">
              {genLabels[gen]}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {NODES.filter((n) => n.generation === gen).map((node) => (
                <TreeCard
                  key={node.id}
                  node={node}
                  lang={lang}
                  isHovered={hoveredId === node.id}
                  onHover={handleHover}
                  compact={gen === "next"}
                />
              ))}
            </div>
            {gen !== "next" && (
              <div className="mx-auto my-4 h-8 w-px bg-[var(--border)]" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TreeCard({
  node,
  lang,
  isHovered,
  onHover,
  compact = false,
}: {
  node: TreeNode;
  lang: "EN" | "RU";
  isHovered: boolean;
  onHover: (id: string | null) => void;
  compact?: boolean;
}) {
  const name = lang === "EN" ? node.nameEN : node.nameRU;
  const role = lang === "EN" ? node.roleEN : node.roleRU;
  const accentColor = GEN_COLORS[node.generation];

  return (
    <div
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      tabIndex={0}
      role="button"
      aria-label={`${name} — ${role}`}
      className={`rounded border text-center transition-all duration-200 ${
        compact ? "min-w-[140px] px-3 py-3" : "min-w-[180px] px-4 py-4"
      } ${
        isHovered
          ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-md"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <p
        className={`font-serif leading-tight transition-colors ${
          compact ? "text-[14px] sm:text-[15px]" : "text-[16px] sm:text-[18px]"
        }`}
        style={{ color: isHovered ? accentColor : "var(--foreground)" }}
      >
        {name}
      </p>
      <p
        className={`mt-1 text-[var(--muted)] transition-opacity ${
          compact ? "text-[11px]" : "text-[12px]"
        } ${isHovered ? "opacity-100" : "opacity-70"}`}
      >
        {role}
      </p>
    </div>
  );
}
