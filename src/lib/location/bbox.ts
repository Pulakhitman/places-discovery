import type { NominatimBBox } from "@/lib/search/categories";
import { isNominatimBBox } from "@/lib/search/categories";
import type { GeocodeResult } from "./types";

export type DivisionLevel = "country" | "region" | "county" | "city";

/** Approximate search box radius when CSC lists have no Nominatim polygon. */
export const DIVISION_BBOX_RADIUS_KM: Record<DivisionLevel, number> = {
  city: 10,
  county: 30,
  region: 55,
  country: 55,
};

/**
 * Build a Nominatim-order bbox [south, north, west, east] around a point.
 */
export function bboxFromCenter(
  lat: number,
  lng: number,
  radiusKm: number,
): NominatimBBox {
  const r = Math.max(radiusKm, 0.5);
  const latDelta = r / 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const lngDelta = r / (111.32 * Math.max(Math.abs(cos), 0.2));
  const south = Math.max(-90, lat - latDelta);
  const north = Math.min(90, lat + latDelta);
  const west = Math.max(-180, lng - lngDelta);
  const east = Math.min(180, lng + lngDelta);
  return [south, north, west, east];
}

export function ensureBoundingBox(
  result: GeocodeResult,
  level: DivisionLevel,
): GeocodeResult {
  if (isNominatimBBox(result.boundingBox)) {
    return result;
  }
  if (!Number.isFinite(result.lat) || !Number.isFinite(result.lng)) {
    return result;
  }
  return {
    ...result,
    boundingBox: bboxFromCenter(
      result.lat,
      result.lng,
      DIVISION_BBOX_RADIUS_KM[level],
    ),
  };
}
