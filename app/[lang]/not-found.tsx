"use client";

import { useParams } from "next/navigation";
import CrestNotFound from "../components/crest/CrestNotFound";

// bus 176 P1 QA: the public 404 is the crest page directly — not NotFoundView, which would pull the cabinet/registry
// site header (and its registry menu labels) into the public [lang] bundle.
export default function NotFound() {
  const params = useParams<{ lang: string }>();
  return <CrestNotFound lang={params?.lang === "ru" ? "ru" : "en"} />;
}
