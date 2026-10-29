import type { NominatimBBox, PlaceCategoryId } from "./categories";
import {
  isNominatimBBox,
  PLACE_CATEGORIES,
  SEARCH_RADII_KM,
} from "./categories";

/** Overpass tag filters per category (spatial filter applied separately). */
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

/**
 * Categories where an unnamed OSM feature is almost always noise.
 * Parks/playgrounds are excluded on purpose — plenty of real unnamed green
 * spaces exist, and hiding them would drop legitimate results.
 */
const CATEGORY_REQUIRES_NAME: ReadonlySet<PlaceCategoryId> = new Set([
  "shops",
  "supermarkets",
  "cafes",
  "restaurants",
  "libraries",
  "schools",
]);

/** True when Overpass queries for this category demand an OSM `name` tag. */
export function categoryRequiresName(category: PlaceCategoryId): boolean {
  return category !== "custom" && CATEGORY_REQUIRES_NAME.has(category);
}

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
 * Nominatim bbox [south, north, west, east] → Overpass `(south,west,north,east)`.
 */
export function overpassBBoxFilter(bbox: NominatimBBox): string {
  if (!isNominatimBBox(bbox)) {
    throw new Error("Invalid bounding box.");
  }
  const [south, north, west, east] = bbox;
  return `(${south},${west},${north},${east})`;
}

function categoryFilters(
  category: PlaceCategoryId,
  customKeyword?: string,
): string[] {
  if (category === "custom") {
    const kw = (customKeyword ?? "").trim();
    if (!kw) {
      throw new Error("Custom keyword is required for custom category.");
    }
    const escaped = kw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return [
      `["name"~"${escaped}",i]`,
      `["amenity"~"${escaped}",i]`,
      `["shop"~"${escaped}",i]`,
      `["leisure"~"${escaped}",i]`,
    ];
  }
  return CATEGORY_FILTERS[category];
}

export type BuildOverpassQueryParams = {
  category: PlaceCategoryId;
  customKeyword?: string;
} & (
  | { mode?: "radius"; lat: number; lng: number; radiusM: number; bbox?: never }
  | { mode: "area"; bbox: NominatimBBox; lat?: never; lng?: never; radiusM?: never }
);

/**
 * Build an Overpass QL query for nearby places.
 * Mode `radius`: around a center. Mode `area`: Nominatim bounding box.
 */
export function buildOverpassQuery(params: BuildOverpassQueryParams): string {
  const spatial =
    params.mode === "area"
      ? overpassBBoxFilter(params.bbox)
      : `(around:${Math.round(params.radiusM)},${params.lat},${params.lng})`;

  const filters = categoryFilters(params.category, params.customKeyword);
  const requireName = categoryRequiresName(params.category);

  // `nwr` matches nodes, ways, and relations in one clause (lighter than 3×).
  // `["noname"!="yes"]` drops features OSM explicitly marks as nameless, and
  // business/institution categories additionally require a real `name` tag.
  const clauses = filters
    .map((f) => {
      const nameGuard = requireName ? '["name"]' : "";
      return `nwr${f}${nameGuard}["noname"!="yes"]${spatial};`;
    })
    .join("\n  ");

  return `
[out:json][timeout:60];
(
  ${clauses}
);
out center tags;
`.trim();
}
