import type { PlaceCategoryId, SearchRadiusKm } from "@/lib/search/categories";
import { PLACE_CATEGORIES, SEARCH_RADII_KM } from "@/lib/search/categories";
import type { PlaceSortId } from "./sort";

const STORAGE_KEY = "places-discovery.search-prefs.v1";

export type SearchPrefs = {
  category: PlaceCategoryId;
  radiusKm: SearchRadiusKm;
  sort: PlaceSortId;
};

/** Stable SSR/client defaults — never read localStorage during render. */
export const DEFAULT_SEARCH_PREFS: SearchPrefs = {
  category: "parks",
  radiusKm: 5,
  sort: "distance",
};

const DEFAULTS = DEFAULT_SEARCH_PREFS;

function isCategory(value: unknown): value is PlaceCategoryId {
  return PLACE_CATEGORIES.some((c) => c.id === value);
}

function isRadius(value: unknown): value is SearchRadiusKm {
  return (SEARCH_RADII_KM as readonly number[]).includes(Number(value));
}

function isSort(value: unknown): value is PlaceSortId {
  return value === "distance" || value === "name" || value === "completeness";
}

export function loadSearchPrefs(): SearchPrefs {
  if (typeof window === "undefined") {
    return DEFAULTS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULTS;
    }
    const parsed = JSON.parse(raw) as Partial<SearchPrefs>;
    return {
      category: isCategory(parsed.category) ? parsed.category : DEFAULTS.category,
      radiusKm: isRadius(parsed.radiusKm) ? parsed.radiusKm : DEFAULTS.radiusKm,
      sort: isSort(parsed.sort) ? parsed.sort : DEFAULTS.sort,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSearchPrefs(prefs: SearchPrefs): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}
