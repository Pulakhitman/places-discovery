"use client";

import { formatDistance, normalizeHttpUrl } from "@/lib/places/format";
import type { FieldCoverage, OsmPlace, PlacesSearchSuccess } from "@/lib/places/types";
import type { PlaceCategoryId, SearchRadiusKm } from "@/lib/search/categories";
import { CategoryIcon } from "@/lib/search/category-icons";
import { ResultsPlaceholders } from "./ResultsPlaceholders";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty"; meta: PlacesSearchSuccess["meta"] }
  | { status: "ok"; places: OsmPlace[]; coverage: FieldCoverage; meta: PlacesSearchSuccess["meta"] }
  | {
      status: "error" | "rate_limited";
      message: string;
      retryable: boolean;
      retryAfterSec?: number;
    };

type Props = {
  state: SearchState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRetry: () => void;
  category: PlaceCategoryId;
  radiusKm: SearchRadiusKm;
  customKeyword?: string;
  hasCenter: boolean;
  compareIds?: string[];
  onToggleCompare?: (id: string) => void;
  compareLimit?: number;
  /** True when filters removed every result but the search itself had hits. */
  filtersActive?: boolean;
  onClearFilters?: () => void;
};

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ResultsPanel({
  state,
  selectedId,
  onSelect,
  onRetry,
  category,
  radiusKm,
  customKeyword,
  hasCenter,
  compareIds = [],
  onToggleCompare,
  compareLimit = 3,
  filtersActive = false,
  onClearFilters,
}: Props) {
  if (state.status === "idle" || state.status === "loading") {
    return (
      <ResultsPlaceholders
        category={category}
        radiusKm={radiusKm}
        customKeyword={customKeyword}
        mode={state.status}
        hasCenter={hasCenter}
      />
    );
  }

  if (state.status === "error" || state.status === "rate_limited") {
    return (
      <section aria-labelledby="results-heading" className="flex flex-col gap-2">
        <h2
          id="results-heading"
          className="text-sm font-semibold tracking-wide text-[var(--ink)]"
        >
          Results
        </h2>
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            state.status === "rate_limited"
              ? "border-[var(--warn)] text-[var(--warn)]"
              : "border-[var(--danger)] text-[var(--danger)]"
          }`}
          role="alert"
        >
          {state.message}
          {state.retryAfterSec
            ? ` Try again in ~${state.retryAfterSec}s.`
            : ""}
          {state.retryable && (
            <>
              {" "}
              <button type="button" className="underline" onClick={onRetry}>
                Retry
              </button>
            </>
          )}
        </p>
      </section>
    );
  }

  if (state.status !== "ok" && state.status !== "empty") {
    return null;
  }

  const { meta } = state;
  const count = state.status === "ok" ? state.places.length : 0;
  const areaLabel =
    meta.mode === "area"
      ? "selected area"
      : `${meta.radiusKm ?? "?"} km radius`;

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-3">
      <header className="space-y-1">
        <h2
          id="results-heading"
          className="text-sm font-semibold tracking-wide text-[var(--ink)]"
        >
          {meta.categoryLabel} · {areaLabel} · {count} place
          {count === 1 ? "" : "s"}
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Searched {formatTime(meta.searchedAt)}
        </p>
      </header>

      {state.status === "empty" ? (
        <div className="space-y-2">
          <div
            className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-3"
            role="status"
          >
            <p className="text-sm font-medium text-[var(--ink)]">
              No OpenStreetMap places found
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {meta.mode === "area"
                ? "Nothing matched this category inside the selected area. Try a denser city/county, another category, or switch to radius search."
                : "Nothing matched this category in the current radius. Try a larger radius, another category, or pick a busier area on the map."}
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            Data: {meta.attribution} ({meta.license})
          </p>
        </div>
      ) : (
        <>
          {state.places.length === 0 && filtersActive ? (
            <p
              className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]"
              role="status"
            >
              No places match the current filters.{" "}
              {onClearFilters ? (
                <button
                  type="button"
                  className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
                  onClick={onClearFilters}
                >
                  Clear filters
                </button>
              ) : null}
            </p>
          ) : null}
          <ul className="list-none space-y-2" aria-label="Place results">
            {state.places.map((place) => {
              const active = place.id === selectedId;
              const inCompare = compareIds.includes(place.id);
              const compareFull =
                !inCompare && compareIds.length >= compareLimit;
              const siteHref = normalizeHttpUrl(place.website);
              return (
                <li key={place.id}>
                  <article
                    className={`rounded-lg border transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--surface-2)] shadow-sm"
                        : "border-[var(--line)] bg-[var(--surface)]"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] hover:bg-[var(--surface-2)]/80"
                      aria-pressed={active}
                      onClick={() => onSelect(place.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--ink)]">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--accent)] ring-1 ring-[var(--line)]"
                            aria-hidden
                          >
                            <CategoryIcon category={place.categoryId} />
                          </span>
                          <span
                            className={`truncate ${place.isUnnamed ? "italic text-[var(--muted)]" : ""}`}
                            title={place.name}
                          >
                            {place.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                          {formatDistance(place.distanceM)}
                        </span>
                      </div>
                      <p className="mt-1 pl-10 text-xs text-[var(--muted)]">
                        {place.categoryLabel}
                        {place.isUnnamed ? " · unnamed in OSM" : ""} · OSM
                      </p>
                      <p className="mt-1 pl-10 text-sm text-[var(--ink)]">
                        {place.address ?? (
                          <span className="text-[var(--muted)]">
                            Address not tagged in OSM
                          </span>
                        )}
                      </p>
                      <FieldChips place={place} />
                      <dl className="mt-2 grid gap-1 pl-10 text-xs text-[var(--muted)] sm:grid-cols-1">
                        <FieldRow
                          label="Hours"
                          value={place.hours}
                          empty="Not tagged"
                        />
                        <div>
                          <dt className="inline font-medium text-[var(--ink)]">
                            Website:{" "}
                          </dt>
                          <dd className="inline break-all">
                            {place.website ? (
                              siteHref ? (
                                <a
                                  href={siteHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--accent)] underline-offset-2 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {place.website}
                                </a>
                              ) : (
                                place.website
                              )
                            ) : (
                              "Not tagged"
                            )}
                          </dd>
                        </div>
                        <FieldRow
                          label="Phone"
                          value={place.phone}
                          empty="Not tagged"
                        />
                        <div>
                          <dt className="inline font-medium text-[var(--ink)]">
                            Rating / reviews:{" "}
                          </dt>
                          <dd className="inline">
                            Open details for Google (official API)
                          </dd>
                        </div>
                      </dl>
                    </button>
                    {onToggleCompare ? (
                      <div className="flex justify-end border-t border-[var(--line)] px-3 py-1.5">
                        <button
                          type="button"
                          className={`text-xs font-semibold underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-45 ${
                            inCompare
                              ? "text-[var(--accent)]"
                              : "text-[var(--muted)] hover:text-[var(--ink)]"
                          }`}
                          disabled={compareFull}
                          aria-pressed={inCompare}
                          onClick={() => onToggleCompare(place.id)}
                        >
                          {inCompare
                            ? "Remove from compare"
                            : compareFull
                              ? `Compare full (${compareLimit})`
                              : "Add to compare"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
          <div className="space-y-2 border-t border-[var(--line)] pt-2">
            <CoverageSummary coverage={state.coverage} />
            <p className="text-[11px] leading-relaxed text-[var(--muted)]">
              Coverage varies by area — empty fields mean missing OSM tags, not a
              broken search. Tap a result for Google hours, ratings, and reviews
              when configured. Exports never include Google data.
            </p>
            <p className="text-[11px] leading-relaxed text-[var(--muted)]">
              Data: {meta.attribution} ({meta.license})
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function FieldRow({
  label,
  value,
  empty,
}: {
  label: string;
  value?: string;
  empty: string;
}) {
  return (
    <div>
      <dt className="inline font-medium text-[var(--ink)]">{label}: </dt>
      <dd className="inline">{value ?? empty}</dd>
    </div>
  );
}

function FieldChips({ place }: { place: OsmPlace }) {
  const chips: { key: string; ok: boolean; label: string }[] = [
    { key: "addr", ok: Boolean(place.address), label: "Address" },
    { key: "hrs", ok: Boolean(place.hours), label: "Hours" },
    { key: "web", ok: Boolean(place.website), label: "Website" },
    { key: "tel", ok: Boolean(place.phone), label: "Phone" },
  ];
  const present = chips.filter((c) => c.ok).length;
  return (
    <ul
      className="mt-2 flex flex-wrap gap-1 pl-10"
      aria-label={`OSM fields: ${present} of ${chips.length} tagged`}
    >
      {chips.map((chip) => (
        <li
          key={chip.key}
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            chip.ok
              ? "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]"
              : "bg-[var(--surface-2)] text-[var(--muted)]"
          }`}
          title={chip.ok ? `${chip.label} tagged in OSM` : `${chip.label} not tagged`}
        >
          {chip.label}
          <span className="sr-only">
            {chip.ok ? " tagged" : " not tagged"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CoverageSummary({ coverage }: { coverage: FieldCoverage }) {
  if (coverage.total === 0) {
    return null;
  }

  const rows: { label: string; count: number; pct: number }[] = [
    { label: "Named", count: coverage.withNamed, pct: coverage.namedPct },
    { label: "Hours", count: coverage.withHours, pct: coverage.hoursPct },
    { label: "Website", count: coverage.withWebsite, pct: coverage.websitePct },
    { label: "Phone", count: coverage.withPhone, pct: coverage.phonePct },
    { label: "Address", count: coverage.withAddress, pct: coverage.addressPct },
  ];

  const contactSparse =
    coverage.hoursPct === 0 &&
    coverage.websitePct === 0 &&
    coverage.phonePct === 0 &&
    coverage.addressPct === 0;

  const mostlyUnnamed = coverage.namedPct > 0 && coverage.namedPct < 40;

  return (
    <details
      className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]"
      aria-label="OSM field coverage"
    >
      <summary className="cursor-pointer font-medium text-[var(--ink)]">
        OSM field coverage · {coverage.total} place
        {coverage.total === 1 ? "" : "s"}
      </summary>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-center justify-between gap-2">
              <span>{row.label}</span>
              <span className="tabular-nums text-[var(--ink)]">
                {row.count}/{coverage.total} · {row.pct}%
              </span>
            </div>
            <div
              className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]"
              aria-hidden
            >
              <div
                className={`h-full rounded-full ${
                  row.pct === 0 ? "bg-[var(--line)]" : "bg-[var(--accent)]"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed">
        {contactSparse
          ? "OpenStreetMap often lacks hours/phone/website/address here — that is missing tags, not a broken counter. Open a place for Google details when configured."
          : mostlyUnnamed
            ? "Many places lack a name tag (shown in italics). Filter to “Named only” if you need labeled results. Percentages are share of OSM places with that field."
            : "Percentages are share of OSM places with that tag. Ratings/reviews come from Google when you open a place — never scraped."}
      </p>
    </details>
  );
}

export type { SearchState };
