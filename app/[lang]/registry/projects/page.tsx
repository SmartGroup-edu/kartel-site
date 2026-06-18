import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectsDirectory from "../../../components/ProjectsDirectory";
import { projectsContent } from "../../../content/projects";

const LOCALES = ["en", "ru"] as const;
type Locale = (typeof LOCALES)[number];

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const key = (LOCALES.includes(lang as Locale) ? lang : "en") as Locale;
  const c = projectsContent[key.toUpperCase() as "EN" | "RU"];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: `/${key}/registry/projects`,
      languages: { en: "/en/registry/projects", ru: "/ru/registry/projects" },
    },
  };
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  return <ProjectsDirectory lang={lang.toUpperCase() as "EN" | "RU"} />;
}
