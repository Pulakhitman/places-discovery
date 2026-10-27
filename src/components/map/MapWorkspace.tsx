"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { MapCenter } from "@/lib/location/types";
import type { OsmPlace } from "@/lib/places/types";

import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: MapCenter = { lat: 20, lng: 0 };
const WORLD_ZOOM = 2;

const pinIcon = L.divIcon({
  className: "leaflet-div-icon center-pin",
  html: `<span class="center-pin__dot" aria-hidden="true"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

type Props = {
  center: MapCenter | null;
  radiusKm: number;
  boundingBox?: [number, number, number, number];
  zoom?: number;
  places?: OsmPlace[];
  selectedPlaceId?: string | null;
  onCenterChange: (center: MapCenter) => void;
  onSelectPlace?: (id: string | null) => void;
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
}: {
  center: MapCenter | null;
  boundingBox?: [number, number, number, number];
  zoom?: number;
  hasPlaces: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    // After a search, FitPlaces owns the viewport — don't yank back to admin bbox.
    if (hasPlaces) {
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
    if (center) {
      const nextZoom = zoom ?? Math.max(map.getZoom(), 10);
      map.setView([center.lat, center.lng], nextZoom, { animate: true });
      map.invalidateSize({ animate: false });
      return;
    }
    map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], WORLD_ZOOM);
  }, [map, center, boundingBox, zoom, hasPlaces]);

  return null;
}

function FitPlaces({ places }: { places: OsmPlace[] }) {
  const map = useMap();

  useEffect(() => {
    if (places.length === 0) {
      return;
    }
    const bounds = L.latLngBounds(
      places.map((p) => [p.lat, p.lng] as [number, number]),
    );
    map.fitBounds(bounds.pad(0.15), { maxZoom: 15, animate: true });
    window.setTimeout(() => map.invalidateSize(), 50);
  }, [map, places]);

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

/**
 * Sole map surface for the app. Do not mount a second map elsewhere.
 */
export function MapWorkspace({
  center,
  radiusKm,
  boundingBox,
  zoom,
  places = [],
  selectedPlaceId = null,
  onCenterChange,
  onSelectPlace,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const activeCenter = center ?? DEFAULT_CENTER;
  const radiusMeters = useMemo(() => radiusKm * 1000, [radiusKm]);

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
        />
        <FitPlaces places={places} />
        <SelectedPlacePan places={places} selectedPlaceId={selectedPlaceId} />
        <MapClickSetter onCenterChange={onCenterChange} />
        <Circle
          center={[activeCenter.lat, activeCenter.lng]}
          radius={radiusMeters}
          pathOptions={{
            color: "#0f766e",
            fillColor: "#0d9488",
            fillOpacity: 0.08,
            weight: 2,
          }}
        />
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
        />
        {places.map((place) => {
          const active = place.id === selectedPlaceId;
          return (
            <CircleMarker
              key={place.id}
              center={[place.lat, place.lng]}
              radius={active ? 10 : 7}
              pathOptions={{
                color: active ? "#0f766e" : "#9a3412",
                fillColor: active ? "#0d9488" : "#ea580c",
                fillOpacity: 0.95,
                weight: 2,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e.originalEvent);
                  onSelectPlace?.(place.id);
                },
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -8]}
                opacity={0.95}
                permanent={active}
              >
                {place.name}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <p className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] px-2 py-1 text-[11px] text-[var(--muted)] shadow-sm">
        Orange dots = places · teal pin = search center · {places.length} on map
        · {radiusKm} km
      </p>
    </div>
  );
}
