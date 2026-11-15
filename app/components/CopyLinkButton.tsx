"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** One "Copy link" control in place of the X/Telegram/WhatsApp bar (UI/UX audit 2026-11-14 #10).
 *  Uses the Clipboard API; the result is announced through an aria-live region. */
export default function CopyLinkButton({ url, lang }: { url: string; lang: "EN" | "RU" }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  }, [url]);

  const label = lang === "RU" ? "Скопировать ссылку" : "Copy link";
  const status =
    state === "copied" ? (lang === "RU" ? "Скопировано" : "Copied")
    : state === "failed" ? (lang === "RU" ? "Не удалось скопировать" : "Could not copy")
    : "";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border)] px-4 text-[15px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        {label}
      </button>
      <span aria-live="polite" className="min-h-[1.5em] text-[14px] text-[var(--text-secondary)]">
        {status}
      </span>
    </div>
  );
}
