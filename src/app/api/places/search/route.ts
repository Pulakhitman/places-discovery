import { NextResponse } from "next/server";
import { computeOsmCoverage } from "@/lib/places/coverage";
import {
  googleDetailsToPlace,
  mergePlaceSources,
} from "@/lib/places/google-to-place";
import { haversineMeters } from "@/lib/places/google-match";
import {
  isSearchSource,
  type OsmPlace,
  type PlacesSearchErrorBody,
  type PlacesSearchSuccess,
  type SearchSource,
} from "@/lib/places/types";
import { OverpassError, searchOverpass } from "@/lib/providers/overpass";
import {
  GooglePlacesError,
  isGooglePlacesConfigured,
  searchGoogleNearby,
} from "@/lib/providers/google-places";
import {
  bboxCenter,
  bboxSpanKm,
  isBBoxWithinSearchLimit,
  isNominatimBBox,
  isSearchMode,
  MAX_AREA_SPAN_KM,
  type NominatimBBox,
  type SearchMode,
  type SearchRadiusKm,
} from "@/lib/search/categories";
import {
  categoryLabel,
  isPlaceCategoryId,
  isSearchRadiusKm,
} from "@/lib/search/overpass-queries";

const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
const OSM_LICENSE = "ODbL";
const GOOGLE_ATTRIBUTION = "Google Maps";
const GOOGLE_LICENSE = "Google Maps Platform Terms of Service";

/** Google Nearby Search is circle-only; cover an area bbox with a circle. */
function bboxRadiusM(bbox: NominatimBBox): number {
  const [south, north, west, east] = bbox;
  const midLat = (south + north) / 2;
  const halfLat = haversineMeters(south, west, north, west) / 2;
  const halfLng = haversineMeters(midLat, west, midLat, east) / 2;
  return Math.min(Math.hypot(halfLat, halfLng), 50_000);
}

