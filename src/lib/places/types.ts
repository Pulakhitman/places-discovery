import type {
  NominatimBBox,
  PlaceCategoryId,
  SearchMode,
  SearchRadiusKm,
} from "@/lib/search/categories";

export type PlaceSource = "osm" | "google" | "overture";

/** Which lane a search should run. */
export type SearchSource = "osm" | "google" | "both" | "overture";

export const SEARCH_SOURCES: readonly { id: SearchSource; label: string }[] = [
  { id: "osm", label: "OpenStreetMap" },
  { id: "overture", label: "Overture Places" },
  { id: "google", label: "Google" },
  { id: "both", label: "OSM + Google" },
];

export function isSearchSource(value: unknown): value is SearchSource {
  return value === "osm" || value === "google" || value === "both" || value === "overture";
}

export type OsmPlace = {
  id: string;
  /** Which provider produced this row. */
  source: PlaceSource;
  /** OSM identity — present only when `source` is "osm". */
  osmType?: "node" | "way" | "relation";
  osmId?: number;
  /** Google place id — present only when `source` is "google". */
  googlePlaceId?: string;
  /** Overture identity and upstream provenance; never merged into OSM exports. */
  overture?: {
    id: string;
    release: string;
    taxonomy: string | null;
    basicCategory: string | null;
    confidence: number | null;
    operatingStatus: string | null;
    sources: { dataset: string; license: string | null }[];
  };
  name: string;
  /** True when OSM had no name/brand/operator and we synthesized a label. */
  isUnnamed: boolean;
  categoryId: PlaceCategoryId;
  categoryLabel: string;
  lat: number;
  lng: number;
  distanceM: number;
  address?: string;
  hours?: string;
  website?: string;
  phone?: string;
  tags: Record<string, string>;
  sources: { osm?: true; google?: true; overture?: true };
  /** In Both mode, a separately matched original OSM record. Never copy Google fields into it. */
  matchedOsm?: Omit<OsmPlace, "matchedOsm">;
};

export type FieldCoverage = {
  total: number;
  hoursPct: number;
  websitePct: number;
  phonePct: number;
  addressPct: number;
  namedPct: number;
  withHours: number;
  withWebsite: number;
  withPhone: number;
  withAddress: number;
  withNamed: number;
};

export type PlacesSearchSuccess = {
  status: "ok" | "empty";
  places: OsmPlace[];
  coverage: FieldCoverage;
  meta: {
    category: PlaceCategoryId;
    categoryLabel: string;
    mode: SearchMode;
    /** Set for radius mode; null when searching a selected area. */
    radiusKm: SearchRadiusKm | null;
    /** Nominatim [south, north, west, east] when mode is area. */
    bbox: NominatimBBox | null;
    center: { lat: number; lng: number };
    searchedAt: string;
    /** Which provider produced the rows. */
    source: "overpass" | "google" | "both" | "overture";
    /** Populated only for an imported Overture release. */
    release?: string;
    attribution: string;
    license: string;
  };
};

export type PlacesSearchErrorBody = {
  status: "error" | "rate_limited";
  places: [];
  message: string;
  retryable: boolean;
  retryAfterSec?: number;
};
