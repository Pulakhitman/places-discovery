"use client";

import type { ResultFilters } from "@/lib/places/filters";
import { activeFilterCount, DEFAULT_RESULT_FILTERS } from "@/lib/places/filters";
import {
  PLACE_SORT_OPTIONS,
  type PlaceSortId,
} from "@/lib/places/sort";

type Props = {
  filters: ResultFilters;
  onChange: (next: ResultFilters) => void;
  sort: PlaceSortId;
  onSortChange: (sort: PlaceSortId) => void;
  totalCount: number;
  filteredCount: number;
};

const QUALITY_PRESET: ResultFilters = {
  namedOnly: true,
  hasAddress: true,
  hasHours: true,
  hasWebsite: true,
  hasPhone: true,
  maxDistanceM: null,
};

export function ResultFiltersBar({
  filters,
  onChange,
  sort,
  onSortChange,
  totalCount,
  filteredCount,
}: Props) {
  const active = activeFilterCount(filters);

  function toggle(key: keyof Omit<ResultFilters, "maxDistanceM">) {
    onChange({ ...filters, [key]: !filters[key] });
  }

  return (
    <section
      aria-labelledby="filters-heading"
      className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/50 px-3 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="filters-heading"
          className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
        >
          Filters & sort{active > 0 ? ` · ${active}` : ""}
        </h3>
        {active > 0 ? (
          <button
            type="button"
            className="text-xs font-medium text-[var(--accent)] underline-offset-2 hover:underline"
            onClick={() => onChange(DEFAULT_RESULT_FILTERS)}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label
          htmlFor="result-sort"
          className="text-xs font-medium text-[var(--ink)]"
        >
          Sort
        </label>
        <select
          id="result-sort"
          className="field !w-auto !py-1 !text-xs"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as PlaceSortId)}
        >
          {PLACE_SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="mt-3">
        <legend className="text-xs font-semibold text-[var(--ink)]">
          Result quality
        </legend>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
          Keep places with these fields. Google details are never exported.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-[var(--ink)]">
          <FilterCheck
            id="filter-named"
            label="Named"
            checked={filters.namedOnly}
            onChange={() => toggle("namedOnly")}
          />
          <FilterCheck
            id="filter-address"
            label="Has address"
            checked={filters.hasAddress}
            onChange={() => toggle("hasAddress")}
          />
          <FilterCheck
            id="filter-hours"
            label="Has hours"
            checked={filters.hasHours}
            onChange={() => toggle("hasHours")}
          />
          <FilterCheck
            id="filter-website"
            label="Has website"
            checked={filters.hasWebsite}
            onChange={() => toggle("hasWebsite")}
          />
          <FilterCheck
            id="filter-phone"
            label="Has phone"
            checked={filters.hasPhone}
            onChange={() => toggle("hasPhone")}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
            onClick={() => onChange(QUALITY_PRESET)}
          >
All fields preset
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
            onClick={() =>
              onChange({
                ...DEFAULT_RESULT_FILTERS,
                hasHours: true,
                hasWebsite: true,
              })
            }
          >
            Hours + website
          </button>
        </div>
      </fieldset>

      <div className="mt-3 flex items-center gap-2">
        <label
          htmlFor="filter-distance"
          className="text-xs font-medium text-[var(--ink)]"
        >
          Max distance
        </label>
        <select
          id="filter-distance"
          className="field !w-auto !py-1 !text-xs"
          value={filters.maxDistanceM ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              maxDistanceM: v === "" ? null : Number(v),
            });
          }}
        >
          <option value="">Any</option>
          <option value="500">500 m</option>
          <option value="1000">1 km</option>
          <option value="2000">2 km</option>
          <option value="5000">5 km</option>
          <option value="10000">10 km</option>
        </select>
      </div>

      <p className="mt-2 text-[11px] text-[var(--muted)]" role="status">
        Showing {filteredCount} of {totalCount} place
        {totalCount === 1 ? "" : "s"}
        {active > 0 ? " (quality filters on)" : ""}
      </p>
    </section>
  );
}

function FilterCheck({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-1.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}
