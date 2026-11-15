"use client";

import { useParams } from "next/navigation";
import NotFoundView from "../components/NotFoundView";

export default function NotFound() {
  const params = useParams<{ lang: string }>();
  return <NotFoundView lang={params?.lang === "ru" ? "ru" : "en"} />;
}
