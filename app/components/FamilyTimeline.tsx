"use client";

import type { TimelineEvent } from "../content/family";
import { H2, H3 } from "../lib/typeScale";



interface FamilyTimelineProps {
  lang: "EN" | "RU";
  /** Passed from the gated server page — never bundled into client JS (R0 2026-11-14). */
  events: TimelineEvent[];
}

export default function FamilyTimeline({ lang, events: EVENTS }: FamilyTimelineProps) {
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

              {/* Description */}
              <p className="mt-2 text-[17px] leading-[1.65] text-[var(--text-secondary)] lg:text-[19px] lg:leading-[1.7]">
                {desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
