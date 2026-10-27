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
import type { OsmPlace } from "@/lib/places/types";

import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: MapCenter = { lat: 20, lng: 0 };
const WORLD_ZOOM = 2;

const pinIcon = L.divIcon({
  className: "center-pin",
  html: `<span class="center-pin__dot" aria-hidden="true"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function resultIcon(active: boolean) {
  return L.divIcon({
    className: "result-marker",
    html: `<span class="result-marker__dot${active ? " result-marker__dot--active" : ""}" aria-hidden="true"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

type Props = {
  center: MapCenter | null;
  radiusKm: number;
  boundingBox?: [number, number, number, number];
  places?: OsmPlace[];
  selectedPlaceId?: string | null;
  onCenterChange: (center: MapCenter) => void;
  onSelectPlace?: (id: string | null) => void;
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
      // Map background click sets search center.
      // Result marker clicks must call stopPropagation so they do not reach here.
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
  places = [],
  selectedPlaceId = null,
  onCenterChange,
  onSelectPlace,
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
        <SelectedPlacePan places={places} selectedPlaceId={selectedPlaceId} />
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
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={resultIcon(place.id === selectedPlaceId)}
            zIndexOffset={place.id === selectedPlaceId ? 800 : 400}
            eventHandlers={{
              click: (e) => {
                // Must not set a new search center — only select the place.
                L.DomEvent.stopPropagation(e.originalEvent);
                onSelectPlace?.(place.id);
              },
            }}
            title={place.name}
          />
        ))}
      </MapContainer>
      <p className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] px-2 py-1 text-[11px] text-[var(--muted)] shadow-sm">
        Click map or drag pin to set center · markers select places · {radiusKm}{" "}
        km radius
      </p>
    </div>
  );
}
