"use client";

import { useEffect, useRef } from "react";
import type { MapCenter } from "@/lib/location/types";
import type { OsmPlace } from "@/lib/places/types";

type Props = {
  apiKey: string;
  center: MapCenter;
  zoom: number;
  radiusKm: number;
  searchMode: "radius" | "area";
  boundingBox?: [number, number, number, number];
  places: OsmPlace[];
  selectedPlaceId: string | null;
  onCenterChange: (center: MapCenter) => void;
  onSelectPlace?: (id: string | null) => void;
  onOpenDetails?: () => void;
};

type GoogleMapsNs = {
  maps: {
    Map: new (
      el: HTMLElement,
      opts: Record<string, unknown>,
    ) => GoogleMap;
    Marker: new (opts: Record<string, unknown>) => GoogleMarker;
    Circle: new (opts: Record<string, unknown>) => { setMap: (m: GoogleMap | null) => void };
    Rectangle: new (opts: Record<string, unknown>) => { setMap: (m: GoogleMap | null) => void };
    LatLngBounds: new (
      sw?: { lat: number; lng: number },
      ne?: { lat: number; lng: number },
    ) => {
      extend: (p: { lat: number; lng: number }) => void;
    };
    event: {
      addListener: (t: unknown, name: string, fn: (...args: unknown[]) => void) => void;
      clearInstanceListeners: (t: unknown) => void;
    };
  };
};

type GoogleMap = {
  setCenter: (c: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
  getCenter: () => { lat: () => number; lng: () => number } | undefined;
  getZoom: () => number | undefined;
  fitBounds: (b: unknown, padding?: number) => void;
};

type GoogleMarker = {
  setMap: (m: GoogleMap | null) => void;
  addListener: (name: string, fn: () => void) => void;
};

declare global {
  interface Window {
    google?: GoogleMapsNs;
    __pdGoogleMapsPromise?: Promise<GoogleMapsNs>;
  }
}

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNs> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("No window"));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (window.__pdGoogleMapsPromise) {
    return window.__pdGoogleMapsPromise;
  }
  window.__pdGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-pd-google-maps]",
    );
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          reject(new Error("Google Maps failed to load"));
        }
      });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.pdGoogleMaps = "1";
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps failed to load"));
      }
    };
    script.onerror = () => reject(new Error("Google Maps script error"));
    document.head.appendChild(script);
  });
  return window.__pdGoogleMapsPromise;
}

/**
 * Official Maps JavaScript API basemap in the same map shell (no Leaflet tiles).
 */
export function GoogleBasemap({
  apiKey,
  center,
  zoom,
  radiusKm,
  searchMode,
  boundingBox,
  places,
  selectedPlaceId,
  onCenterChange,
  onSelectPlace,
  onOpenDetails,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const overlayRef = useRef<{ setMap: (m: GoogleMap | null) => void } | null>(
    null,
  );
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) {
      return;
    }

    void loadGoogleMaps(apiKey)
      .then((g) => {
        if (cancelled || !hostRef.current) {
          return;
        }
        const map = new g.maps.Map(hostRef.current, {
          center,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        g.maps.event.addListener(map, "click", (e: unknown) => {
          const ev = e as { latLng?: { lat: () => number; lng: () => number } };
          const ll = ev.latLng;
          if (!ll) {
            return;
          }
          onCenterChangeRef.current({ lat: ll.lat(), lng: ll.lng() });
        });
      })
      .catch(() => {
        // Leave empty host; parent can fall back to OSM.
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      if (mapRef.current && window.google?.maps) {
        window.google.maps.event.clearInstanceListeners(mapRef.current);
      }
      mapRef.current = null;
    };
    // Intentionally once per mount/key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const g = window.google;
    if (!map || !g?.maps) {
      return;
    }
    map.setCenter(center);
    map.setZoom(zoom);

    overlayRef.current?.setMap(null);
    if (searchMode === "area" && boundingBox) {
      const [south, north, west, east] = boundingBox;
      const rect = new g.maps.Rectangle({
        bounds: {
          south,
          north,
          west,
          east,
        },
        strokeColor: "#0f766e",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: "#0f766e",
        fillOpacity: 0.08,
        map,
      });
      overlayRef.current = rect;
    } else {
      const circle = new g.maps.Circle({
        center,
        radius: radiusKm * 1000,
        strokeColor: "#0f766e",
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor: "#0f766e",
        fillOpacity: 0.08,
        map,
      });
      overlayRef.current = circle;
    }
  }, [center, zoom, radiusKm, searchMode, boundingBox]);

  useEffect(() => {
    const map = mapRef.current;
    const g = window.google;
    if (!map || !g?.maps) {
      return;
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = places.map((place) => {
      const active = place.id === selectedPlaceId;
      const marker = new g.maps.Marker({
        map,
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
        opacity: active ? 1 : 0.85,
        zIndex: active ? 900 : 400,
      });
      marker.addListener("click", () => {
        onSelectPlace?.(place.id);
        onOpenDetails?.();
      });
      return marker;
    });
  }, [places, selectedPlaceId, onSelectPlace, onOpenDetails]);

  return (
    <div className="relative h-full min-h-[240px] w-full overflow-hidden rounded-xl">
      <div ref={hostRef} className="h-full w-full" role="presentation" />
      <p className="pointer-events-none absolute bottom-2 left-2 z-[1] max-w-[min(100%-1rem,20rem)] rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] px-2.5 py-1.5 text-[11px] text-[var(--muted)] shadow-sm">
        Google Maps basemap · tap map to set center · pins open details · ©
        Google
      </p>
    </div>
  );
}
