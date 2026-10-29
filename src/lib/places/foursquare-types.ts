/** Display-only Foursquare data. Never join these records into export/search rows. */
export type FoursquarePlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  link: string;
  categories: string[];
  chains: string[];
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  social?: { facebook?: string; instagram?: string; twitter?: string };
  description?: string;
  rating?: number;
  popularity?: number;
  price?: number;
  hours?: { display?: string; openNow?: boolean; regular: FoursquareTimeWindow[] };
  popularWindows?: FoursquareTimeWindow[];
  tags?: string[];
  stats?: { ratings?: number; tips?: number; photos?: number };
  menu?: string;
  actions?: { label: string; url: string }[];
  tastes?: string[];
  tips?: string[];
  veracity?: number;
};

/** Popular windows are intervals, NOT hourly traffic measurements. */
export type FoursquareTimeWindow = { day: number; open: string; close: string };

export type FoursquareMatch = {
  place: FoursquarePlace;
  confidence: "strong" | "weak";
  distanceM: number;
  nameSimilarity: number;
};

export type FoursquareResponse =
  | { status: "ok"; match: FoursquareMatch; tier: "pro" | "premium" }
  | { status: "empty" | "unavailable" | "error"; message: string };
