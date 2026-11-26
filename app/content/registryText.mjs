// Project wording derived from the vendored registry (bus 168, C4).
// Plain .mjs so the TS pages and the node tests share it (tests must not import .ts).
// No Node built-ins: client components import the copy that uses it.

/** Project names in registry order. `which`: "all" | "active" (live projects, not retired). */
export function projectNames(registry, which = "all") {
  return registry.projects
    .filter((p) => which === "all" || (p.type === "project" && p.role !== "Retired"))
    .map((p) => p.name);
}

/** "A, B and C" / "A, B и C". */
export function listJoin(names, lang) {
  const and = lang === "RU" ? " и " : " and ";
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")}${and}${names.at(-1)}`;
}
