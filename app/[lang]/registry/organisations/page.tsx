import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OrganisationsRegistry from "../../../components/OrganisationsRegistry";
import { organisationsContent } from "../../../content/organisations";

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
  const c = organisationsContent[key.toUpperCase() as "EN" | "RU"];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: `/${key}/registry/organisations`,
      languages: { en: "/en/registry/organisations", ru: "/ru/registry/organisations" },
    },
  };
}

export default async function OrganisationsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  return <OrganisationsRegistry lang={lang.toUpperCase() as "EN" | "RU"} />;
}
