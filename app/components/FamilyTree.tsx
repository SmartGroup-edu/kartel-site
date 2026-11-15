"use client";

import { useState, useCallback } from "react";
import type { TreeNode } from "../content/family";

interface FamilyTreeProps {
  lang: "EN" | "RU";
  /** Passed from the gated server page — never bundled into client JS (R0 2026-11-14). */
  nodes: TreeNode[];
}

const GENERATIONS = ["root", "founder", "ancestor", "grandparent", "elder", "current", "next"] as const;

const GEN_COLORS: Record<string, string> = {
  root: "var(--muted)",
  founder: "var(--muted)",
  ancestor: "var(--muted)",
  grandparent: "var(--muted)",
  elder: "var(--muted)",
  current: "var(--accent)",
  next: "var(--accent-hover, var(--accent))",
};

export default function FamilyTree({ lang, nodes: NODES }: FamilyTreeProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);

  const title = lang === "EN" ? "Family Tree" : "Родословное древо";
  const genLabels =
    lang === "EN"
      ? { root: "Roots", founder: "Founders", ancestor: "Ancestors", grandparent: "Grandparents", elder: "Elders", current: "Present Generation", next: "Next Generation" }
      : { root: "Корни", founder: "Основатели", ancestor: "Прародители", grandparent: "Дедушки и бабушки", elder: "Старшее поколение", current: "Настоящее поколение", next: "Новое поколение" };

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="mb-3 text-center font-serif text-[28px] leading-[1.15] text-[var(--accent)] lg:text-[35px]">
        {title}
      </h2>
      <p className="mb-8 text-center text-[14px] text-[var(--muted)]">
        {lang === "EN" ? "Seven generations united by name and legacy" : "Семь поколений, объединённые именем и наследием"}
      </p>

      {/* Desktop tree (cycle 3 #2): normal flow + CSS connectors, so every line is derived from the
          layout and holds at any width — no fixed coordinates. Hover compares node ids from the
          server props; no id literal is ever written into this client module. */}
      <div className="hidden md:block" role="img" aria-label={title}>
        <div className="mx-auto max-w-[800px]">
          {GENERATIONS.map((gen, i) => {
            const level = NODES.filter((n) => n.generation === gen);
            const card = (node: TreeNode) => (
              <TreeCard key={node.id} node={node} lang={lang} isHovered={hoveredId === node.id} onHover={handleHover} compact={gen === "next"} />
            );
            return (
              <div key={gen} data-tree-level={gen}>
                {i > 0 && <div className="mx-auto mb-3 h-8 w-px bg-[var(--border)]" aria-hidden="true" />}
                <p
                  data-tree-label=""
                  className={`text-center text-[14px] font-medium uppercase tracking-[0.15em] text-[var(--muted-light)] ${level.length > 2 ? "mb-6" : "mb-3"}`}
                >
                  {genLabels[gen]}
                </p>
                {level.length === 2 ? (
                  // Couple: the connector column is the exact centre, so the line down to the next level meets it.
                  <div className="grid grid-cols-[1fr_2.5rem_1fr] items-stretch">
                    <div className="flex justify-end">{card(level[0])}</div>
                    <div className="relative" aria-hidden="true">
                      <span data-tree-line="" className="absolute inset-x-0 top-1/2 h-px bg-[var(--border)]" />
                      {i < GENERATIONS.length - 1 && <span data-tree-line="" className="absolute bottom-0 left-1/2 top-1/2 w-px bg-[var(--border)]" />}
                    </div>
                    <div className="flex justify-start">{card(level[1])}</div>
                  </div>
                ) : level.length > 2 ? (
                  // Children: a bar from the first to the last card centre, a drop to each card. The bar sits
                  // 24px under the level label (mb-6), so no stub ever runs into it.
                  <div className="flex justify-center">
                    {level.map((node, j) => (
                      <div key={node.id} className="relative flex px-2 pt-6">
                        <span
                          data-tree-line=""
                          aria-hidden="true"
                          className={`absolute top-0 h-px bg-[var(--border)] ${j === 0 ? "left-1/2" : "left-0"} ${j === level.length - 1 ? "right-1/2" : "right-0"}`}
                        />
                        <span data-tree-line="" aria-hidden="true" className="absolute left-1/2 top-0 h-6 w-px bg-[var(--border)]" />
                        {card(node)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-center">{level.map(card)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile tree — stacked vertical */}
      <div className="block md:hidden" role="list" aria-label={title}>
        {GENERATIONS.map((gen) => (
          <div key={gen} className="mb-6 last:mb-0" role="listitem">
            <p className="mb-3 text-center text-[14px] font-medium uppercase tracking-[0.15em] text-[var(--muted-light)]">
              {genLabels[gen]}
            </p>
            {/* Equal width for every card on a level (gated UI/UX audit 2026-11-14 #6). */}
            <div className="mx-auto grid w-full max-w-[20rem] gap-3">
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
        className="mt-1 text-[14px] text-[var(--muted)]"
      >
        {role}
      </p>
    </div>
  );
}
