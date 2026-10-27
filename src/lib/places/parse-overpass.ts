import type { PlaceCategoryId } from "@/lib/search/categories";
import { categoryLabel } from "@/lib/search/overpass-queries";
import type { OsmPlace } from "./types";

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function elementCoords(
  el: OverpassElement,
): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

function formatAddress(tags: Record<string, string>): string | undefined {
  const full = tags["addr:full"]?.trim();
  if (full) {
    return full;
  }
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
    tags["addr:postcode"],
  ]
    .map((p) => p?.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(", ");
}

function pickWebsite(tags: Record<string, string>): string | undefined {
  return (
    tags.website?.trim() ||
    tags["contact:website"]?.trim() ||
    tags.url?.trim() ||
    undefined
  );
}

function pickPhone(tags: Record<string, string>): string | undefined {
  return (
    tags.phone?.trim() ||
    tags["contact:phone"]?.trim() ||
    tags["contact:mobile"]?.trim() ||
    undefined
  );
}

function pickHours(tags: Record<string, string>): string | undefined {
  return tags.opening_hours?.trim() || undefined;
}

function pickName(tags: Record<string, string>, fallback: string): string {
  return (
    tags.name?.trim() ||
    tags["name:en"]?.trim() ||
    tags.brand?.trim() ||
    tags.operator?.trim() ||
    fallback
  );
}

/**
 * Map Overpass elements to OsmPlace records. Drops elements without coordinates.
 * Sorted by distance ascending. Never invents ratings/reviews.
 */
export function parseOverpassElements(
  elements: OverpassElement[],
  params: {
    center: { lat: number; lng: number };
    categoryId: PlaceCategoryId;
  },
): OsmPlace[] {
  const places: OsmPlace[] = [];
  const seen = new Set<string>();

  for (const el of elements) {
    const coords = elementCoords(el);
    if (!coords) {
      continue;
    }
    const id = `osm:${el.type}/${el.id}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    const tags = el.tags ?? {};
    const distanceM = Math.round(
      haversineM(params.center.lat, params.center.lng, coords.lat, coords.lng),
    );

    places.push({
      id,
      osmType: el.type,
      osmId: el.id,
      name: pickName(tags, `${el.type}/${el.id}`),
      categoryId: params.categoryId,
      categoryLabel: categoryLabel(params.categoryId),
      lat: coords.lat,
      lng: coords.lng,
      distanceM,
      address: formatAddress(tags),
      hours: pickHours(tags),
      website: pickWebsite(tags),
      phone: pickPhone(tags),
      tags,
      sources: { osm: true },
    });
  }

  places.sort((a, b) => a.distanceM - b.distanceM);
  return places;
}
