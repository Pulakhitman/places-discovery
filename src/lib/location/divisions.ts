import { City, State } from "country-state-city";
import { getCountyByState } from "@nickgraffis/us-counties";
import { ensureBoundingBox, type DivisionLevel } from "./bbox";
import type { GeocodeResult } from "./types";

export type DivisionOption = {
  id: string;
  name: string;
  /** ISO 3166-2 state/province code when applicable */
  adminCode?: string;
  lat: number;
  lng: number;
  subtitle?: string;
};

function parseCoord(value: string | null | undefined, fallback = 0): number {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function toGeocodeResult(
  option: DivisionOption,
  level: DivisionLevel = "city",
): GeocodeResult {
  return ensureBoundingBox(
    {
      id: option.id,
      displayName: option.name,
      lat: option.lat,
      lng: option.lng,
      adminCode: option.adminCode,
      type: "division",
    },
    level,
  );
}

export function getRegionsForCountry(countryCode: string): DivisionOption[] {
  return State.getStatesOfCountry(countryCode.toUpperCase())
    .map((s) => ({
      id: `state:${s.countryCode}:${s.isoCode}`,
      name: s.name,
      adminCode: s.isoCode,
      lat: parseCoord(s.latitude),
      lng: parseCoord(s.longitude),
      subtitle: s.isoCode,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Full county lists are available for the United States (by state).
 * Other countries: empty — UI should offer search or Skip.
 */
function usStateNameForCounties(
  countryCode: string,
  region: Pick<GeocodeResult, "adminCode" | "displayName">,
): string {
  const cc = countryCode.toUpperCase();
  // Prefer ISO → official CSC state name (stable after Nominatim enrich).
  if (region.adminCode) {
    const fromIso = State.getStateByCodeAndCountry(region.adminCode, cc);
    if (fromIso?.name) {
      return fromIso.name;
    }
  }
  const raw = (region.displayName || "").trim();
  if (!raw) {
    return "";
  }
  // Nominatim may return "California, United States" — package wants "California".
  return raw.split(",")[0]?.trim() || raw;
}

export function getCountiesForRegion(
  countryCode: string,
  region: Pick<GeocodeResult, "adminCode" | "displayName" | "lat" | "lng">,
): DivisionOption[] {
  if (countryCode.toUpperCase() !== "US") {
    return [];
  }

  // Package accepts full state name ("California"), not ISO "CA".
  const stateKey = usStateNameForCounties(countryCode, region);
  const rows = stateKey
    ? (getCountyByState(stateKey) as Array<{
        name?: string;
        stateAbbr?: string;
        FIPS?: string;
      }>)
    : [];

  const normalized = Array.isArray(rows) ? rows : [];
  const options: DivisionOption[] = [];

  normalized.forEach((row, index) => {
    const name = (row.name || "").trim();
    if (!name) {
      return;
    }
    const stateCode = (row.stateAbbr || region.adminCode || "").toUpperCase();
    const label = name.toLowerCase().endsWith("county")
      ? name
      : `${name} County`;
    options.push({
      id: `county:US:${stateCode}:${row.FIPS ?? name}:${index}`,
      name: label,
      adminCode: stateCode,
      // Approximate with parent region center (county package has no coords).
      lat: region.lat,
      lng: region.lng,
      subtitle: stateCode,
    });
  });

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

export function hasStaticCountyList(countryCode: string): boolean {
  return countryCode.toUpperCase() === "US";
}

export function getCitiesForSelection(
  countryCode: string,
  region?: Pick<GeocodeResult, "adminCode"> | null,
): DivisionOption[] {
  const cc = countryCode.toUpperCase();
  const raw = region?.adminCode
    ? City.getCitiesOfState(cc, region.adminCode)
    : City.getCitiesOfCountry(cc);

  return (raw ?? [])
    .map((c) => ({
      id: `city:${c.countryCode}:${c.stateCode ?? ""}:${c.name}`,
      name: c.name,
      adminCode: c.stateCode,
      lat: parseCoord(c.latitude),
      lng: parseCoord(c.longitude),
      subtitle: c.stateCode || undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterDivisions(
  query: string,
  options: DivisionOption[],
): DivisionOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return options;
  }
  return options.filter(
    (o) =>
      o.name.toLowerCase().includes(q) ||
      o.subtitle?.toLowerCase().includes(q) ||
      o.adminCode?.toLowerCase().includes(q),
  );
}
