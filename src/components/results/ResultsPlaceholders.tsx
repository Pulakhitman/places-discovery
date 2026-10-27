"use client";

import type { PlaceCategoryId, SearchRadiusKm } from "@/lib/search/categories";
import {
  buildResultPlaceholders,
  categorySearchBlurb,
} from "@/lib/search/placeholders";
import { categoryLabel } from "@/lib/search/overpass-queries";

type Props = {
  category: PlaceCategoryId;
  radiusKm: SearchRadiusKm;
  customKeyword?: string;
  mode: "idle" | "loading";
  hasCenter: boolean;
};

export function ResultsPlaceholders({
  category,
  radiusKm,
  customKeyword,
  mode,
  hasCenter,
}: Props) {
  const cards = buildResultPlaceholders(category, radiusKm, customKeyword);
  const label = categoryLabel(category);

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-3">
      <div>
        <h2
          id="results-heading"
          className="text-sm font-semibold tracking-wide text-[var(--ink)]"
        >
          {label} · {radiusKm} km · placeholders
        </h2>
        <p className="text-xs text-[var(--muted)]">
          {mode === "loading"
            ? `Searching OpenStreetMap for ${label.toLowerCase()} within ${radiusKm} km…`
            : categorySearchBlurb(category, radiusKm, customKeyword)}
        </p>
      </div>

      {!hasCenter && mode === "idle" && (
        <p
          className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]"
          role="status"
        >
          Set a map center (pick a country/area or tap the map), then search to
          replace these placeholders with real results.
        </p>
      )}

      {hasCenter && mode === "idle" && (
        <p className="text-xs text-[var(--muted)]" role="status">
          Press <span className="font-medium text-[var(--ink)]">Search nearby</span>{" "}
          to load real {label.toLowerCase()} within {radiusKm} km.
        </p>
      )}

      <ul
        className="flex flex-col gap-2"
        aria-hidden={mode === "loading" ? undefined : true}
        aria-label={
          mode === "loading"
            ? `Loading ${label} within ${radiusKm} km`
            : undefined
        }
      >
        {cards.map((card, index) => (
          <li
            key={`${card.title}-${index}`}
            className={`rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-2)]/70 px-3 py-2 ${
              mode === "loading" ? "animate-pulse" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-[var(--muted)]">{card.title}</span>
              <span className="shrink-0 text-xs text-[var(--muted)]">
                ~{radiusKm} km
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{card.subtitle}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{card.address}</p>
            <dl className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
              <div>
                <dt className="inline font-medium">Hours: </dt>
                <dd className="inline">{card.hours}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Website: </dt>
                <dd className="inline">{card.website}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Phone: </dt>
                <dd className="inline">{card.phone}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Rating / reviews: </dt>
                <dd className="inline">Not available from this source</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
