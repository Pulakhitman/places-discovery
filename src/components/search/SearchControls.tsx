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
import { SEARCH_SOURCES, type SearchSource } from "@/lib/places/types";

type Props = {
  category: PlaceCategoryId;
  searchMode: SearchMode;
  radiusKm: SearchRadiusKm;
  customKeyword: string;
  areaLabel: string | null;
  hasAreaBBox: boolean;
  areaTooLarge: boolean;
  loading?: boolean;
  source: SearchSource;
  googleAvailable: boolean;
  onSourceChange: (source: SearchSource) => void;
  onCategoryChange: (id: PlaceCategoryId) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onRadiusChange: (km: SearchRadiusKm) => void;
  onCustomKeywordChange: (value: string) => void;
  onSearch: () => void;
  disabled?: boolean;
};

type TagTone = "accent" | "neutral" | "warn";

/** Sidebar copy per lane; which lanes exist (and their order) comes from SEARCH_SOURCES. */
const SOURCE_COPY: Record<
  SearchSource,
  { label: string; description: string; tag: string; tone: TagTone }
> = {
  osm: {
    label: "OpenStreetMap",
    description: "Open data via Overpass. Every match.",
    tag: "Exportable",
    tone: "accent",
  },
  google: {
    label: "Google",
    description: "Places API (New). Up to 20, uses quota.",
    tag: "View only",
    tone: "neutral",
  },
  both: {
    label: "Both",
    description: "Merged list; keeps matched OSM records.",
    tag: "Merged",
    tone: "neutral",
  },
};

const MODE_LABELS: Record<SearchMode, string> = {
  radius: "Around the pin",
  area: "Selected area",
};

const TAG_TONES: Record<TagTone, string> = {
  accent:
    "bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent)]",
  neutral: "bg-[var(--surface-2)] text-[var(--muted)]",
  warn: "bg-[color-mix(in_oklab,var(--warn)_12%,transparent)] text-[var(--warn)]",
};

/** Focus ring for labels wrapping a visually hidden radio. */
const SEGMENT_FOCUS =
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]";

/** Selection must not rely on color alone (forced-colors drops backgrounds). */
const SEGMENT_FORCED_SELECTED =
  "forced-colors:outline-2 forced-colors:-outline-offset-2";

const SOURCE_LOCKED_NOTE_ID = "search-source-locked";

