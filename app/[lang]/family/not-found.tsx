import { headers } from "next/headers";
import NotFoundView from "@/app/components/NotFoundView";
import { newRef, refLogLine } from "@/app/lib/family-ref.mjs";

// Family not-found (bus 97 item 6). A Server Component: it gets no params, so the edge gate forwards the
// language and a route class (no ids). The code is made here and written to the server log once, so the
// page and the log line always agree.
export default async function FamilyNotFound() {
  const h = await headers();
  const lang = h.get("x-kartel-locale") === "ru" ? "ru" : "en";
  const ref = newRef();
  console.warn(refLogLine("not-found", ref, h.get("x-family-route") ?? ""));
  return <NotFoundView lang={lang} refCode={ref} />;
}
