"use client";

import { useEffect, useRef, useState } from "react";
import type { MapCenter } from "@/lib/location/types";
import type { OsmPlace } from "@/lib/places/types";
import {
  categoryMarkerHtml,
  type CategoryMarkerVariant,
} from "@/lib/search/category-marker-html";
import type { PlaceCategoryId } from "@/lib/search/categories";
import type { MapPlaceholderPin } from "@/lib/search/placeholders";

type Props = {
  apiKey: string;
  center: MapCenter;
  zoom: number;
  radiusKm: number;
  searchMode: "radius" | "area";
  boundingBox?: [number, number, number, number];
  places: OsmPlace[];
  placeholders?: MapPlaceholderPin[];
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
    Circle: new (opts: Record<string, unknown>) => GoogleMapOverlay;
    Rectangle: new (opts: Record<string, unknown>) => GoogleMapOverlay;
    OverlayView: {
      new (): GoogleOverlayView;
      preventMapHitsAndGesturesFrom: (element: Element) => void;
    };
    event: {
      addListener: (t: unknown, name: string, fn: (...args: unknown[]) => void) => void;
      clearInstanceListeners: (t: unknown) => void;
    };
  };
};

type GoogleMap = {
  setCenter: (c: { lat: number; lng: number }) => void;
  panTo: (c: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
  getCenter: () => { lat: () => number; lng: () => number } | undefined;
  getZoom: () => number | undefined;
  fitBounds: (b: unknown, padding?: number) => void;
};

type GoogleMapOverlay = {
  setMap: (m: GoogleMap | null) => void;
};

type GoogleOverlayView = GoogleMapOverlay & {
  onAdd: () => void;
  draw: () => void;
  onRemove: () => void;
  getPanes: () => {
    markerLayer: HTMLElement;
    overlayMouseTarget: HTMLElement;
  } | null;
  getProjection: () => {
    fromLatLngToDivPixel: (position: MapCenter) => {
      x: number;
      y: number;
    } | null;
  } | null;
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

/** Share the OSM pin markup without requiring an Advanced Marker map ID. */
function createCategoryMarker(
  g: GoogleMapsNs,
  map: GoogleMap,
  {
    position,
    category,
    title,
    variant,
    onSelect,
  }: {
    position: MapCenter;
    category: PlaceCategoryId;
    title: string;
    variant: CategoryMarkerVariant;
    onSelect?: () => void;
  },
): GoogleOverlayView {
  const overlay = new g.maps.OverlayView();
  const placeholder = variant === "placeholder";
  const active = variant === "result-active";
  const permanent = placeholder || active;
  let element: HTMLDivElement | HTMLButtonElement | null = null;

  overlay.onAdd = () => {
    const node = document.createElement(placeholder ? "div" : "button");
    const size = active ? 36 : 30;
    node.className =
      "map-ph-marker absolute rounded-full p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.transform = "translate(-50%, -50%)";
    node.style.zIndex = String(placeholder ? 200 : active ? 800 : 400);
    node.style.pointerEvents = placeholder ? "none" : "auto";
    node.style.cursor = placeholder ? "default" : "pointer";
    node.style.display = "none";
    // Only static category markup is HTML; provider names stay plain text.
    node.innerHTML = categoryMarkerHtml(category, variant);

    const tooltip = document.createElement("span");
    tooltip.setAttribute("role", "tooltip");
    tooltip.className = `map-tip pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[0.4rem] border bg-[color-mix(in_oklab,var(--surface)_96%,transparent)] px-[0.45rem] py-1 text-[11px] leading-normal shadow-[0_2px_8px_rgba(28,25,20,0.14)] ${
      placeholder
        ? "map-tip--sample border-[var(--line)] font-medium text-[var(--muted)]"
        : active
          ? "map-tip--active border-[#0f766e] font-semibold text-[#0f766e]"
          : "border-[var(--line)] font-semibold text-[var(--ink)]"
    }`;
    tooltip.textContent = title;
    tooltip.hidden = !permanent;
    if (placeholder) {
      const sample = document.createElement("span");
      sample.className = "map-tip__muted";
      sample.textContent = " · sample";
      tooltip.appendChild(sample);
    } else if (node instanceof HTMLButtonElement) {
      node.type = "button";
      node.title = title;
      node.setAttribute("aria-label", title);
      node.setAttribute("aria-pressed", String(active));
      node.onclick = (event) => {
        event.stopPropagation();
        onSelect?.();
      };
      node.onmouseenter = node.onfocus = () => {
        tooltip.hidden = false;
      };
      node.onmouseleave = node.onblur = () => {
        tooltip.hidden = !permanent;
      };
      g.maps.OverlayView.preventMapHitsAndGesturesFrom(node);
    }
    node.appendChild(tooltip);
    const panes = overlay.getPanes();
    (placeholder ? panes?.markerLayer : panes?.overlayMouseTarget)?.appendChild(
      node,
    );
    element = node;
  };
  overlay.draw = () => {
    const pixel = overlay.getProjection()?.fromLatLngToDivPixel(position);
    if (!element) {
      return;
    }
    element.style.display = pixel ? "block" : "none";
    if (pixel) {
      element.style.left = `${pixel.x}px`;
      element.style.top = `${pixel.y}px`;
    }
  };
  overlay.onRemove = () => {
    if (element) {
      element.onclick = element.onmouseenter = element.onmouseleave = null;
      element.onfocus = element.onblur = null;
      element.remove();
      element = null;
    }
  };
  overlay.setMap(map);
  return overlay;
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
  placeholders = [],
  selectedPlaceId,
  onCenterChange,
  onSelectPlace,
  onOpenDetails,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<{
    apiKey: string;
    map: GoogleMap;
    google: GoogleMapsNs;
  } | null>(null);
  const instance = mapInstance?.apiKey === apiKey ? mapInstance : null;
  const showPlaceholders = places.length === 0 && placeholders.length > 0;
  const selectedPlace = places.find((p) => p.id === selectedPlaceId) ?? null;
  const [loadError, setLoadError] = useState(false);
  const onCenterChangeRef = useRef(onCenterChange);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    let cancelled = false;
    let createdMap: GoogleMap | null = null;
    let google: GoogleMapsNs | null = null;
    const host = hostRef.current;
    if (!host) {
      return;
    }

    void loadGoogleMaps(apiKey)
      .then((g) => {
        if (cancelled || !hostRef.current) {
          return;
        }
        const map = new g.maps.Map(host, {
          center,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        createdMap = map;
        google = g;
        g.maps.event.addListener(map, "click", (e: unknown) => {
          const ev = e as { latLng?: { lat: () => number; lng: () => number } };
          const ll = ev.latLng;
          if (!ll) {
            return;
          }
          onCenterChangeRef.current({ lat: ll.lat(), lng: ll.lng() });
        });
        // Trigger reactive overlays even when the Maps script loads later.
        setMapInstance({ apiKey, map, google: g });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      if (createdMap && google) {
        google.maps.event.clearInstanceListeners(createdMap);
        host.replaceChildren();
      }
    };
    // Create once per key; reactive props synchronize after the map is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (!instance) {
      return;
    }
    const { map, google: g } = instance;
    map.setCenter(center);
    map.setZoom(zoom);
    if (boundingBox && searchMode === "area") {
      const [south, north, west, east] = boundingBox;
      map.fitBounds({ south, north, west, east }, 24);
    } else if (places.length === 0) {
      // Match Leaflet's fit-to-radius behavior so placeholder pins stay in view.
      const latDelta = (radiusKm * 1000) / 111_320;
      const cos = Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
      const lngDelta = latDelta / cos;
      map.fitBounds({
        south: Math.max(-90, center.lat - latDelta),
        north: Math.min(90, center.lat + latDelta),
        west: Math.max(-180, center.lng - lngDelta),
        east: Math.min(180, center.lng + lngDelta),
      }, 40);
    }

    let overlay: GoogleMapOverlay;
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
      overlay = rect;
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
      overlay = circle;
    }
    return () => overlay.setMap(null);
  }, [instance, center, zoom, radiusKm, searchMode, boundingBox, places.length]);

  useEffect(() => {
    if (!instance) {
      return;
    }
    const { map, google: g } = instance;
    const markers = showPlaceholders
      ? placeholders.map((pin) =>
          createCategoryMarker(g, map, {
            position: { lat: pin.lat, lng: pin.lng },
            category: pin.category,
            title: pin.title,
            variant: "placeholder",
          }),
        )
      : places.map((place) =>
          createCategoryMarker(g, map, {
            position: { lat: place.lat, lng: place.lng },
            category: place.categoryId,
            title: place.name,
            variant: place.id === selectedPlaceId ? "result-active" : "result",
            onSelect: () => onSelectPlace?.(place.id),
          }),
        );
    return () => markers.forEach((marker) => marker.setMap(null));
  }, [instance, places, placeholders, showPlaceholders, selectedPlaceId, onSelectPlace]);

  useEffect(() => {
    if (instance && selectedPlace) {
      instance.map.panTo({ lat: selectedPlace.lat, lng: selectedPlace.lng });
    }
  }, [instance, selectedPlace]);

  return (
    <div
      className="relative h-full min-h-[240px] w-full overflow-hidden rounded-xl"
      role="region"
      aria-label="Map workspace"
    >
      <div ref={hostRef} className="h-full w-full" role="presentation" />
      {loadError && (
        <div role="alert" className="absolute inset-x-3 top-14 z-[1100] rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--danger)] shadow-md">
          Google Maps could not load. Check your browser key and allowed website referrers, or switch to OSM above.
        </div>
      )}
      {selectedPlace && (
        <div className="pointer-events-auto absolute left-2 right-14 top-12 z-[1100] flex max-w-md items-start gap-2 rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] px-3 py-2 shadow-md backdrop-blur-sm">
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
      <p className="pointer-events-none absolute bottom-8 left-2 z-[1] max-w-[min(100%-1rem,20rem)] rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] px-2.5 py-1.5 text-[11px] text-[var(--muted)] shadow-sm">
        Google Maps basemap ·{" "}
        {showPlaceholders ? (
          <>Dashed icons = sample {placeholders[0]?.category ?? "places"} · </>
        ) : places.length > 0 ? (
          <>Category icons = places ({places.length}) · tap a pin to select · </>
        ) : null}
        tap map to set center ·{" "}
        {searchMode === "area" ? "selected area" : `${radiusKm} km radius`} · © Google
      </p>
    </div>
  );
}
