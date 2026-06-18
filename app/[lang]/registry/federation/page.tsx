import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FederationMap from "../../../components/FederationMap";
import { federationContent } from "../../../content/federation";

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
  const c = federationContent[key.toUpperCase() as "EN" | "RU"];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: `/${key}/registry/federation`,
      languages: { en: "/en/registry/federation", ru: "/ru/registry/federation" },
    },
  };
}

export default async function FederationPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  return <FederationMap lang={lang.toUpperCase() as "EN" | "RU"} />;
}
