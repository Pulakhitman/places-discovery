"use client";

import { useCallback, useMemo, useState } from "react";
import { LocationHierarchy } from "@/components/location/LocationHierarchy";
import { MapWorkspaceLoader } from "@/components/map/MapWorkspaceLoader";
import { SearchControls } from "@/components/search/SearchControls";
import { mapFocusFromSelection } from "@/lib/location/hierarchy";
import type { LocationSelection, MapCenter } from "@/lib/location/types";
import type { PlaceCategoryId, SearchRadiusKm } from "@/lib/search/categories";

export function PlacesWorkspace() {
  const [selection, setSelection] = useState<LocationSelection>({});
  const [center, setCenter] = useState<MapCenter | null>(null);
  const [category, setCategory] = useState<PlaceCategoryId>("parks");
  const [radiusKm, setRadiusKm] = useState<SearchRadiusKm>(5);
  const [stubNotice, setStubNotice] = useState<string | null>(null);

  const focus = useMemo(() => mapFocusFromSelection(selection), [selection]);

  const handleSelectionChange = useCallback((next: LocationSelection) => {
    setSelection(next);
    const { center: nextCenter } = mapFocusFromSelection(next);
    if (nextCenter) {
      setCenter(nextCenter);
    }
  }, []);

  const handleSearch = () => {
    setStubNotice(
      "Search is a stub in Step 1. Overpass / Google Places arrive in later steps.",
    );
  };

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
          onCategoryChange={setCategory}
          onRadiusChange={setRadiusKm}
          onSearch={handleSearch}
          disabled={!center}
        />
        {stubNotice && (
          <p className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]" role="status">
            {stubNotice}
          </p>
        )}
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
          onCenterChange={setCenter}
        />
      </div>
    </div>
  );
}
