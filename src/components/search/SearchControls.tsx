"use client";

import {
  MAX_AREA_SPAN_KM,
  PLACE_CATEGORIES,
  SEARCH_MODES,
  SEARCH_RADII_KM,
  type PlaceCategoryId,
  type SearchMode,
  type SearchRadiusKm,
} from "@/lib/search/categories";

type Props = {
  category: PlaceCategoryId;
  searchMode: SearchMode;
  radiusKm: SearchRadiusKm;
  customKeyword: string;
  areaLabel: string | null;
  hasAreaBBox: boolean;
  areaTooLarge: boolean;
  loading?: boolean;
  onCategoryChange: (id: PlaceCategoryId) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onRadiusChange: (km: SearchRadiusKm) => void;
  onCustomKeywordChange: (value: string) => void;
  onSearch: () => void;
  disabled?: boolean;
};

export function SearchControls({
  category,
  searchMode,
  radiusKm,
  customKeyword,
  areaLabel,
  hasAreaBBox,
  areaTooLarge,
  loading,
  onCategoryChange,
  onSearchModeChange,
  onRadiusChange,
  onCustomKeywordChange,
  onSearch,
  disabled,
}: Props) {
  const customMissing = category === "custom" && !customKeyword.trim();
  const areaBlocked =
    searchMode === "area" && (!hasAreaBBox || areaTooLarge);
  const searchDisabled = Boolean(
    disabled || loading || customMissing || areaBlocked,
  );

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
          Find OpenStreetMap places by radius around the map pin, or inside the
          area you selected above. Tap a result for Google hours, ratings, and
          reviews when configured.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-[var(--ink)]">
          Search by
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SEARCH_MODES.map((mode) => (
            <label
              key={mode.id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                searchMode === mode.id
                  ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]"
                  : "border-[var(--line)] bg-[var(--surface)]"
              }`}
            >
              <input
                type="radio"
                name="search-mode"
                className="mt-0.5"
                checked={searchMode === mode.id}
                onChange={() => onSearchModeChange(mode.id)}
              />
              <span>
                <span className="font-medium text-[var(--ink)]">
                  {mode.label}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {mode.id === "radius"
                    ? "Circle around the teal pin"
                    : "Bounding box of the selected city/county/region"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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

        {searchMode === "radius" ? (
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
        ) : (
          <div>
            <p className="mb-1 text-sm font-medium text-[var(--ink)]">
              Selected area
            </p>
            <p
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]"
              role="status"
            >
              {!hasAreaBBox
                ? "No searchable map box yet — select a country, region, county, or city above. Local lists get an approximate box; Nominatim fills a tighter one when available."
                : areaTooLarge
                  ? `Area is too large for Overpass (max ~${MAX_AREA_SPAN_KM} km on a side). Pick a smaller city/county, or use radius search.`
                  : areaLabel
                    ? areaLabel
                    : "Area ready"}
            </p>
          </div>
        )}
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
              if (e.key === "Enter" && !searchDisabled) {
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
        disabled={searchDisabled}
        onClick={onSearch}
        aria-describedby="search-hint"
      >
        {loading
          ? "Searching…"
          : searchMode === "area"
            ? "Search selected area"
            : "Search nearby"}
      </button>
      {searchDisabled && !loading ? (
        <p className="text-xs text-[var(--warn)]" role="status">
          {customMissing
            ? "Enter a custom keyword before searching."
            : searchMode === "area" && !hasAreaBBox
              ? "Select a country/region/county/city above so the map has a searchable area."
              : searchMode === "area" && areaTooLarge
                ? `Pick a smaller area (max ~${MAX_AREA_SPAN_KM} km on a side) or use radius search.`
                : disabled
                  ? "Set a map center (pick an area or tap the map) before searching."
                  : null}
        </p>
      ) : null}
      <p id="search-hint" className="text-xs text-[var(--muted)]">
        Source: OpenStreetMap via Overpass. Google details use the official
        Places API only (no scraping).
      </p>
    </section>
  );
}
