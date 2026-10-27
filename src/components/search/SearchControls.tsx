"use client";

import {
  PLACE_CATEGORIES,
  SEARCH_RADII_KM,
  type PlaceCategoryId,
  type SearchRadiusKm,
} from "@/lib/search/categories";

type Props = {
  category: PlaceCategoryId;
  radiusKm: SearchRadiusKm;
  customKeyword: string;
  loading?: boolean;
  onCategoryChange: (id: PlaceCategoryId) => void;
  onRadiusChange: (km: SearchRadiusKm) => void;
  onCustomKeywordChange: (value: string) => void;
  onSearch: () => void;
  disabled?: boolean;
};

export function SearchControls({
  category,
  radiusKm,
  customKeyword,
  loading,
  onCategoryChange,
  onRadiusChange,
  onCustomKeywordChange,
  onSearch,
  disabled,
}: Props) {
  const customMissing = category === "custom" && !customKeyword.trim();

  return (
    <section aria-labelledby="search-heading" className="flex flex-col gap-3">
      <div>
        <h2
          id="search-heading"
          className="text-sm font-semibold tracking-wide text-[var(--ink)]"
        >
          Search
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Find OpenStreetMap places around the map center. Tap a result for
          Google hours, ratings, and reviews when configured.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="category"
            className="mb-1 block text-sm font-medium text-[var(--ink)]"
          >
            Category
          </label>
          <select
            id="category"
            className="field"
            value={category}
            onChange={(e) =>
              onCategoryChange(e.target.value as PlaceCategoryId)
            }
          >
            {PLACE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="radius"
            className="mb-1 block text-sm font-medium text-[var(--ink)]"
          >
            Radius
          </label>
          <select
            id="radius"
            className="field"
            value={radiusKm}
            onChange={(e) =>
              onRadiusChange(Number(e.target.value) as SearchRadiusKm)
            }
          >
            {SEARCH_RADII_KM.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </div>
      </div>

      {category === "custom" && (
        <div>
          <label
            htmlFor="custom-keyword"
            className="mb-1 block text-sm font-medium text-[var(--ink)]"
          >
            Custom keyword
          </label>
          <input
            id="custom-keyword"
            type="text"
            className="field"
            value={customKeyword}
            onChange={(e) => onCustomKeywordChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !disabled && !loading && !customMissing) {
                e.preventDefault();
                onSearch();
              }
            }}
            placeholder="e.g. bakery, clinic…"
            autoComplete="off"
          />
        </div>
      )}

      <button
        type="button"
        className="btn-primary"
        disabled={disabled || loading || customMissing}
        onClick={onSearch}
      >
        {loading ? "Searching…" : "Search nearby"}
      </button>
      <p className="text-xs text-[var(--muted)]">
        Source: OpenStreetMap via Overpass. Google details use the official
        Places API only (no scraping).
      </p>
    </section>
  );
}
