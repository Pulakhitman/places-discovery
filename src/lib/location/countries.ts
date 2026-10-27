import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import type { CountryOption } from "./types";

countries.registerLocale(enLocale);

/** Complete ISO 3166-1 alpha-2 country list (English names), sorted. */
export function getAllCountries(): CountryOption[] {
  const names = countries.getNames("en", { select: "official" });
  return Object.entries(names)
    .map(([code, name]) => ({ code, name }))
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
