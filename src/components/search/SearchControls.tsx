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
  onCategoryChange: (id: PlaceCategoryId) => void;
  onRadiusChange: (km: SearchRadiusKm) => void;
  onSearch: () => void;
  disabled?: boolean;
};

export function SearchControls({
  category,
  radiusKm,
  onCategoryChange,
  onRadiusChange,
  onSearch,
  disabled,
}: Props) {
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
          Category and radius around the map center. Place discovery lands in a
          later step — this run is a shell only.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-[var(--ink)]">
            Category
          </label>
          <select
            id="category"
            className="field"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as PlaceCategoryId)}
          >
            {PLACE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="radius" className="mb-1 block text-sm font-medium text-[var(--ink)]">
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

      <button
        type="button"
        className="btn-primary"
        disabled={disabled}
        onClick={onSearch}
      >
        Search nearby (stub)
      </button>
      <p className="text-xs text-[var(--muted)]">
        TODO: Overpass + Google Places search in later steps. No scrapers.
      </p>
    </section>
  );
}
