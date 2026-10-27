import type { OsmPlace } from "./types";

export type ResultFilters = {
  namedOnly: boolean;
  hasAddress: boolean;
  hasHours: boolean;
  hasWebsite: boolean;
  hasPhone: boolean;
  /** Inclusive max distance in meters; null = no limit. */
  maxDistanceM: number | null;
};

export const DEFAULT_RESULT_FILTERS: ResultFilters = {
  namedOnly: false,
  hasAddress: false,
  hasHours: false,
  hasWebsite: false,
  hasPhone: false,
  maxDistanceM: null,
};

export function filterPlaces(
  places: OsmPlace[],
  filters: ResultFilters,
): OsmPlace[] {
  return places.filter((place) => {
    if (filters.namedOnly && place.isUnnamed) {
      return false;
    }
    if (filters.hasAddress && !place.address) {
      return false;
    }
    if (filters.hasHours && !place.hours) {
      return false;
    }
    if (filters.hasWebsite && !place.website) {
      return false;
    }
    if (filters.hasPhone && !place.phone) {
      return false;
    }
    if (
      filters.maxDistanceM !== null &&
      place.distanceM > filters.maxDistanceM
    ) {
      return false;
    }
    return true;
  });
}

export function activeFilterCount(filters: ResultFilters): number {
  let n = 0;
  if (filters.namedOnly) {
    n += 1;
  }
  if (filters.hasAddress) {
    n += 1;
  }
  if (filters.hasHours) {
    n += 1;
  }
  if (filters.hasWebsite) {
    n += 1;
  }
  if (filters.hasPhone) {
    n += 1;
  }
  if (filters.maxDistanceM !== null) {
    n += 1;
  }
  return n;
}
