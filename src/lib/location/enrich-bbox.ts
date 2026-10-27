import { ensureBoundingBox, type DivisionLevel } from "./bbox";
import type { GeocodeResult } from "./types";

type GeocodeSearchResponse = {
  status?: string;
  results?: GeocodeResult[];
};

/**
 * Try Nominatim for a real admin bbox; fall back to the CSC synthetic box.
 * Never blocks selection — callers apply the first result immediately.
 */
export async function enrichGeocodeBoundingBox(params: {
  result: GeocodeResult;
  level: DivisionLevel;
  countryCode?: string;
  signal?: AbortSignal;
}): Promise<GeocodeResult> {
  const fallback = ensureBoundingBox(params.result, params.level);
  const q = params.result.displayName?.trim();
  if (!q) {
    return fallback;
  }

  const search = new URLSearchParams({ q });
  if (params.countryCode) {
    search.set("country", params.countryCode);
  }
  if (params.level === "region" || params.level === "city") {
    search.set("level", params.level);
  }

  try {
    const res = await fetch(`/api/geocode/search?${search.toString()}`, {
      signal: params.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return fallback;
    }
    const data = (await res.json()) as GeocodeSearchResponse;
    const hit = (data.results ?? []).find((r) => r.boundingBox);
    if (!hit?.boundingBox) {
      return fallback;
    }
    return {
      ...fallback,
      // Keep CSC id/adminCode; prefer Nominatim display + coords + bbox.
      displayName: hit.displayName || fallback.displayName,
      lat: hit.lat,
      lng: hit.lng,
      boundingBox: hit.boundingBox,
      type: hit.type ?? fallback.type,
    };
  } catch {
    return fallback;
  }
}
