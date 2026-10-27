export const PLACE_CATEGORIES = [
  { id: "parks", label: "Parks & gardens" },
  { id: "playgrounds", label: "Playgrounds" },
  { id: "shops", label: "Shops" },
  { id: "supermarkets", label: "Supermarkets" },
  { id: "cafes", label: "Cafés" },
  { id: "restaurants", label: "Restaurants" },
  { id: "libraries", label: "Libraries" },
  { id: "schools", label: "Schools" },
  { id: "custom", label: "Custom keyword" },
] as const;

export type PlaceCategoryId = (typeof PLACE_CATEGORIES)[number]["id"];

export const SEARCH_RADII_KM = [1, 2, 5, 10, 25] as const;

export type SearchRadiusKm = (typeof SEARCH_RADII_KM)[number];

/** Radius around map center, or the selected location’s Nominatim bounding box. */
export const SEARCH_MODES = [
  { id: "radius", label: "Radius from center" },
  { id: "area", label: "Selected area" },
] as const;

export type SearchMode = (typeof SEARCH_MODES)[number]["id"];

export function isSearchMode(value: unknown): value is SearchMode {
  return value === "radius" || value === "area";
}

/** Nominatim order: south, north, west, east */
export type NominatimBBox = [number, number, number, number];

/** Soft Overpass safety cap — very large admin boxes time out. */
export const MAX_AREA_SPAN_KM = 120;

export function isNominatimBBox(value: unknown): value is NominatimBBox {
  if (!Array.isArray(value) || value.length !== 4) {
    return false;
  }
  const [south, north, west, east] = value.map(Number);
  if (![south, north, west, east].every((n) => Number.isFinite(n))) {
    return false;
  }
  if (south < -90 || north > 90 || south >= north) {
    return false;
  }
  if (west < -180 || east > 180 || west >= east) {
    return false;
  }
  return true;
}

export function bboxSpanKm(bbox: NominatimBBox): {
  latKm: number;
  lngKm: number;
} {
  const [south, north, west, east] = bbox;
  const midLat = (south + north) / 2;
  const latKm = Math.abs(north - south) * 111.32;
  const lngKm =
    Math.abs(east - west) * 111.32 * Math.cos((midLat * Math.PI) / 180);
  return { latKm, lngKm };
}

export function isBBoxWithinSearchLimit(bbox: NominatimBBox): boolean {
  const { latKm, lngKm } = bboxSpanKm(bbox);
  return latKm <= MAX_AREA_SPAN_KM && lngKm <= MAX_AREA_SPAN_KM;
}

export function bboxCenter(bbox: NominatimBBox): { lat: number; lng: number } {
  const [south, north, west, east] = bbox;
  return { lat: (south + north) / 2, lng: (west + east) / 2 };
}
