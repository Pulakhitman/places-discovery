import type {
  GeocodeResult,
  LocationLevel,
  LocationSelection,
} from "./types";

const CHILD_LEVELS: Record<LocationLevel, LocationLevel[]> = {
  country: ["region", "county", "city"],
  region: ["county", "city"],
  county: ["city"],
  city: [],
};

/**
 * When a parent level changes, clear all descendant selections.
 * Never copies or auto-picks a child from search results.
 */
export function invalidateChildren(
  selection: LocationSelection,
  changedLevel: LocationLevel,
): LocationSelection {
  const next: LocationSelection = { ...selection };
  for (const level of CHILD_LEVELS[changedLevel]) {
    delete next[level];
  }
  return next;
}

export function setCountry(
  selection: LocationSelection,
  country: LocationSelection["country"] | undefined,
): LocationSelection {
  const withCountry: LocationSelection = country
    ? { ...selection, country }
    : (() => {
        const copy = { ...selection };
        delete copy.country;
        return copy;
      })();
  return invalidateChildren(withCountry, "country");
}

/**
 * Explicitly select a geocode result for a level.
 * Callers must pass a concrete result — never pass results[0] automatically.
 */
export function selectGeocodeLevel(
  selection: LocationSelection,
  level: Exclude<LocationLevel, "country">,
  result: GeocodeResult,
): LocationSelection {
  const withLevel: LocationSelection = { ...selection, [level]: result };
  return invalidateChildren(withLevel, level);
}

export function clearGeocodeLevel(
  selection: LocationSelection,
  level: Exclude<LocationLevel, "country">,
): LocationSelection {
  const next: LocationSelection = { ...selection };
  delete next[level];
  return invalidateChildren(next, level);
}

/** Skip a level without selecting anything (children stay invalid until set). */
export function skipLevel(
  selection: LocationSelection,
  level: Exclude<LocationLevel, "country">,
): LocationSelection {
  return clearGeocodeLevel(selection, level);
}

/**
 * Guard used by UI/search handlers: selecting from a list requires an
 * explicit pick. Passing undefined or an empty list must not invent a choice.
 */
export function pickFromResults(
  results: GeocodeResult[],
  index: number | null | undefined,
): GeocodeResult | undefined {
  if (index === null || index === undefined) {
    return undefined;
  }
  if (!Number.isInteger(index) || index < 0 || index >= results.length) {
    return undefined;
  }
  return results[index];
}

/** Never auto-select the first geocode hit. */
export function shouldAutoSelectFirstResult(): false {
  return false;
}

export function breadcrumbLabels(selection: LocationSelection): string[] {
  const parts: string[] = [];
  if (selection.country) {
    parts.push(selection.country.name);
  }
  if (selection.region) {
    parts.push(selection.region.displayName);
  }
  if (selection.county) {
    parts.push(selection.county.displayName);
  }
  if (selection.city) {
    parts.push(selection.city.displayName);
  }
  return parts;
}

export function deepestSelection(
  selection: LocationSelection,
): GeocodeResult | LocationSelection["country"] | undefined {
  return (
    selection.city ??
    selection.county ??
    selection.region ??
    selection.country
  );
}

export function mapFocusFromSelection(selection: LocationSelection): {
  center: { lat: number; lng: number } | null;
  boundingBox?: [number, number, number, number];
  /** Suggested map zoom when no bounding box is available. */
  zoom?: number;
} {
  if (selection.city) {
    return {
      center: { lat: selection.city.lat, lng: selection.city.lng },
      boundingBox: selection.city.boundingBox,
      zoom: 12,
    };
  }
  if (selection.county) {
    return {
      center: { lat: selection.county.lat, lng: selection.county.lng },
      boundingBox: selection.county.boundingBox,
      zoom: 10,
    };
  }
  if (selection.region) {
    return {
      center: { lat: selection.region.lat, lng: selection.region.lng },
      boundingBox: selection.region.boundingBox,
      zoom: 7,
    };
  }
  if (
    selection.country &&
    typeof selection.country.lat === "number" &&
    typeof selection.country.lng === "number"
  ) {
    return {
      center: { lat: selection.country.lat, lng: selection.country.lng },
      zoom: 5,
    };
  }
  return { center: null };
}
