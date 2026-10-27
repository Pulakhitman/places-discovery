"use client";

import { useCallback, useMemo, useState } from "react";
import { LocationHierarchy } from "@/components/location/LocationHierarchy";
import { MapWorkspaceLoader } from "@/components/map/MapWorkspaceLoader";
import {
  ResultsPanel,
  type SearchState,
} from "@/components/results/ResultsPanel";
import { SearchControls } from "@/components/search/SearchControls";
import { mapFocusFromSelection } from "@/lib/location/hierarchy";
import type { LocationSelection, MapCenter } from "@/lib/location/types";
import type {
  FieldCoverage,
  OsmPlace,
  PlacesSearchSuccess,
} from "@/lib/places/types";
import type { PlaceCategoryId, SearchRadiusKm } from "@/lib/search/categories";

export function PlacesWorkspace() {
  const [selection, setSelection] = useState<LocationSelection>({});
  const [center, setCenter] = useState<MapCenter | null>(null);
  const [category, setCategory] = useState<PlaceCategoryId>("parks");
  const [radiusKm, setRadiusKm] = useState<SearchRadiusKm>(5);
  const [customKeyword, setCustomKeyword] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const [places, setPlaces] = useState<OsmPlace[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const focus = useMemo(() => mapFocusFromSelection(selection), [selection]);

  const handleSelectionChange = useCallback((next: LocationSelection) => {
    setSelection(next);
    const { center: nextCenter } = mapFocusFromSelection(next);
    if (nextCenter) {
      setCenter(nextCenter);
    }
  }, []);

  const runSearch = useCallback(async () => {
    if (!center) {
      return;
    }

    setSearchState({ status: "loading" });
    setSelectedPlaceId(null);

    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: center.lat,
          lng: center.lng,
          radiusKm,
          category,
          customKeyword:
            category === "custom" ? customKeyword.trim() : undefined,
        }),
      });

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
    } catch {
      setPlaces([]);
      setSearchState({
        status: "error",
        message: "Network error while searching.",
        retryable: true,
      });
    }
  }, [center, radiusKm, category, customKeyword]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm lg:w-[22rem] xl:w-[24rem]">
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
          disabled={!center}
        />
        <hr className="border-[var(--line)]" />
        <ResultsPanel
          state={searchState}
          selectedId={selectedPlaceId}
          onSelect={setSelectedPlaceId}
          onRetry={() => void runSearch()}
        />
        <p className="text-xs text-[var(--muted)]">
          Center:{" "}
          {center
            ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
            : "not set — pick an area or click the map"}
        </p>
      </aside>

      <div className="min-h-[50vh] flex-1 lg:min-h-0">
        <MapWorkspaceLoader
          center={center ?? focus.center}
          boundingBox={focus.boundingBox}
          radiusKm={radiusKm}
          places={places}
          selectedPlaceId={selectedPlaceId}
          onCenterChange={setCenter}
          onSelectPlace={setSelectedPlaceId}
        />
      </div>
    </div>
  );
}
