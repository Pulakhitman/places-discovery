import { NextResponse } from "next/server";
import { computeOsmCoverage } from "@/lib/places/coverage";
import type {
  PlacesSearchErrorBody,
  PlacesSearchSuccess,
} from "@/lib/places/types";
import { OverpassError, searchOverpass } from "@/lib/providers/overpass";
import {
  categoryLabel,
  isPlaceCategoryId,
  isSearchRadiusKm,
} from "@/lib/search/overpass-queries";

const ATTRIBUTION =
  "© OpenStreetMap contributors";
const LICENSE = "ODbL";

/**
 * POST /api/places/search
 * Body: { lat, lng, radiusKm, category, customKeyword? }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400, false);
  }

  const payload = body as Record<string, unknown>;
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  const radiusKm = Number(payload.radiusKm);
  const categoryRaw = String(payload.category ?? "");
  const customKeyword =
    typeof payload.customKeyword === "string"
      ? payload.customKeyword
      : undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return errorResponse("lat and lng are required numbers.", 400, false);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return errorResponse("lat/lng out of range.", 400, false);
  }
  if (!isSearchRadiusKm(radiusKm)) {
    return errorResponse(
      "radiusKm must be one of 1, 2, 5, 10, or 25.",
      400,
      false,
    );
  }
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

  const searchedAt = new Date().toISOString();

  try {
    const places = await searchOverpass({
      lat,
      lng,
      radiusM: radiusKm * 1000,
      category: categoryRaw,
      customKeyword,
      signal: request.signal,
    });

    const coverage = computeOsmCoverage(places);
    const response: PlacesSearchSuccess = {
      status: places.length === 0 ? "empty" : "ok",
      places,
      coverage,
      meta: {
        category: categoryRaw,
        categoryLabel: categoryLabel(categoryRaw),
        radiusKm,
        center: { lat, lng },
        searchedAt,
        source: "overpass",
        attribution: ATTRIBUTION,
        license: LICENSE,
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