export function SearchControls({
  category,
  searchMode,
  radiusKm,
  customKeyword,
  areaLabel,
  hasAreaBBox,
  areaTooLarge,
  loading,
  source,
  googleAvailable,
  onSourceChange,
  onCategoryChange,
  onSearchModeChange,
  onRadiusChange,
  onCustomKeywordChange,
  onSearch,
  disabled,
}: Props) {
  const usesGoogle = source !== "osm";
  const customMissing = category === "custom" && !customKeyword.trim();
  const blockedReason = customMissing
    ? "Type a keyword to search for."
    : usesGoogle && !googleAvailable
      ? "Google isn’t available on this server — choose OpenStreetMap."
      : searchMode === "area" && !hasAreaBBox
        ? "Pick an area above first, or search around the pin."
        : searchMode === "area" && areaTooLarge
          ? `Pick a smaller area (under ~${MAX_AREA_SPAN_KM} km across) or search around the pin.`
          : disabled
            ? "Tap the map or pick an area above to place the pin."
            : null;
  const searchDisabled = Boolean(loading || blockedReason);

  return (
    <section
      aria-labelledby="search-heading"
      className="@container flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="search-heading"
          className="text-sm font-semibold tracking-wide text-[var(--ink)]"
        >
          Search
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Find places around the map pin or inside the area you picked above.
        </p>
      </div>

      <div className="flex flex-col gap-3">
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

        {category === "custom" ? (
          <div>
            <label
              htmlFor="custom-keyword"
              className="mb-1 block text-sm font-medium text-[var(--ink)]"
            >
              Keyword
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
              placeholder="e.g. bakery, clinic, bike repair"
              autoComplete="off"
              enterKeyHint="search"
              aria-required="true"
              aria-describedby="custom-keyword-hint"
            />
            <p
              id="custom-keyword-hint"
              className="mt-1 text-xs text-[var(--muted)]"
            >
              Matches place names and types.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-sm font-medium text-[var(--ink)]">
            Where to search
          </legend>
          <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-1">
            {SEARCH_MODES.map((mode) => {
              const selected = searchMode === mode.id;
              return (
                <label
                  key={mode.id}
                  className={`relative flex min-h-9 cursor-pointer items-center justify-center rounded-md px-2 py-1.5 text-center text-sm font-medium transition-colors ${SEGMENT_FOCUS} ${
                    selected
                      ? `bg-[var(--surface)] text-[var(--ink)] shadow-sm ${SEGMENT_FORCED_SELECTED}`
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="search-mode"
                    value={mode.id}
                    className="sr-only"
                    checked={selected}
                    onChange={() => onSearchModeChange(mode.id)}
                  />
                  {MODE_LABELS[mode.id]}
                </label>
              );
            })}
          </div>
        </fieldset>

        {searchMode === "radius" ? (
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-medium text-[var(--muted)]">
              Radius around the teal map pin
            </legend>
            <div className="grid auto-cols-fr grid-flow-col gap-1">
              {SEARCH_RADII_KM.map((km) => {
                const selected = radiusKm === km;
                return (
                  <label
                    key={km}
                    className={`relative flex min-h-8 cursor-pointer items-center justify-center rounded-md border px-1 text-xs font-semibold tabular-nums whitespace-nowrap transition-colors ${SEGMENT_FOCUS} ${
                      selected
                        ? `border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,var(--surface))] text-[var(--accent)] ${SEGMENT_FORCED_SELECTED}`
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="search-radius"
                      value={km}
                      className="sr-only"
                      checked={selected}
                      onChange={() => onRadiusChange(km)}
                    />
                    {km} km
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <div
            role="status"
            className={`rounded-lg border px-3 py-2 text-sm ${
              !hasAreaBBox
                ? "border-dashed border-[var(--line)] text-[var(--muted)]"
                : areaTooLarge
                  ? "border-[color-mix(in_oklab,var(--warn)_40%,transparent)] bg-[color-mix(in_oklab,var(--warn)_8%,var(--surface))] text-[var(--warn)]"
                  : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)]"
            }`}
          >
            {!hasAreaBBox ? (
              "No area yet — pick a country, region, county, or city above."
            ) : areaTooLarge ? (
              `Too large to search — keep it under ~${MAX_AREA_SPAN_KM} km across.`
            ) : (
              <>
                <span className="block text-xs text-[var(--muted)]">
                  Searches inside
                </span>
                <span className="block font-medium break-words">
                  {areaLabel ?? "your selected area"}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-sm font-medium text-[var(--ink)]">
          Results from
        </legend>
        <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)] @xl:grid-cols-3">
          {SEARCH_SOURCES.map((option) => (
            <SourceOption
              key={option.id}
              id={option.id}
              checked={source === option.id}
              unavailable={option.id !== "osm" && !googleAvailable}
              onSelect={onSourceChange}
            />
          ))}
        </div>
        <div className="mt-1.5 flex flex-col gap-1 text-xs text-[var(--muted)]">
          {!googleAvailable ? (
            <p id={SOURCE_LOCKED_NOTE_ID}>
              Google and Both unlock once the server has GOOGLE_MAPS_API_KEY.
            </p>
          ) : searchMode === "area" && usesGoogle ? (
            <p>
              Google covers the area with a circle, so a few results may fall
              outside it.
            </p>
          ) : null}
          <p>Picks where results come from, not the map background.</p>
        </div>
      </fieldset>

      <div>
        <button
          type="button"
          className="btn-primary w-full gap-2"
          disabled={searchDisabled}
          onClick={onSearch}
          aria-describedby={blockedReason ? "search-blocked-reason" : undefined}
        >
          {loading ? (
            <>
              <span
                aria-hidden="true"
                className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
              />
              Searching…
            </>
          ) : searchMode === "area" ? (
            "Search selected area"
          ) : (
            `Search within ${radiusKm} km`
          )}
        </button>
        <div role="status">
          {blockedReason ? (
            <p
              id="search-blocked-reason"
              className="mt-1.5 text-xs text-[var(--warn)]"
            >
              {blockedReason}
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-[11px] text-[var(--muted)]">
        Official APIs only (Overpass and Google Places) — no scraping.
      </p>
    </section>
  );
}

function SourceOption({
  id,
  checked,
  unavailable,
  onSelect,
}: {
  id: SearchSource;
  checked: boolean;
  unavailable: boolean;
  onSelect: (source: SearchSource) => void;
}) {
  const copy = SOURCE_COPY[id];
  const labelId = `search-source-${id}-label`;
  const tagId = `search-source-${id}-tag`;
  const descId = `search-source-${id}-desc`;
  const dim = unavailable ? "opacity-60" : "";

  return (
    <label
      className={`relative flex items-start gap-2.5 px-3 py-2 transition-colors has-[:focus-visible]:z-10 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[var(--accent)] ${
        checked
          ? "bg-[color-mix(in_oklab,var(--accent)_7%,var(--surface))]"
          : unavailable
            ? "cursor-not-allowed bg-[var(--surface)]"
            : "cursor-pointer bg-[var(--surface)] hover:bg-[color-mix(in_oklab,var(--surface-2)_45%,var(--surface))]"
      }`}
    >
      <input
        type="radio"
        name="search-source"
        value={id}
        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)] focus-visible:outline-none disabled:cursor-not-allowed"
        checked={checked}
        disabled={unavailable}
        aria-labelledby={labelId}
        aria-describedby={
          unavailable
            ? `${tagId} ${descId} ${SOURCE_LOCKED_NOTE_ID}`
            : `${tagId} ${descId}`
        }
        onChange={() => onSelect(id)}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 @xl:flex-col @xl:items-start">
          <span
            id={labelId}
            className={`text-sm font-medium text-[var(--ink)] transition-opacity ${dim}`}
          >
            {copy.label}
          </span>
          <span
            id={tagId}
            className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-wide uppercase ${
              TAG_TONES[unavailable ? "warn" : copy.tone]
            }`}
          >
            {unavailable ? "Needs key" : copy.tag}
          </span>
        </span>
        <span
          id={descId}
          className={`mt-0.5 block text-xs leading-snug text-[var(--muted)] transition-opacity ${dim}`}
        >
          {copy.description}
        </span>
      </span>
    </label>
  );
}
