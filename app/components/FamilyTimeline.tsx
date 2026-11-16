"use client";

import type { TimelineEvent } from "../content/family";
import { H2, H3 } from "../lib/typeScale";
import type { EventMedia } from "../lib/family-media";
import { formatDateRange } from "../lib/partial-date.mjs";
import { useState } from "react";
import ImageLightbox from "./ImageLightbox";

interface FamilyTimelineProps {
  lang: "EN" | "RU";
  /** Passed from the gated server page — never bundled into client JS (R0 2026-11-14). */
  events: TimelineEvent[];
  /** Published dates, places, professions, stories and photos from the family editor, by entry id. */
  details?: Record<string, EventMedia>;
}

export default function FamilyTimeline({ lang, events: EVENTS, details = {} }: FamilyTimelineProps) {
  const [zoomed, setZoomed] = useState<{ src: string; alt: string } | null>(null);
  const title = lang === "EN" ? "Family Chronicle" : "Семейная хроника";

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className={`mb-8 text-center lg:mb-10 ${H2}`}>
        {title}
      </h2>

      <div className="relative" role="list" aria-label={title}>
        {/* Vertical line */}
        <div
          className="absolute left-4 top-0 h-full w-px bg-[var(--border)] sm:left-6"
          aria-hidden="true"
        />

        {EVENTS.map((event, i) => {
          const year = lang === "EN" ? event.yearEN : event.yearRU;
          const eventTitle = lang === "EN" ? event.titleEN : event.titleRU;
          const desc = lang === "EN" ? event.descEN : event.descRU;
          const isLast = i === EVENTS.length - 1;

          return (
            <div
              key={event.id}
              role="listitem"
              className={`relative pl-12 sm:pl-16 ${isLast ? "" : "pb-8 sm:pb-10"}`}
            >
              {/* Timeline dot */}
              <div
                className="absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 border-[var(--accent)] bg-[var(--background)] sm:left-4.5 sm:h-3.5 sm:w-3.5"
                aria-hidden="true"
                style={{ left: "calc(1rem - 6px)", }}
              />

              {/* Date/era label */}
              <p className="text-[14px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">
                {year}
              </p>

              {/* Event title */}
              <h3 className={`mt-1 ${H3}`}>
                {eventTitle}
              </h3>

              {/* Facts line from the editor: dates · places · profession (only what was filled in). */}
              {(() => {
                const d = details[event.id];
                if (!d) return null;
                const facts = [formatDateRange(d.dateFrom, d.dateTo, lang), lang === "EN" ? d.placesEN : d.placesRU, lang === "EN" ? d.professionEN : d.professionRU].filter(Boolean);
                return facts.length ? <p data-facts="" className="mt-1 text-[15px] text-[var(--muted)]">{facts.join(" · ")}</p> : null;
              })()}

              {/* Description */}
              <p className="mt-2 text-[17px] leading-[1.65] text-[var(--text-secondary)] lg:text-[19px] lg:leading-[1.7]">
                {desc}
              </p>

              {/* Story and photos from the editor (plain text; a blank line starts a paragraph). */}
              {(() => {
                const d = details[event.id];
                if (!d) return null;
                const story = (lang === "EN" ? d.storyEN : d.storyRU).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
                return (
                  <>
                    {story.length > 0 && (
                      <div data-story="" className="mt-3 space-y-3 text-[17px] leading-[1.65] text-[var(--text-body)] lg:text-[19px] lg:leading-[1.7]">
                        {story.map((para, k) => <p key={k} className="whitespace-pre-line">{para}</p>)}
                      </div>
                    )}
                    {d.photos.length > 0 && (
                      <div data-photos="" className="mt-4 grid gap-3 sm:grid-cols-2">
                        {d.photos.map((ph) => {
                          const caption = lang === "EN" ? ph.captionEN : ph.captionRU;
                          const src = (w: number, f: string) => `/api/family-media/${ph.id}/${w}.${f}`;
                          return (
                            <figure key={ph.id} className="break-inside-avoid">
                              {/* The photo keeps its own shape (no forced aspect); tall photos are capped
                                  in height and shown whole. Click → the full image in the lightbox. */}
                              <button type="button" className="block max-w-full cursor-zoom-in rounded focus-visible:outline-2 focus-visible:outline-offset-2"
                                aria-label={lang === "EN" ? `Open photo${caption ? `: ${caption}` : ""}` : `Открыть фото${caption ? `: ${caption}` : ""}`}
                                onClick={() => setZoomed({ src: src(1280, "webp"), alt: caption || (lang === "EN" ? "Photo" : "Фото") })}>
                                <picture>
                                  <source type="image/avif" srcSet={`${src(640, "avif")} 640w, ${src(1280, "avif")} 1280w`} sizes="(min-width: 640px) 360px, 100vw" />
                                  <img src={src(640, "webp")} srcSet={`${src(640, "webp")} 640w, ${src(1280, "webp")} 1280w`} sizes="(min-width: 640px) 360px, 100vw"
                                    alt={caption} loading="lazy" decoding="async" data-photo=""
                                    className="h-auto max-h-[420px] w-auto max-w-full rounded border border-[var(--border)] object-contain" />
                                </picture>
                              </button>
                              {caption && <figcaption className="mt-1 text-[14px] text-[var(--muted)]">{caption}</figcaption>}
                            </figure>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Memorial (cycle 12 #1): set apart from the entry's paragraph — a quiet left rule, the
                  dates on one line with places muted, the burial line, the closing words in italic
                  serif. No icons or symbols. Text comes verbatim from the data fields. */}
              {event.memorial && (() => {
                const m = lang === "EN" ? event.memorial.en : event.memorial.ru;
                return (
                  <div data-memorial="" className="mt-5 border-l-2 border-[var(--border)] pl-4 text-[17px] leading-[1.6] lg:text-[19px]">
                    <p className="font-serif text-[var(--foreground)]">{m.name}:</p>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      {/* Each "date, place" stays whole; a narrow screen breaks only at the dash. */}
                      <span className="whitespace-nowrap">{m.born[0]}, <span className="text-[var(--muted)]">{m.born[1]}</span></span> —{" "}
                      <span className="whitespace-nowrap">{m.died[0]}, <span className="text-[var(--muted)]">{m.died[1]}</span>.</span>
                    </p>
                    <p className="mt-1 text-[var(--text-secondary)]">{m.burial}</p>
                    <p className="mt-3 font-serif italic text-[var(--foreground)]">{m.words}</p>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
      {zoomed && <ImageLightbox src={zoomed.src} alt={zoomed.alt} isOpen onClose={() => setZoomed(null)} />}
    </div>
  );
}
