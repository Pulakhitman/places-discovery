import { Country } from "country-state-city";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import type { CountryOption } from "./types";

countries.registerLocale(enLocale);

function parseCoord(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Complete ISO 3166-1 alpha-2 country list (English names), sorted, with map coords when known. */
export function getAllCountries(): CountryOption[] {
  const names = countries.getNames("en", { select: "official" });
  return Object.entries(names)
    .map(([code, name]) => {
      const csc = Country.getCountryByCode(code);
      return {
        code,
        name,
        lat: parseCoord(csc?.latitude),
        lng: parseCoord(csc?.longitude),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterCountries(
  query: string,
  list: CountryOption[] = getAllCountries(),
): CountryOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return list;
  }
  return list.filter(
    (c) =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
  );
}

export function getCountryFocus(code: string): {
  lat: number;
  lng: number;
} | null {
  const csc = Country.getCountryByCode(code.toUpperCase());
  const lat = parseCoord(csc?.latitude);
  const lng = parseCoord(csc?.longitude);
  if (lat === undefined || lng === undefined) {
    return null;
  }
  return { lat, lng };
}
