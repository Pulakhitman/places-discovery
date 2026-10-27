"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompareDrawer } from "@/components/compare/CompareDrawer";
import {
  CompareTray,
  MAX_COMPARE,
} from "@/components/compare/CompareTray";
import { PlaceDetailDrawer } from "@/components/details/PlaceDetailDrawer";
import { LocationHierarchy } from "@/components/location/LocationHierarchy";
import { MapWorkspaceLoader } from "@/components/map/MapWorkspaceLoader";
import { ExportBar } from "@/components/results/ExportBar";
import { ResultFiltersBar } from "@/components/results/ResultFiltersBar";
import {
  ResultsPanel,
  type SearchState,
} from "@/components/results/ResultsPanel";
import { SearchControls } from "@/components/search/SearchControls";
import { mapFocusFromSelection } from "@/lib/location/hierarchy";
import type { LocationSelection, MapCenter } from "@/lib/location/types";
import type { GoogleStatusResponse } from "@/lib/places/google-types";
import {
  DEFAULT_RESULT_FILTERS,
  filterPlaces,
  hasActiveFilters,
  type ResultFilters,
} from "@/lib/places/filters";
import { formatLatLng } from "@/lib/places/format";
import { loadSearchPrefs, saveSearchPrefs } from "@/lib/places/prefs";
import { sortPlaces, type PlaceSortId } from "@/lib/places/sort";
import type {
  FieldCoverage,
  OsmPlace,
  PlacesSearchSuccess,
} from "@/lib/places/types";
import type { PlaceCategoryId, SearchRadiusKm } from "@/lib/search/categories";
import { buildMapPlaceholders } from "@/lib/search/placeholders";

