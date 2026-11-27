"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

// bus 176 P1b: this boundary's chunk ships with every [lang] page, the crest home included — the 404 frame loads (and
// server-renders) only for a 404.
const CrestNotFound = dynamic(() => import("../components/crest/CrestNotFound"));

// bus 176 P1 QA: the public 404 is the crest page directly — not NotFoundView, which would pull the cabinet/registry
// site header (and its registry menu labels) into the public [lang] bundle.
export default function NotFound() {
  const params = useParams<{ lang: string }>();
  return <CrestNotFound lang={params?.lang === "ru" ? "ru" : "en"} />;
}
