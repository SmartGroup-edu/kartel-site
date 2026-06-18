import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CampusRegistry from "../../../components/CampusRegistry";
import { campusesContent } from "../../../content/campuses";

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
  const c = campusesContent[key.toUpperCase() as "EN" | "RU"];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: `/${key}/registry/campuses`,
      languages: { en: "/en/registry/campuses", ru: "/ru/registry/campuses" },
    },
  };
}

export default async function CampusesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  return <CampusRegistry lang={lang.toUpperCase() as "EN" | "RU"} />;
}
