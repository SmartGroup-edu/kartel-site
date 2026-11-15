import { Fragment, type ReactNode } from "react";

export const MOTTO = "Virtus et Potestas";

/**
 * Marks every occurrence of the Latin motto inside running text with lang="la", so screen readers
 * switch pronunciation for those three words and back (cycle 8 #2). Works on plain strings,
 * including ones already passed through noDashLineStart.
 */
export function latinMotto(text: string): ReactNode {
  if (!text.includes(MOTTO)) return text;
  const parts = text.split(MOTTO);
  return parts.map((p, i) => (
    <Fragment key={i}>
      {p}
      {i < parts.length - 1 && <span lang="la">{MOTTO}</span>}
    </Fragment>
  ));
}
