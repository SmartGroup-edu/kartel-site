"use client";

import { useState, useCallback } from "react";
import { H2 } from "../lib/typeScale";
import type { TreeNode } from "../content/family";
import type { PersonMedia } from "../lib/family-media";
import FamilyPortrait from "./FamilyPortrait";

interface FamilyTreeProps {
  lang: "EN" | "RU";
  /** Published portraits by node id (family editor); absent → monogram. */
  persons?: Record<string, PersonMedia>;
  /** Passed from the gated server page — never bundled into client JS (R0 2026-11-14). */
  nodes: TreeNode[];
}

const GENERATIONS = ["root", "founder", "ancestor", "grandparent", "elder", "current", "next"] as const;

/** The role every card on a level carries by default (EN data is singular, the level label plural).
 *  A card shows its role only when it says something else, e.g. a named function (cycle 11 #1). */
const GENERIC_ROLE: Record<TreeNode["generation"], { en: string; ru: string }> = {
  root: { en: "Root", ru: "Корни" },
  founder: { en: "Founder", ru: "Основатели" },
  ancestor: { en: "Ancestor", ru: "Прародители" },
  grandparent: { en: "Grandparent", ru: "Дедушки и бабушки" },
  elder: { en: "Elder generation", ru: "Старшее поколение" },
  current: { en: "Present generation", ru: "Настоящее поколение" },
  next: { en: "Next generation", ru: "Новое поколение" },
};

function distinctRole(node: TreeNode, lang: "EN" | "RU"): string | null {
  const role = lang === "EN" ? node.roleEN : node.roleRU;
  const generic = GENERIC_ROLE[node.generation][lang === "EN" ? "en" : "ru"];
  return role.trim().toLowerCase() === generic.toLowerCase() ? null : role;
}

const GEN_COLORS: Record<string, string> = {
  root: "var(--muted)",
  founder: "var(--muted)",
  ancestor: "var(--muted)",
  grandparent: "var(--muted)",
  elder: "var(--muted)",
  current: "var(--accent)",
  next: "var(--accent-hover, var(--accent))",
};