/**
 * POST /api/places/search
 * Body:
 * - radius mode (default): { mode?: "radius", lat, lng, radiusKm, category, customKeyword?, source? }
 * - area mode: { mode: "area", bbox: [south,north,west,east], category, customKeyword?, lat?, lng?, source? }
 *
 * `source` is "osm" (default), "google", or "both" (merged, Google wins ties).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400, false);
  }

  const payload = body as Record<string, unknown>;
  const modeRaw = payload.mode ?? "radius";
  if (!isSearchMode(modeRaw)) {
    return errorResponse('mode must be "radius" or "area".', 400, false);
  }
  const mode: SearchMode = modeRaw;

  const sourceRaw = payload.source ?? "osm";
  if (!isSearchSource(sourceRaw)) {
    return errorResponse(
      'source must be "osm", "google", or "both".',
      400,
      false,
    );
  }
  const source: SearchSource = sourceRaw;

  const categoryRaw = String(payload.category ?? "");
  const customKeyword =
    typeof payload.customKeyword === "string"
      ? payload.customKeyword
      : undefined;

  if (!isPlaceCategoryId(categoryRaw)) {
    return errorResponse("Unknown category.", 400, false);
  }
  if (categoryRaw === "custom" && !customKeyword?.trim()) {
    return errorResponse(
      "customKeyword is required when category is custom.",
      400,
      false,
    );
  }

  if (source !== "osm" && !isGooglePlacesConfigured()) {
    return errorResponse(
      "Google search needs GOOGLE_MAPS_API_KEY. Add it to .env or search OpenStreetMap only.",
      503,
      false,
    );
  }

  const searchedAt = new Date().toISOString();

  let lat: number;
  let lng: number;
  let radiusKm: SearchRadiusKm | null = null;
  let bbox: NominatimBBox | null = null;
  let radiusM: number;

  if (mode === "area") {
    if (!isNominatimBBox(payload.bbox)) {
      return errorResponse(
        "bbox [south, north, west, east] is required for area search.",
        400,
        false,
      );
    }
    bbox = payload.bbox;
    if (!isBBoxWithinSearchLimit(bbox)) {
      const span = bboxSpanKm(bbox);
      return errorResponse(
        `Selected area is too large for Overpass (about ${Math.round(span.latKm)}×${Math.round(span.lngKm)} km). Pick a city/county under ~${MAX_AREA_SPAN_KM} km, or use radius search.`,
        400,
        false,
      );
    }
    const center = bboxCenter(bbox);
    lat =
      Number.isFinite(Number(payload.lat)) && Number(payload.lat) >= -90
        ? Number(payload.lat)
        : center.lat;
    lng =
      Number.isFinite(Number(payload.lng)) && Number(payload.lng) >= -180
        ? Number(payload.lng)
        : center.lng;
    radiusM = bboxRadiusM(bbox);
  } else {
    lat = Number(payload.lat);
    lng = Number(payload.lng);
    const radiusKmRaw = Number(payload.radiusKm);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return errorResponse("lat and lng are required numbers.", 400, false);
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return errorResponse("lat/lng out of range.", 400, false);
    }
    if (!isSearchRadiusKm(radiusKmRaw)) {
      return errorResponse(
        "radiusKm must be one of 1, 2, 5, 10, or 25.",
        400,
        false,
      );
    }
    radiusKm = radiusKmRaw;
    radiusM = radiusKmRaw * 1000;
  }

  const runOsm = source === "osm" || source === "both";
  const runGoogle = source === "google" || source === "both";

  try {
    let osmPlaces: OsmPlace[] = [];
    let googlePlaces: OsmPlace[] = [];

    if (runOsm) {
      osmPlaces =
        mode === "area" && bbox
          ? await searchOverpass({
              mode: "area",
              bbox,
              lat,
              lng,
              category: categoryRaw,
              customKeyword,
            })
          : await searchOverpass({
              lat,
              lng,
              radiusM,
              category: categoryRaw,
              customKeyword,
            });
    }

    if (runGoogle) {
      const details = await searchGoogleNearby({
        lat,
        lng,
        radiusM,
        category: categoryRaw,
        customKeyword,
        maxResultCount: 20,
      });
      googlePlaces = details.map((d) =>
        googleDetailsToPlace(d, {
          center: { lat, lng },
          categoryId: categoryRaw,
          categoryLabel: categoryLabel(categoryRaw),
        }),
      );
    }

    const places =
      source === "both"
        ? mergePlaceSources(googlePlaces, osmPlaces)
        : source === "google"
          ? googlePlaces.sort((a, b) => a.distanceM - b.distanceM)
          : osmPlaces;

    const coverage = computeOsmCoverage(places);
    const response: PlacesSearchSuccess = {
      status: places.length === 0 ? "empty" : "ok",
      places,
      coverage,
      meta: {
        category: categoryRaw,
        categoryLabel: categoryLabel(categoryRaw),
        mode,
        radiusKm,
        bbox,
        center: { lat, lng },
        searchedAt,
        source:
          source === "both" ? "both" : source === "google" ? "google" : "overpass",
        attribution:
          source === "osm"
            ? OSM_ATTRIBUTION
            : source === "google"
              ? GOOGLE_ATTRIBUTION
              : `${OSM_ATTRIBUTION} · ${GOOGLE_ATTRIBUTION}`,
        license:
          source === "osm"
            ? OSM_LICENSE
            : source === "google"
              ? GOOGLE_LICENSE
              : `${OSM_LICENSE} + ${GOOGLE_LICENSE}`,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof OverpassError) {
      if (err.kind === "rate_limited") {
        const bodyErr: PlacesSearchErrorBody = {
          status: "rate_limited",
          places: [],
          message: err.message,
          retryable: true,
          retryAfterSec: err.retryAfterSec,
        };
        return NextResponse.json(bodyErr, {
          status: 429,
          headers: err.retryAfterSec
            ? { "Retry-After": String(err.retryAfterSec) }
            : undefined,
        });
      }

      const status = err.kind === "timeout" ? 504 : 502;
      return errorResponse(err.message, status, true);
    }

    if (err instanceof GooglePlacesError) {
      const status =
        err.kind === "rate_limited"
          ? 429
          : err.kind === "timeout"
            ? 504
            : err.kind === "not_configured"
              ? 503
              : 502;
      return errorResponse(err.message, status, err.kind !== "parse");
    }

    return errorResponse("Place search failed.", 502, true);
  }
}

function errorResponse(
  message: string,
  status: number,
  retryable: boolean,
) {
  const body: PlacesSearchErrorBody = {
    status: "error",
    places: [],
    message,
    retryable,
  };
  return NextResponse.json(body, { status });
}
