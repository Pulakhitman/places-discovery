import type {
  NominatimBBox,
  PlaceCategoryId,
  SearchMode,
  SearchRadiusKm,
} from "@/lib/search/categories";

export type PlaceSource = "osm";

export type OsmPlace = {
  id: string;
  osmType: "node" | "way" | "relation";
  osmId: number;
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
  sources: { osm: true };
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
    source: "overpass";
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
