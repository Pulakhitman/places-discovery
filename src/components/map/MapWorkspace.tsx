"use client";

import { useEffect, useMemo } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { MapCenter } from "@/lib/location/types";

import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: MapCenter = { lat: 20, lng: 0 };
const WORLD_ZOOM = 2;

const pinIcon = L.divIcon({
  className: "center-pin",
  html: `<span class="center-pin__dot" aria-hidden="true"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

type Props = {
  center: MapCenter | null;
  radiusKm: number;
  boundingBox?: [number, number, number, number];
  onCenterChange: (center: MapCenter) => void;
};

function MapFocus({
  center,
  boundingBox,
}: {
  center: MapCenter | null;
  boundingBox?: [number, number, number, number];
}) {
  const map = useMap();

  useEffect(() => {
    if (boundingBox) {
      const [south, north, west, east] = boundingBox;
      map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        { padding: [24, 24], maxZoom: 12 },
      );
      return;
    }
    if (center) {
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 10), {
        animate: true,
      });
      return;
    }
    map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], WORLD_ZOOM);
  }, [map, center, boundingBox]);

  return null;
}

function MapClickSetter({
  onCenterChange,
}: {
  onCenterChange: (center: MapCenter) => void;
}) {
  useMapEvents({
    click(e) {
      // Map click sets center; marker drag handled separately.
      // Intentionally ignore clicks that Leaflet routes to markers.
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
  onCenterChange,
}: Props) {
  const activeCenter = center ?? DEFAULT_CENTER;
  const radiusMeters = useMemo(() => radiusKm * 1000, [radiusKm]);

  return (
    <div
      className="map-shell relative h-full min-h-[280px] w-full overflow-hidden rounded-xl border border-[var(--line)]"
      role="region"
      aria-label="Map workspace"
    >
      <MapContainer
        center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={WORLD_ZOOM}
        className="h-full w-full"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFocus center={center} boundingBox={boundingBox} />
        <MapClickSetter onCenterChange={onCenterChange} />
        <Circle
          center={[activeCenter.lat, activeCenter.lng]}
          radius={radiusMeters}
          pathOptions={{
            color: "#0f766e",
            fillColor: "#0d9488",
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
        <Marker
          position={[activeCenter.lat, activeCenter.lng]}
          draggable
          icon={pinIcon}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const ll = marker.getLatLng();
              onCenterChange({ lat: ll.lat, lng: ll.lng });
            },
          }}
          title="Search center — drag to move"
        />
      </MapContainer>
      <p className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] px-2 py-1 text-[11px] text-[var(--muted)] shadow-sm">
        Click map or drag pin to set center · {radiusKm} km radius
      </p>
    </div>
  );
}
