export type LocationLevel = "country" | "region" | "county" | "city";

export type CountryOption = {
  code: string;
  name: string;
};

export type GeocodeResult = {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
  boundingBox?: [number, number, number, number];
  type?: string;
  importance?: number;
};

export type LocationSelection = {
  country?: CountryOption;
  region?: GeocodeResult;
  county?: GeocodeResult;
  city?: GeocodeResult;
};

export type MapCenter = {
  lat: number;
  lng: number;
};

export type HierarchySearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty"; query: string }
  | { status: "error"; message: string; retryable: boolean }
  | { status: "rate_limited"; message: string; retryAfterSec?: number }
  | { status: "results"; query: string; results: GeocodeResult[] };
