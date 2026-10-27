"use client";

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
};

function formatDistance(m: number): string {
  if (m < 1000) {
    return `${m} m`;
  }
  return `${(m / 1000).toFixed(1)} km`;
}

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

  return (
    <section aria-labelledby="results-heading" className="flex min-h-0 flex-col gap-3">
      <div>
        <h2
          id="results-heading"
          className="text-sm font-semibold tracking-wide text-[var(--ink)]"
        >
          {meta.categoryLabel} · {meta.radiusKm} km · {count} place
          {count === 1 ? "" : "s"}
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Searched {formatTime(meta.searchedAt)} · {meta.attribution} ({meta.license})
        </p>
      </div>

      {state.status === "empty" ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          No OpenStreetMap places found in this radius. Try a larger radius or
          another category.
        </p>
      ) : (
        <>
          <CoverageSummary coverage={state.coverage} />
          <ul
            className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1"
            aria-label="Place results"
          >
            {state.places.map((place) => {
              const active = place.id === selectedId;
              const inCompare = compareIds.includes(place.id);
              const compareFull =
                !inCompare && compareIds.length >= compareLimit;
              return (
                <li key={place.id}>
                  <div
                    className={`rounded-lg border transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--surface-2)]"
                        : "border-[var(--line)] bg-[var(--surface)]"
                    }`}
                  >
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-[var(--surface-2)]/80"
                    aria-pressed={active}
                    onClick={() => onSelect(place.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--ink)]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--accent)] ring-1 ring-[var(--line)]">
                          <CategoryIcon category={place.categoryId} />
                        </span>
                        <span
                          className={`truncate ${place.isUnnamed ? "italic text-[var(--muted)]" : ""}`}
                          title={place.name}
                        >
                          {place.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-[var(--muted)]">
                        {formatDistance(place.distanceM)}
                      </span>
                    </div>
                    <p className="mt-1 pl-10 text-xs text-[var(--muted)]">
                      {place.categoryLabel} · OSM
                    </p>
                    <p className="mt-1 pl-10 text-sm text-[var(--ink)]">
                      {place.address ?? (
                        <span className="text-[var(--muted)]">
                          Address not tagged
                        </span>
                      )}
                    </p>
                    <dl className="mt-2 grid gap-1 pl-10 text-xs text-[var(--muted)]">
                      <div>
                        <dt className="inline font-medium text-[var(--ink)]">
                          Hours:{" "}
                        </dt>
                        <dd className="inline">
                          {place.hours ?? "Not available from this source"}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium text-[var(--ink)]">
                          Website:{" "}
                        </dt>
                        <dd className="inline">
                          {place.website ? (
                            <a
                              href={place.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--accent)] underline-offset-2 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {place.website}
                            </a>
                          ) : (
                            "Not available from this source"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium text-[var(--ink)]">
                          Phone:{" "}
                        </dt>
                        <dd className="inline">
                          {place.phone ?? "Not available from this source"}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium text-[var(--ink)]">
                          Rating / reviews:{" "}
                        </dt>
                        <dd className="inline">
                          Select place for Google details
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
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-[var(--muted)]">
            Coverage varies by area. Data © OpenStreetMap contributors, ODbL.
            Tap a result for details; use Add to compare for side-by-side OSM
            fields. Exports never include Google data.
          </p>
        </>
      )}
    </section>
  );
}

function CoverageSummary({ coverage }: { coverage: FieldCoverage }) {
  if (coverage.total === 0) {
    return null;
  }
  return (
    <div
      className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]"
      aria-label="OSM field coverage"
    >
      <p className="font-medium text-[var(--ink)]">OSM field coverage</p>
      <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <li>Hours {coverage.hoursPct}%</li>
        <li>Website {coverage.websitePct}%</li>
        <li>Phone {coverage.phonePct}%</li>
        <li>Address {coverage.addressPct}%</li>
      </ul>
    </div>
  );
}

export type { SearchState };
