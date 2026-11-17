import Link from "next/link";
import { familySubNav, familySubNavLabel } from "../lib/family-nav.mjs";

/** The family sub-navigation, same place on every family page (directly under the site header). */
export default function FamilySubNav({ lang, admin, os, active }: { lang: "EN" | "RU"; admin: boolean; os: boolean; active: "heritage" | "today" | "people" | "access" | "admin" }) {
  const items = familySubNav({ lang, admin, os });
  if (items.length === 0) return null;
  return (
    <nav aria-label={familySubNavLabel(lang)} data-family-subnav="" className="-mt-4 mb-8 border-b border-[var(--border)] sm:-mt-6 lg:-mt-12">
      <ul className="-mb-px flex flex-wrap gap-x-6 text-[16px]">
        {items.map((x) => (
          <li key={x.id}>
            <Link href={x.href} aria-current={x.id === active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 ${x.id === active ? "border-[var(--accent)] font-medium text-[var(--foreground)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]"}`}>
              {x.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
