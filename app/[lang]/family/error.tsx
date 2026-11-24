"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { H1, PROSE } from "@/app/lib/typeScale";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { RefCode } from "@/app/components/NotFoundView";
import { familyRefText } from "@/app/content/notFound";
import { newRef, refFromDigest, routeClass } from "@/app/lib/family-ref.mjs";

// Family OS error boundary (bus 97 item 6): «Код обращения» on the page. A server error's code is a prefix of
// Next's digest, which the server already logged with the error. A client error has no digest: we make a
// code and report it (code + route class only) so it also lands in the server log.
const RU = { heading: "Что-то пошло не так", cta: "Повторить" }, EN = { heading: "Something went wrong", cta: "Try again" };

export default function FamilyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ lang: string }>();
  const lang = params?.lang === "ru" ? "ru" : "en";
  const t = lang === "ru" ? RU : EN, f = familyRefText[lang];
  const router = useRouter();
  const pathname = usePathname();
  const digest = error instanceof Error ? error.digest : undefined;
  const [code, setCode] = useState<string | null>(() => refFromDigest(digest));

  useEffect(() => {
    if (code) return;
    const ref = newRef();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the code is made once, after mount, to keep SSR and hydration equal
    setCode(ref);
    fetch("/api/family-ref", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref, route: routeClass(pathname) }), credentials: "same-origin", keepalive: true }).catch(() => {});
  }, [code, pathname]);

  return (
    <>
      <SiteHeader lang={lang === "en" ? "EN" : "RU"} toggleLang={() => router.push(`/${lang === "en" ? "ru" : "en"}/family`)} />
      <main id="main" className="flex flex-1 flex-col items-center justify-center bg-[var(--background)] px-4 py-24 text-center">
        <h1 className={H1}>{t.heading}</h1>
        <p className={`mt-4 max-w-md ${PROSE}`}>{f.error}</p>
        {code && <RefCode label={f.code} code={code} />}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-[15px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">{t.cta}</button>
          <a href={`/${lang}/family/os`} className="inline-flex min-h-11 items-center rounded-md border border-[var(--accent)] px-5 text-[15px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">{f.home}</a>
        </div>
      </main>
      <SiteFooter copy="KARTEL" contactEmail={null} />
    </>
  );
}
