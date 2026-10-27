"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { MapCenter } from "@/lib/location/types";
import type { OsmPlace } from "@/lib/places/types";
import {
  categoryMarkerHtml,
  type CategoryMarkerVariant,
} from "@/lib/search/category-marker-html";
import type { MapPlaceholderPin } from "@/lib/search/placeholders";
import type { PlaceCategoryId, SearchMode } from "@/lib/search/categories";
import { isNominatimBBox } from "@/lib/search/categories";

import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: MapCenter = { lat: 20, lng: 0 };
const WORLD_ZOOM = 2;

const pinIcon = L.divIcon({
  className: "leaflet-div-icon center-pin",
  html: `<span class="center-pin__dot" aria-hidden="true"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const markerIconCache = new Map<string, L.DivIcon>();

function markerIcon(
  category: PlaceCategoryId,
  variant: CategoryMarkerVariant,
): L.DivIcon {
  const key = `${category}:${variant}`;
  const cached = markerIconCache.get(key);
  if (cached) {
    return cached;
  }
  const size = variant === "result-active" ? 36 : 30;
  const icon = L.divIcon({
    className: "leaflet-div-icon map-ph-marker",
    html: categoryMarkerHtml(category, variant),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  markerIconCache.set(key, icon);
  return icon;
}

function searchAreaBounds(center: MapCenter, radiusKm: number): L.LatLngBounds {
  // toBounds(size) uses size as both width and height in meters → diameter of circle.
  return L.latLng(center.lat, center.lng).toBounds(
    Math.max(radiusKm, 0.5) * 1000 * 2,
  );
}

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

function MapInvalidateSize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const kick = () => {
      map.invalidateSize({ animate: false });
    };

    kick();
    const t1 = window.setTimeout(kick, 100);
    const t2 = window.setTimeout(kick, 400);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => kick())
        : null;
    ro?.observe(container);
    window.addEventListener("orientationchange", kick);
    window.addEventListener("resize", kick);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro?.disconnect();
      window.removeEventListener("orientationchange", kick);
      window.removeEventListener("resize", kick);
    };
  }, [map]);

  return null;
}

function MapFocus({
  center,
  boundingBox,
  zoom,
  hasPlaces,
  radiusKm,
}: {
  center: MapCenter | null;
  boundingBox?: [number, number, number, number];
  zoom?: number;
  hasPlaces: boolean;
  radiusKm: number;
}) {
  const map = useMap();

  useEffect(() => {
    // After a search, FitPlaces owns the viewport — don't yank back.
    if (hasPlaces) {
      return;
    }
    if (center) {
      map.fitBounds(searchAreaBounds(center, radiusKm), {
        padding: [40, 40],
        maxZoom: zoom ?? 15,
        animate: true,
      });
      map.invalidateSize({ animate: false });
      return;
    }
    if (boundingBox) {
      const [south, north, west, east] = boundingBox;
      map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        { padding: [24, 24], maxZoom: 12 },
      );
      map.invalidateSize({ animate: false });
      return;
    }
    map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], WORLD_ZOOM);
  }, [map, center, boundingBox, zoom, hasPlaces, radiusKm]);

  return null;
}

function FitPlaces({
  places,
  center,
}: {
  places: OsmPlace[];
  center: MapCenter | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (places.length === 0) {
      return;
    }
    const points: [number, number][] = places.map((p) => [p.lat, p.lng]);
    if (center) {
      points.push([center.lat, center.lng]);
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.2), { maxZoom: 15, animate: true });
    window.setTimeout(() => map.invalidateSize(), 50);
  }, [map, places, center]);

  return null;
}

function SelectedPlacePan({
  places,
  selectedPlaceId,
}: {
  places: OsmPlace[];
  selectedPlaceId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedPlaceId) {
      return;
    }
    const place = places.find((p) => p.id === selectedPlaceId);
    if (!place) {
      return;
    }
    map.panTo([place.lat, place.lng], { animate: true });
  }, [map, places, selectedPlaceId]);

  return null;
}

function MapClickSetter({
  onCenterChange,
}: {
  onCenterChange: (center: MapCenter) => void;
}) {
  useMapEvents({
    click(e) {
      onCenterChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapToolbarBridge({
  center,
  radiusKm,
  onReady,
}: {
  center: MapCenter | null;
  radiusKm: number;
  onReady: (fitSearchArea: () => void) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onReady(() => {
      if (!center) {
        return;
      }
      map.fitBounds(searchAreaBounds(center, radiusKm), {
        padding: [40, 40],
        maxZoom: 15,
        animate: true,
      });
    });
  }, [map, center, radiusKm, onReady]);

  return null;
}

/**
 * Sole map surface for the app. Do not mount a second map elsewhere.
 */
export function MapWorkspace({
  center,
  radiusKm,
  searchMode = "radius",
  boundingBox,
  zoom,
  places = [],
  placeholders = [],
  selectedPlaceId = null,
  onCenterChange,
  onSelectPlace,
  onOpenDetails,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const fitSearchAreaRef = useRef<(() => void) | null>(null);
  const activeCenter = center ?? DEFAULT_CENTER;
  const radiusMeters = useMemo(() => radiusKm * 1000, [radiusKm]);
  const areaBounds = useMemo(() => {
    if (!isNominatimBBox(boundingBox)) {
      return null;
    }
    const [south, north, west, east] = boundingBox;
    return [
      [south, west] as [number, number],
      [north, east] as [number, number],
    ];
  }, [boundingBox]);
  const showAreaRect = searchMode === "area" && areaBounds !== null;
  const showPlaceholders = places.length === 0 && placeholders.length > 0;
  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  const handleToolbarReady = useCallback((fitSearchArea: () => void) => {
    fitSearchAreaRef.current = fitSearchArea;
  }, []);

  return (
    <div
      ref={shellRef}
      className="map-shell relative h-full min-h-[280px] w-full overflow-hidden rounded-xl border border-[var(--line)]"
      role="region"
      aria-label="Map workspace"
    >
      <MapContainer
        center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={WORLD_ZOOM}
        className="absolute inset-0 z-0 h-full w-full"
        scrollWheelZoom
        attributionControl
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapInvalidateSize />
        <MapFocus
          center={center}
          boundingBox={boundingBox}
          zoom={zoom}
          hasPlaces={places.length > 0}
          radiusKm={radiusKm}
        />
        <FitPlaces places={places} center={center} />
        <SelectedPlacePan places={places} selectedPlaceId={selectedPlaceId} />
        <MapClickSetter onCenterChange={onCenterChange} />
        <MapToolbarBridge
          center={center}
          radiusKm={radiusKm}
          onReady={handleToolbarReady}
        />
        <ZoomControlBottomRight />
        {showAreaRect ? (
          <Rectangle
            bounds={areaBounds}
            pathOptions={{
              color: "#0f766e",
              fillColor: "#0d9488",
              fillOpacity: 0.1,
              weight: 2.5,
            }}
          />
        ) : (
          <Circle
            center={[activeCenter.lat, activeCenter.lng]}
            radius={radiusMeters}
            pathOptions={{
              color: "#0f766e",
              fillColor: "#0d9488",
              fillOpacity: 0.1,
              weight: 2.5,
              dashArray: undefined,
            }}
          />
        )}
        <Marker
          position={[activeCenter.lat, activeCenter.lng]}
          draggable
          icon={pinIcon}
          zIndexOffset={1000}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const ll = marker.getLatLng();
              onCenterChange({ lat: ll.lat, lng: ll.lng });
            },
            click: (e) => {
              L.DomEvent.stopPropagation(e.originalEvent);
            },
          }}
          title="Search center — drag to move"
        >
          <Tooltip direction="bottom" offset={[0, 12]} opacity={0.95}>
            Search center · drag to move
          </Tooltip>
        </Marker>
        {showPlaceholders &&
          placeholders.map((pin) => (
            <Marker
              key={pin.id}
              position={[pin.lat, pin.lng]}
              icon={markerIcon(pin.category, "placeholder")}
              interactive={false}
              keyboard={false}
              zIndexOffset={200}
            >
              <Tooltip
                direction="top"
                offset={[0, -14]}
                opacity={0.95}
                permanent
                className="map-tip map-tip--sample"
              >
                <span>
                  {pin.title}
                  <span className="map-tip__muted"> · sample</span>
                </span>
              </Tooltip>
            </Marker>
          ))}
        {places.map((place) => {
          const active = place.id === selectedPlaceId;
          return (
            <Marker
              key={place.id}
              position={[place.lat, place.lng]}
              icon={markerIcon(
                place.categoryId,
                active ? "result-active" : "result",
              )}
              zIndexOffset={active ? 800 : 400}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e.originalEvent);
                  onSelectPlace?.(place.id);
                },
              }}
              title={place.name}
            >
              <Tooltip
                direction="top"
                offset={[0, -16]}
                opacity={0.97}
                permanent={active}
                className={active ? "map-tip map-tip--active" : "map-tip"}
              >
                {place.name}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {selectedPlace && (
        <div className="pointer-events-auto absolute left-2 right-14 top-2 z-[1100] flex max-w-md items-start gap-2 rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] px-3 py-2 shadow-md backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">
              {selectedPlace.name}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {selectedPlace.categoryLabel}
              {selectedPlace.address ? ` · ${selectedPlace.address}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)]"
              onClick={() => onOpenDetails?.()}
            >
              Details
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              onClick={() => onSelectPlace?.(null)}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-auto absolute right-2 top-2 z-[1100] flex flex-col gap-1.5">
        <button
          type="button"
          className="map-tool-btn"
          disabled={!center}
          title="Fit search area"
          aria-label="Fit search area on map"
          onClick={() => fitSearchAreaRef.current?.()}
        >
          Fit area
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] max-w-[min(100%-1rem,20rem)] rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] px-2.5 py-1.5 text-[11px] leading-snug text-[var(--muted)] shadow-sm backdrop-blur-sm">
        {showPlaceholders ? (
          <>
            Dashed icons = sample {placeholders[0]?.category ?? "places"} · teal
            pin = center · {searchMode === "area" ? "selected area" : `${radiusKm} km radius`}
          </>
        ) : places.length > 0 ? (
          <>
            Category icons = places ({places.length}) · teal pin = center ·{" "}
            {radiusKm} km · tap a pin for details
          </>
        ) : (
          <>
            Teal pin = search center (drag or tap map) · {searchMode === "area" ? "selected area box" : `${radiusKm} km radius`}
          </>
        )}
      </div>
    </div>
  );
}

function ZoomControlBottomRight() {
  const map = useMap();

  useEffect(() => {
    const control = L.control.zoom({ position: "bottomright" });
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map]);

  return null;
}