export function PlacesWorkspace() {
  const initialPrefs = useMemo(() => loadSearchPrefs(), []);
  const [selection, setSelection] = useState<LocationSelection>({});
  const [center, setCenter] = useState<MapCenter | null>(null);
  const [category, setCategory] = useState<PlaceCategoryId>(
    initialPrefs.category,
  );
  const [radiusKm, setRadiusKm] = useState<SearchRadiusKm>(
    initialPrefs.radiusKm,
  );
  const [customKeyword, setCustomKeyword] = useState("");
  const [sort, setSort] = useState<PlaceSortId>(initialPrefs.sort);
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const [places, setPlaces] = useState<OsmPlace[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(
    null,
  );
  const [filters, setFilters] = useState<ResultFilters>(DEFAULT_RESULT_FILTERS);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [coordsCopied, setCoordsCopied] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchGenRef = useRef(0);

  const focus = useMemo(() => mapFocusFromSelection(selection), [selection]);
  const mapCenter = center ?? focus.center;

  useEffect(() => {
    saveSearchPrefs({ category, radiusKm, sort });
  }, [category, radiusKm, sort]);

  const mapPlaceholders = useMemo(() => {
    if (!mapCenter) {
      return [];
    }
    if (searchState.status !== "idle" && searchState.status !== "loading") {
      return [];
    }
    return buildMapPlaceholders(
      mapCenter,
      category,
      radiusKm,
      customKeyword,
    );
  }, [mapCenter, category, radiusKm, customKeyword, searchState.status]);

  const filteredPlaces = useMemo(
    () => sortPlaces(filterPlaces(places, filters), sort),
    [places, filters, sort],
  );

  const filtersActive = hasActiveFilters(filters);

  const resultsState = useMemo((): SearchState => {
    if (searchState.status !== "ok") {
      return searchState;
    }
    return { ...searchState, places: filteredPlaces };
  }, [searchState, filteredPlaces]);

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  const comparePlaces = useMemo(
    () =>
      compareIds
        .map((id) => places.find((p) => p.id === id))
        .filter((p): p is OsmPlace => Boolean(p)),
    [compareIds, places],
  );

  const handleSelectionChange = useCallback((next: LocationSelection) => {
    setSelection(next);
    const nextFocus = mapFocusFromSelection(next);
    if (nextFocus.center) {
      setCenter(nextFocus.center);
    }
  }, []);

  const handleSelectPlace = useCallback((id: string | null) => {
    setSelectedPlaceId(id);
    setDetailOpen(Boolean(id));
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const handleOpenDetail = useCallback(() => {
    if (selectedPlaceId) {
      setDetailOpen(true);
    }
  }, [selectedPlaceId]);

  const handleToggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_COMPARE) {
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const handleRemoveCompare = useCallback((id: string) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/places/google/status");
        const data = (await res.json()) as GoogleStatusResponse;
        if (!cancelled) {
          setGoogleConfigured(data.configured);
        }
      } catch {
        if (!cancelled) {
          setGoogleConfigured(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  const runSearch = useCallback(async () => {
    if (!mapCenter) {
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const gen = ++searchGenRef.current;

    setSearchState({ status: "loading" });
    setSelectedPlaceId(null);
    setDetailOpen(false);
    setCompareIds([]);
    setCompareOpen(false);
    setFilters(DEFAULT_RESULT_FILTERS);

    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: mapCenter.lat,
          lng: mapCenter.lng,
          radiusKm,
          category,
          customKeyword:
            category === "custom" ? customKeyword.trim() : undefined,
        }),
        signal: controller.signal,
      });

      if (gen !== searchGenRef.current) {
        return;
      }

      const data = (await res.json()) as
        | PlacesSearchSuccess
        | {
            status: "error" | "rate_limited";
            message: string;
            retryable?: boolean;
            retryAfterSec?: number;
          };

      if (res.status === 429 || data.status === "rate_limited") {
        setPlaces([]);
        setSearchState({
          status: "rate_limited",
          message:
            "message" in data
              ? data.message
              : "Overpass rate limit reached.",
          retryable: true,
          retryAfterSec:
            "retryAfterSec" in data ? data.retryAfterSec : undefined,
        });
        return;
      }

      if (!res.ok || data.status === "error") {
        setPlaces([]);
        setSearchState({
          status: "error",
          message:
            "message" in data ? data.message : "Place search failed.",
          retryable: "retryable" in data ? Boolean(data.retryable) : true,
        });
        return;
      }

      const success = data as PlacesSearchSuccess;
      setPlaces(success.places);
      if (success.status === "empty") {
        setSearchState({ status: "empty", meta: success.meta });
      } else {
        setSearchState({
          status: "ok",
          places: success.places,
          coverage: success.coverage as FieldCoverage,
          meta: success.meta,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (gen !== searchGenRef.current) {
        return;
      }
      setPlaces([]);
      setSearchState({
        status: "error",
        message: "Network error while searching.",
        retryable: true,
      });
    }
  }, [mapCenter, radiusKm, category, customKeyword]);

  const showTools = searchState.status === "ok" && places.length > 0;

  const copyCenter = useCallback(() => {
    if (!mapCenter) {
      return;
    }
    const text = formatLatLng(mapCenter.lat, mapCenter.lng, 6);
    void navigator.clipboard?.writeText(text).then(() => {
      setCoordsCopied(true);
      window.setTimeout(() => setCoordsCopied(false), 1500);
    });
  }, [mapCenter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      <div className="order-1 h-[42vh] min-h-[260px] w-full shrink-0 sm:h-[48vh] lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1">
        <MapWorkspaceLoader
          center={mapCenter}
          boundingBox={focus.boundingBox}
          zoom={focus.zoom}
          radiusKm={radiusKm}
          places={showTools ? filteredPlaces : places}
          placeholders={mapPlaceholders}
          selectedPlaceId={selectedPlaceId}
          onCenterChange={setCenter}
          onSelectPlace={handleSelectPlace}
          onOpenDetails={handleOpenDetail}
        />
      </div>

      <aside className="order-2 flex w-full shrink-0 flex-col gap-6 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm lg:order-1 lg:max-h-[calc(100vh-8rem)] lg:w-[22rem] xl:w-[24rem]">
        <LocationHierarchy
          selection={selection}
          onChange={handleSelectionChange}
        />
        <hr className="border-[var(--line)]" />
        <SearchControls
          category={category}
          radiusKm={radiusKm}
          customKeyword={customKeyword}
          loading={searchState.status === "loading"}
          onCategoryChange={setCategory}
          onRadiusChange={setRadiusKm}
          onCustomKeywordChange={setCustomKeyword}
          onSearch={() => void runSearch()}
          disabled={!mapCenter}
        />
        {googleConfigured !== null && (
          <p
            className={`rounded-md border px-3 py-2 text-xs ${
              googleConfigured
                ? "border-[var(--accent)]/30 bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] text-[var(--ink)]"
                : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]"
            }`}
            role="status"
          >
            {googleConfigured
              ? "Google Places details: on — tap a result for hours, ratings, and reviews."
              : "Google Places details: off — set GOOGLE_MAPS_API_KEY in .env to enable."}
          </p>
        )}
        <hr className="border-[var(--line)]" />

        {showTools && (
          <>
            <ResultFiltersBar
              filters={filters}
              onChange={setFilters}
              sort={sort}
              onSortChange={setSort}
              totalCount={places.length}
              filteredCount={filteredPlaces.length}
            />
            <ExportBar places={filteredPlaces} />
            <CompareTray
              places={comparePlaces}
              onRemove={handleRemoveCompare}
              onClear={() => {
                setCompareIds([]);
                setCompareOpen(false);
              }}
              onOpenCompare={() => setCompareOpen(true)}
            />
            <hr className="border-[var(--line)]" />
          </>
        )}

        <ResultsPanel
          state={resultsState}
          selectedId={selectedPlaceId}
          onSelect={handleSelectPlace}
          onRetry={() => void runSearch()}
          category={category}
          radiusKm={radiusKm}
          customKeyword={customKeyword}
          hasCenter={Boolean(mapCenter)}
          compareIds={compareIds}
          onToggleCompare={showTools ? handleToggleCompare : undefined}
          compareLimit={MAX_COMPARE}
          filtersActive={filtersActive}
          onClearFilters={() => setFilters(DEFAULT_RESULT_FILTERS)}
        />
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
          <span>
            Center:{" "}
            {mapCenter
              ? formatLatLng(mapCenter.lat, mapCenter.lng)
              : "not set — pick a country/area or tap the map"}
          </span>
          {mapCenter ? (
            <button
              type="button"
              className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              onClick={copyCenter}
            >
              {coordsCopied ? "Copied" : "Copy"}
            </button>
          ) : null}
        </p>
      </aside>

      <PlaceDetailDrawer
        place={selectedPlace}
        open={detailOpen && Boolean(selectedPlace)}
        onClose={handleCloseDetail}
      />

      <CompareDrawer
        places={comparePlaces}
        open={compareOpen && comparePlaces.length >= 2}
        onClose={() => setCompareOpen(false)}
        onRemove={handleRemoveCompare}
      />
    </div>
  );
}
