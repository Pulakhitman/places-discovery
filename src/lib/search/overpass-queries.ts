import type { PlaceCategoryId } from "./categories";
import { PLACE_CATEGORIES, SEARCH_RADII_KM } from "./categories";

/** Overpass tag filters per category (around center; radius applied in query). */
const CATEGORY_FILTERS: Record<
  Exclude<PlaceCategoryId, "custom">,
  string[]
> = {
  parks: ['["leisure"="park"]', '["leisure"="garden"]'],
  playgrounds: ['["leisure"="playground"]'],
  shops: ['["shop"]'],
  supermarkets: ['["shop"="supermarket"]'],
  cafes: ['["amenity"="cafe"]'],
  restaurants: ['["amenity"="restaurant"]'],
  libraries: ['["amenity"="library"]'],
  schools: ['["amenity"="school"]'],
};

export function isPlaceCategoryId(value: string): value is PlaceCategoryId {
  return PLACE_CATEGORIES.some((c) => c.id === value);
}

export function isSearchRadiusKm(value: number): value is (typeof SEARCH_RADII_KM)[number] {
  return (SEARCH_RADII_KM as readonly number[]).includes(value);
}

export function categoryLabel(id: PlaceCategoryId): string {
  return PLACE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/**
 * Build an Overpass QL query for nearby places.
 * Radius is in meters. Custom uses name/amenity regex from keyword.
 */
export function buildOverpassQuery(params: {
  lat: number;
  lng: number;
  radiusM: number;
  category: PlaceCategoryId;
  customKeyword?: string;
}): string {
  const { lat, lng, radiusM, category } = params;
  const around = `(around:${Math.round(radiusM)},${lat},${lng})`;

  let filters: string[];
  if (category === "custom") {
    const kw = (params.customKeyword ?? "").trim();
    if (!kw) {
      throw new Error("Custom keyword is required for custom category.");
    }
    const escaped = kw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    filters = [
      `["name"~"${escaped}",i]`,
      `["amenity"~"${escaped}",i]`,
      `["shop"~"${escaped}",i]`,
      `["leisure"~"${escaped}",i]`,
    ];
  } else {
    filters = CATEGORY_FILTERS[category];
  }

  // `nwr` matches nodes, ways, and relations in one clause (lighter than 3×).
  const clauses = filters.map((f) => `nwr${f}${around};`).join("\n  ");

  return `
[out:json][timeout:60];
(
  ${clauses}
);
out center tags;
`.trim();
}
