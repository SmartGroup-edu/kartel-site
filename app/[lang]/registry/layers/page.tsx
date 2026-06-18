import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LayersDashboard from "../../../components/LayersDashboard";
import { layersContent } from "../../../content/layers";

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
  const c = layersContent[key.toUpperCase() as "EN" | "RU"];
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: `/${key}/registry/layers`,
      languages: { en: "/en/registry/layers", ru: "/ru/registry/layers" },
    },
  };
}

export default async function LayersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as Locale)) notFound();
  return <LayersDashboard lang={lang.toUpperCase() as "EN" | "RU"} />;
}
