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
import { GoogleUsagePanel } from "@/components/ops/GoogleUsagePanel";
import { ExportBar } from "@/components/results/ExportBar";
import { ResultFiltersBar } from "@/components/results/ResultFiltersBar";
import {
  ResultsPanel,
  type SearchState,
} from "@/components/results/ResultsPanel";
import { SearchControls } from "@/components/search/SearchControls";
import {
  deepestSelection,
  mapFocusFromSelection,
} from "@/lib/location/hierarchy";
import type { LocationSelection, MapCenter } from "@/lib/location/types";
import {
  DEFAULT_RESULT_FILTERS,
  filterPlaces,
  hasActiveFilters,
  type ResultFilters,
} from "@/lib/places/filters";
import { formatLatLng } from "@/lib/places/format";
import { computeOsmCoverage } from "@/lib/places/coverage";
import {
  DEFAULT_SEARCH_PREFS,
  loadSearchPrefs,
  saveSearchPrefs,
} from "@/lib/places/prefs";
import {
  applyShareParamsToUrl,
  parseShareSearchParams,
} from "@/lib/places/share-url";
import { sortPlaces, type PlaceSortId } from "@/lib/places/sort";
import type {
  FieldCoverage,
  OsmPlace,
  PlacesSearchSuccess,
} from "@/lib/places/types";
import {
  isBBoxWithinSearchLimit,
  isNominatimBBox,
  type PlaceCategoryId,
  type SearchMode,
  type SearchRadiusKm,
} from "@/lib/search/categories";
import { buildMapPlaceholders } from "@/lib/search/placeholders";

