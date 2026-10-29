export type BestTimeInput = { name: string; address: string; lat: number; lng: number };
export type BestTimeIdentity = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceM: number;
  nameSimilarity: number;
  /** Never attribute data to the OSM row without a separate acknowledgement when weak. */
  confidence: "strong" | "weak";
};
export type BestTimeDay = { day: number; hours: number[] };
export type BestTimeForecast = { kind: "forecast"; identity: BestTimeIdentity; days: BestTimeDay[] };
export type BestTimeLive = {
  kind: "live";
  identity: BestTimeIdentity;
  available: boolean;
  busyness?: number;
  forecastBusyness?: number;
};
export type BestTimeResponse =
  | { status: "ok"; result: BestTimeForecast | BestTimeLive }
  | { status: "error" | "unavailable"; message: string };
