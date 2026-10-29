"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { MapCenter } from "@/lib/location/types";
import type { OsmPlace } from "@/lib/places/types";
import type { SearchMode } from "@/lib/search/categories";
import type { MapPlaceholderPin } from "@/lib/search/placeholders";
import { GoogleBasemap } from "./GoogleBasemap";

const MapWorkspace = dynamic(
  () => import("./MapWorkspace").then((m) => m.MapWorkspace),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-sm text-[var(--muted)]"
        role="status"
      >
        Loading map…
      </div>
    ),
  },
);

type Props = {
  center: MapCenter | null;
  radiusKm: number;
  searchMode?: SearchMode;
  boundingBox?: [number, number, number, number];
  zoom?: number;
  places?: OsmPlace[];
  placeholders?: MapPlaceholderPin[];
  selectedPlaceId?: string | null;
  onCenterChange: (center: MapCenter) => void;
  onSelectPlace?: (id: string | null) => void;
  onOpenDetails?: () => void;
};

type BrowserConfig = {
  enabled: boolean;
  apiKey: string | null;
};

export function MapWorkspaceLoader(props: Props) {
  const [browser, setBrowser] = useState<BrowserConfig | null>(null);
  const [basemap, setBasemap] = useState<"osm" | "google">("osm");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/maps/browser-config", { cache: "no-store" });
        if (!res.ok) throw new Error("Browser map config unavailable");
        const data = (await res.json()) as BrowserConfig;
        if (!cancelled) {
          setBrowser({
            enabled: Boolean(data.enabled && data.apiKey),
            apiKey: data.apiKey,
          });
        }
      } catch {
        if (!cancelled) {
          setBrowser({ enabled: false, apiKey: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const center = props.center ?? { lat: 20, lng: 0 };
  const zoom = props.zoom ?? (props.center ? 12 : 2);
  const showGoogle =
    basemap === "google" && Boolean(browser?.enabled && browser.apiKey);
  const googleNeedsCenter = !props.center;

  return (
    <div className="relative h-full min-h-[240px] w-full">
      {browser?.enabled ? (
        <div className="absolute left-2 top-2 z-[1200] flex gap-1 rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] p-0.5 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
              basemap === "osm"
                ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
            aria-pressed={basemap === "osm"}
            onClick={() => setBasemap("osm")}
          >
            OSM
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
              basemap === "google"
                ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
            aria-pressed={basemap === "google"}
            onClick={() => setBasemap("google")}
          >
            Google
          </button>
        </div>
      ) : null}

      {showGoogle && browser?.apiKey ? (
        <div className="map-shell relative h-full min-h-[280px] overflow-hidden rounded-xl border border-[var(--line)]">
          <GoogleBasemap
            apiKey={browser.apiKey}
            center={center}
            zoom={zoom}
            radiusKm={props.radiusKm}
            searchMode={props.searchMode === "area" ? "area" : "radius"}
            boundingBox={props.boundingBox}
            places={props.places ?? []}
            placeholders={props.placeholders ?? []}
            selectedPlaceId={props.selectedPlaceId ?? null}
            onCenterChange={props.onCenterChange}
            onSelectPlace={props.onSelectPlace}
            onOpenDetails={props.onOpenDetails}
          />
          {googleNeedsCenter ? (
            <p className="pointer-events-none absolute inset-x-3 top-14 z-[1200] rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_96%,transparent)] px-3 py-2 text-xs text-[var(--muted)] shadow-sm backdrop-blur-sm">
              Tap the map to set a search pin, then choose a radius or area.
            </p>
          ) : null}
        </div>
      ) : (
        <MapWorkspace {...props} />
      )}
    </div>
  );
}