export default function FamilyTree({ lang, nodes: NODES, persons = {} }: FamilyTreeProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);

  const title = lang === "EN" ? "Family Tree" : "Родословное древо";
  const genLabels =
    lang === "EN"
      ? { root: "Roots", founder: "Founders", ancestor: "Ancestors", grandparent: "Grandparents", elder: "Elders", current: "Present generation", next: "Next generation" }
      : { root: "Корни", founder: "Основатели", ancestor: "Прародители", grandparent: "Дедушки и бабушки", elder: "Старшее поколение", current: "Настоящее поколение", next: "Новое поколение" };

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className={`mb-3 text-center ${H2}`}>
        {title}
      </h2>
      <p className="mb-8 text-center text-[14px] text-[var(--muted)]">
        {lang === "EN" ? "Seven generations united by name and legacy" : "Семь поколений, объединённые именем и наследием"}
      </p>

      {/* Desktop tree (cycle 3 #2): normal flow + CSS connectors, so every line is derived from the
          layout and holds at any width — no fixed coordinates. Hover compares node ids from the
          server props; no id literal is ever written into this client module. */}
      <div className="hidden md:block" role="group" aria-label={title}>
        <div className="mx-auto max-w-[800px]">
          {GENERATIONS.map((gen, i) => {
            const level = NODES.filter((n) => n.generation === gen);
            const card = (node: TreeNode) => (
              <TreeCard key={node.id} node={node} lang={lang} isHovered={hoveredId === node.id} onHover={handleHover} compact={gen === "next"} media={persons[node.id]} />
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
                  // w-fit + two 1fr columns: both columns take the wider card's width (capped by the
                  // card's max-width), so a couple is two equal cards around a centred connector.
                  <div className="mx-auto grid w-fit max-w-full grid-cols-[1fr_2.5rem_1fr] items-stretch">
                    <div className="flex">{card(level[0])}</div>
                    <div className="relative" aria-hidden="true">
                      <span data-tree-line="" className="absolute inset-x-0 top-1/2 h-px bg-[var(--border)]" />
                      {i < GENERATIONS.length - 1 && <span data-tree-line="" className="absolute bottom-0 left-1/2 top-1/2 w-px bg-[var(--border)]" />}
                    </div>
                    <div className="flex">{card(level[1])}</div>
                  </div>
                ) : level.length > 2 ? (
                  // Children: a bar from the first to the last card centre, a drop to each card. The bar sits
                  // 24px under the level label (mb-6), so no stub ever runs into it.
                  <div className="mx-auto grid w-fit max-w-full auto-cols-fr grid-flow-col">
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
            {/* Equal width for every card on a level (gated UI/UX audit 2026-11-14 #6). A couple is one
                paired card (cycle 11 #3): without connectors, two stacked cards read as unrelated. */}
            <div className="mx-auto grid w-full max-w-[20rem] gap-3">
              {(() => {
                const level = NODES.filter((n) => n.generation === gen);
                return level.length === 2 ? (
                  <CoupleCard key={level[0].id} nodes={[level[0], level[1]]} lang={lang} persons={persons} />
                ) : (
                  level.map((node) => (
                    <TreeCard key={node.id} node={node} lang={lang} isHovered={hoveredId === node.id} onHover={handleHover} compact={gen === "next"} media={persons[node.id]} />
                  ))
                );
              })()}
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
  media,
}: {
  node: TreeNode;
  lang: "EN" | "RU";
  isHovered: boolean;
  onHover: (id: string | null) => void;
  compact?: boolean;
  media?: PersonMedia;
}) {
  const name = lang === "EN" ? node.nameEN : node.nameRU;
  const role = distinctRole(node, lang);
  const accentColor = GEN_COLORS[node.generation];

  return (
    <div
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      // Plain content, not a control (cycle 8, axe): the card does nothing on activation, so it is
      // not a button and not in the tab order; screen readers read the name and role as text.
      data-tree-card=""
      className={`w-full rounded border text-center transition-all duration-200 ${
        compact ? "min-w-[140px] px-3 py-3 md:max-w-[11rem]" : "min-w-[180px] px-4 py-4 md:max-w-[18rem]"
      } ${
        isHovered
          ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-md"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="mb-2">
        <FamilyPortrait id={media?.portrait} name={name} alt={(lang === "EN" ? media?.altEN : media?.altRU) ?? ""} size={compact ? 80 : 96} mobileSize={80} />
      </div>
      <p
        className={`font-serif leading-tight transition-colors ${
          compact ? "text-[14px] sm:text-[15px]" : "text-[16px] sm:text-[18px]"
        }`}
        style={{ color: isHovered ? accentColor : "var(--foreground)" }}
      >
        {name}
      </p>
      {role && <p className="mt-1 text-[14px] text-[var(--muted)]">{role}</p>}
    </div>
  );
}

/** Mobile: a couple as one card — two names joined by "&" (read as "and"/«и»), one level. */
function CoupleCard({ nodes, lang, persons }: { nodes: [TreeNode, TreeNode]; lang: "EN" | "RU"; persons: Record<string, PersonMedia> }) {
  return (
    <div data-tree-card="" data-tree-couple="" className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-center">
      {nodes.map((node, i) => {
        const role = distinctRole(node, lang);
        return (
          <div key={node.id}>
            {i === 1 && (
              <div className="my-2 flex items-center gap-3 text-[var(--muted)]" aria-hidden="true">
                <span className="h-px flex-1 bg-[var(--border)]" />
                <span className="font-serif text-[16px]">&amp;</span>
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>
            )}
            {i === 1 && <span className="sr-only">{lang === "EN" ? "and" : "и"}</span>}
            <div className="mb-2"><FamilyPortrait id={persons[node.id]?.portrait} name={lang === "EN" ? node.nameEN : node.nameRU} alt={(lang === "EN" ? persons[node.id]?.altEN : persons[node.id]?.altRU) ?? ""} size={80} /></div>
            <p className="font-serif text-[16px] leading-tight text-[var(--foreground)] sm:text-[18px]">{lang === "EN" ? node.nameEN : node.nameRU}</p>
            {role && <p className="mt-1 text-[14px] text-[var(--muted)]">{role}</p>}
          </div>
        );
      })}
    </div>
  );
}