export function PlacesWorkspace() {
  // Defaults only on first paint so SSR HTML matches the client (localStorage
  // is applied in an effect after hydration).
  const [selection, setSelection] = useState<LocationSelection>({});
  const [center, setCenter] = useState<MapCenter | null>(null);
  const [category, setCategory] = useState<PlaceCategoryId>(
    DEFAULT_SEARCH_PREFS.category,
  );
  const [radiusKm, setRadiusKm] = useState<SearchRadiusKm>(
    DEFAULT_SEARCH_PREFS.radiusKm,
  );
  const [searchMode, setSearchMode] = useState<SearchMode>(
    DEFAULT_SEARCH_PREFS.searchMode,
  );
  const [customKeyword, setCustomKeyword] = useState("");
  const [sort, setSort] = useState<PlaceSortId>(DEFAULT_SEARCH_PREFS.sort);
  const [prefsReady, setPrefsReady] = useState(false);
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [usageRefresh, setUsageRefresh] = useState(0);
  const shareBootstrapped = useRef(false);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchGenRef = useRef(0);

  const focus = useMemo(() => mapFocusFromSelection(selection), [selection]);
  const mapCenter = center ?? focus.center;
  const selectedAreaBBox = useMemo(() => {
    const box = focus.boundingBox;
    return isNominatimBBox(box) ? box : null;
  }, [focus.boundingBox]);
  const areaTooLarge = Boolean(
    selectedAreaBBox && !isBBoxWithinSearchLimit(selectedAreaBBox),
  );
  const areaLabel = useMemo(() => {
    const deep = deepestSelection(selection);
    if (!deep) {
      return null;
    }
    if ("displayName" in deep && deep.displayName) {
      return deep.displayName;
    }
    if ("name" in deep && deep.name) {
      return deep.name;
    }
    return null;
  }, [selection]);

  useEffect(() => {
    const prefs = loadSearchPrefs();
    const shared = parseShareSearchParams(window.location.search);
    setCategory(shared.category ?? prefs.category);
    setRadiusKm(shared.radiusKm ?? prefs.radiusKm);
    setSearchMode(shared.mode ?? prefs.searchMode);
    setSort(prefs.sort);
    if (shared.q) {
      setCustomKeyword(shared.q);
    }
    if (typeof shared.lat === "number" && typeof shared.lng === "number") {
      setCenter({ lat: shared.lat, lng: shared.lng });
    }
    setPrefsReady(true);
    shareBootstrapped.current = true;
  }, []);

  useEffect(() => {
    if (!prefsReady) {
      return;
    }
    saveSearchPrefs({ category, radiusKm, searchMode, sort });
  }, [prefsReady, category, radiusKm, searchMode, sort]);

  useEffect(() => {
    if (!prefsReady || !shareBootstrapped.current) {
      return;
    }
    applyShareParamsToUrl({
      lat: mapCenter?.lat,
      lng: mapCenter?.lng,
      radiusKm,
      category,
      mode: searchMode,
      q: customKeyword,
    });
  }, [
    prefsReady,
    mapCenter?.lat,
    mapCenter?.lng,
    radiusKm,
    category,
    searchMode,
    customKeyword,
  ]);

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
    // Coverage follows the visible (filtered) list so % matches what you see.
    return {
      ...searchState,
      places: filteredPlaces,
      coverage: computeOsmCoverage(filteredPlaces),
    };
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
      setUsageRefresh((n) => n + 1);
    }
  }, [selectedPlaceId]);

  const copyShareLink = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    applyShareParamsToUrl({
      lat: mapCenter?.lat,
      lng: mapCenter?.lng,
      radiusKm,
      category,
      mode: searchMode,
      q: customKeyword,
    });
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1600);
    });
  }, [mapCenter, radiusKm, category, searchMode, customKeyword]);

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
        // Prefer public /api/health (dynamic via connection()) so the banner
        // matches production runtime env — not a prerendered status response.
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`health ${res.status}`);
        }
        const data = (await res.json()) as {
          googlePlacesConfigured?: boolean;
        };
        if (!cancelled) {
          setGoogleConfigured(Boolean(data.googlePlacesConfigured));
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
    if (searchMode === "area") {
      if (!selectedAreaBBox || areaTooLarge) {
        return;
      }
    } else if (!mapCenter) {
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
      const body =
        searchMode === "area" && selectedAreaBBox
          ? {
              mode: "area" as const,
              bbox: selectedAreaBBox,
              lat: mapCenter?.lat,
              lng: mapCenter?.lng,
              category,
              customKeyword:
                category === "custom" ? customKeyword.trim() : undefined,
            }
          : {
              mode: "radius" as const,
              lat: mapCenter!.lat,
              lng: mapCenter!.lng,
              radiusKm,
              category,
              customKeyword:
                category === "custom" ? customKeyword.trim() : undefined,
            };

      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
  }, [
    mapCenter,
    radiusKm,
    category,
    customKeyword,
    searchMode,
    selectedAreaBBox,
    areaTooLarge,
  ]);

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
      <div className="order-1 h-[min(42vh,22rem)] min-h-[240px] w-full shrink-0 sm:h-[48vh] lg:order-2 lg:h-auto lg:min-h-[28rem] lg:flex-1">
        <MapWorkspaceLoader
          center={mapCenter}
          boundingBox={focus.boundingBox}
          zoom={focus.zoom}
          radiusKm={radiusKm}
          searchMode={searchMode}
          places={showTools ? filteredPlaces : places}
          placeholders={mapPlaceholders}
          selectedPlaceId={selectedPlaceId}
          onCenterChange={setCenter}
          onSelectPlace={handleSelectPlace}
          onOpenDetails={handleOpenDetail}
        />
      </div>

      <aside className="order-2 flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm lg:order-1 lg:max-h-[calc(100vh-8rem)] lg:w-[22rem] xl:w-[24rem]">
        <div className="flex max-h-[min(42vh,22rem)] shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain border-b border-[var(--line)] p-4 lg:max-h-[38%]">
          <LocationHierarchy
            selection={selection}
            onChange={handleSelectionChange}
          />
          <hr className="border-[var(--line)]" />
          <SearchControls
            category={category}
            searchMode={searchMode}
            radiusKm={radiusKm}
            customKeyword={customKeyword}
            areaLabel={areaLabel}
            hasAreaBBox={Boolean(selectedAreaBBox)}
            areaTooLarge={areaTooLarge}
            loading={searchState.status === "loading"}
            onCategoryChange={setCategory}
            onSearchModeChange={setSearchMode}
            onRadiusChange={setRadiusKm}
            onCustomKeywordChange={setCustomKeyword}
            onSearch={() => void runSearch()}
            disabled={searchMode === "radius" ? !mapCenter : false}
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
          <GoogleUsagePanel refreshKey={usageRefresh} />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
              onClick={copyShareLink}
            >
              {linkCopied ? "Link copied" : "Copy share link"}
            </button>
            <span className="text-[var(--muted)]">
              Deep-links lat, lng, radius, category, and mode in the URL.
            </span>
          </div>
          {showTools ? (
            <>
              <hr className="border-[var(--line)]" />
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
            </>
          ) : null}
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
        </div>

        <div className="flex min-h-[18rem] flex-1 flex-col overflow-hidden p-4 pt-3">
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
        </div>
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
