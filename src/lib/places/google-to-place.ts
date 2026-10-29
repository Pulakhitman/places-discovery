/**
 * Adapt official Google Places (New) details into the app's result shape.
 * Google rows are display-only: `source: "google"` keeps them out of OSM
 * exports, which must stay ODbL-clean.
 */

import { haversineMeters, nameSimilarity } from "./google-match";
import type { GooglePlaceDetails } from "./google-types";
import type { OsmPlace } from "./types";
import type { PlaceCategoryId } from "@/lib/search/categories";

export function googleDetailsToPlace(
  details: GooglePlaceDetails,
  params: {
    center: { lat: number; lng: number };
    categoryId: PlaceCategoryId;
    categoryLabel: string;
  },
): OsmPlace {
  const hours =
    details.attributes?.currentHoursWeekday?.join("; ") ??
    details.hoursWeekday?.join("; ");

  return {
    id: `google:${details.placeId}`,
    source: "google",
    googlePlaceId: details.placeId,
    name: details.name,
    // Google only returns named businesses, so these are never synthesized.
    isUnnamed: false,
    categoryId: params.categoryId,
    categoryLabel: params.categoryLabel,
    lat: details.lat,
    lng: details.lng,
    distanceM: Math.round(
      haversineMeters(
        params.center.lat,
        params.center.lng,
        details.lat,
        details.lng,
      ),
    ),
    address: details.address,
    hours,
    website: details.website,
    phone: details.phone,
    tags: {},
    sources: { google: true },
  };
}

/** Merge duplicate Google and OSM results without ever mixing their fields. */
export function mergePlaceSources(
  google: OsmPlace[],
  osm: OsmPlace[],
  opts?: { maxDistanceM?: number; minNameSimilarity?: number },
): OsmPlace[] {
  const maxDistanceM = opts?.maxDistanceM ?? 80;
  const minNameSimilarity = opts?.minNameSimilarity ?? 0.6;
  const remaining = new Set(osm);
  const matches = new Map<OsmPlace, OsmPlace[]>();
  const candidatesFor = (g: OsmPlace) => osm.filter((o) => {
    const id = /^osm:(node|way|relation)\/(\d+)$/.exec(o.id);
    return o.source === "osm" && o.sources.osm === true && !o.sources.google &&
      o.googlePlaceId === undefined && !o.matchedOsm &&
      id !== null && o.osmType === id[1] && o.osmId === Number(id[2]) &&
      !o.isUnnamed && !g.isUnnamed &&
      haversineMeters(g.lat, g.lng, o.lat, o.lng) <= maxDistanceM &&
      nameSimilarity(g.name, o.name) >= minNameSimilarity;
  });
  for (const g of google) {
    if (g.source === "google") matches.set(g, candidatesFor(g));
  }
  const merged = google.map((g) => {
    if (g.source !== "google") return g;
    const candidates = matches.get(g) ?? [];
    // Never attribute an OSM identity to either Google result if two are plausible.
    if (candidates.length !== 1) return g;
    const match = candidates[0];
    if (!remaining.has(match) ||
      [...matches.values()].filter((other) => other.includes(match)).length !== 1) return g;
    remaining.delete(match);
    const { matchedOsm: _ignored, ...originalOsm } = match;
    void _ignored;
    return {
      ...g,
      sources: { google: true as const, osm: true as const },
      matchedOsm: { ...originalOsm, tags: { ...originalOsm.tags }, sources: { osm: true as const } },
    };
  });
  return [...merged, ...remaining].sort((a, b) => a.distanceM - b.distanceM);
}
