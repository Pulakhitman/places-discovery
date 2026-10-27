import type { PlaceCategoryId, SearchRadiusKm } from "@/lib/search/categories";

export type PlaceSource = "osm";

export type OsmPlace = {
  id: string;
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
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
  withHours: number;
  withWebsite: number;
  withPhone: number;
  withAddress: number;
};

export type PlacesSearchSuccess = {
  status: "ok" | "empty";
  places: OsmPlace[];
  coverage: FieldCoverage;
  meta: {
    category: PlaceCategoryId;
    categoryLabel: string;
    radiusKm: SearchRadiusKm;
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
