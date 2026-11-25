import type { Metadata } from "next";
import FamilyNotFound from "../not-found";

// QA-156 M6/L7: the edge gate rewrites here, with a real 404, every refused family page (access, editor, the
// member-only sections for an owner who is not a member) and every family address that does not exist. It renders
// the family not-found page itself rather than calling notFound(): under [lang]/loading.tsx a notFound() streams
// after the shell, so the body had no page and the status fell back to 200.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "ru" ? "Страница не найдена · Семья" : "Page not found · Family", robots: { index: false, follow: false } };
}

export default function FamilyMissing() {
  return <FamilyNotFound />;
}
