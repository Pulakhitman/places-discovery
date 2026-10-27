"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { filterCountries, getAllCountries } from "@/lib/location/countries";
import {
  bboxFromCenter,
  countyBoundsAreReliable,
  DIVISION_BBOX_RADIUS_KM,
  ensureBoundingBox,
} from "@/lib/location/bbox";
import {
  cityBelongsToCounty,
  filterDivisions,
  getCitiesForSelection,
  getCountiesForRegion,
  getRegionsForCountry,
  hasStaticCountyList,
  toGeocodeResult,
  type DivisionOption,
} from "@/lib/location/divisions";
import { enrichGeocodeBoundingBox } from "@/lib/location/enrich-bbox";
import {
  breadcrumbLabels,
  clearGeocodeLevel,
  patchCountry,
  patchGeocodeLevel,
  selectGeocodeLevel,
  setCountry,
  skipLevel,
} from "@/lib/location/hierarchy";
import type {
  CountryOption,
  GeocodeResult,
  HierarchySearchState,
  LocationSelection,
} from "@/lib/location/types";

type Props = {
  selection: LocationSelection;
  onChange: (next: LocationSelection) => void;
};

export function LocationHierarchy({ selection, onChange }: Props) {
  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  /**
   * Keep selectionRef in sync before parent re-renders. Nominatim enrich
   * callbacks race the useEffect above; without this, a late region/country
   * patch can overwrite a county/city the user just picked.
   */
  const commit = useCallback(
    (next: LocationSelection) => {
      selectionRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const countries = useMemo(() => getAllCountries(), []);
  const [countryQuery, setCountryQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryListId = useId();

  const filteredCountries = useMemo(
    () => filterCountries(countryQuery, countries),
    [countryQuery, countries],
  );

  const regions = useMemo(
    () =>
      selection.country
        ? getRegionsForCountry(selection.country.code)
        : [],
    [selection.country],
  );

  const counties = useMemo(() => {
    if (!selection.country || !selection.region) {
      return [];
    }
    return getCountiesForRegion(selection.country.code, selection.region);
  }, [selection.country, selection.region]);

  const cities = useMemo(() => {
    if (!selection.country) {
      return [];
    }
    return getCitiesForSelection(
      selection.country.code,
      selection.region,
      selection.county,
    );
  }, [selection.country, selection.region, selection.county]);

  const countyCitiesPending = Boolean(
    selection.county &&
      !countyBoundsAreReliable(selection.county, selection.region),
  );

  const nonUsCityParentContext = useMemo(
    () =>
      [selection.county?.displayName, selection.region?.displayName].filter(
        (v): v is string => Boolean(v),
      ),
    [selection.county?.displayName, selection.region?.displayName],
  );

  const crumbs = breadcrumbLabels(selection);

  // Drop a city that falls outside the county once Nominatim county bounds arrive.
  useEffect(() => {
    const { city, county, region } = selection;
    if (!city || !county) {
      return;
    }
    if (cityBelongsToCounty(city, county, region)) {
      return;
    }
    commit(clearGeocodeLevel(selectionRef.current, "city"));
  }, [
    selection.city,
    selection.county,
    selection.region,
    commit,
  ]);

  const selectDivision = (
    level: "region" | "county" | "city",
    opt: DivisionOption,
  ) => {
    const immediate = toGeocodeResult(opt, level);
    const base = selectionRef.current;
    commit(selectGeocodeLevel(base, level, immediate));
    const countryCode = base.country?.code;
    const parentContext: string[] = [];
    if (level === "city") {
      if (base.county?.displayName) {
        parentContext.push(base.county.displayName);
      }
      if (base.region?.displayName) {
        parentContext.push(base.region.displayName);
      }
    } else if (level === "county" && base.region?.displayName) {
      parentContext.push(base.region.displayName);
    }
    void enrichGeocodeBoundingBox({
      result: immediate,
      level,
      countryCode,
      parentContext,
    }).then((enriched) => {
      if (!enriched.boundingBox) {
        return;
      }
      if (
        JSON.stringify(enriched.boundingBox) ===
        JSON.stringify(immediate.boundingBox)
      ) {
        return;
      }
      // Patch only — never selectGeocodeLevel here (that clears county/city).
      commit(patchGeocodeLevel(selectionRef.current, level, enriched));
    });
  };

  const selectCountryWithBox = (c: CountryOption) => {
    let next = setCountry(selectionRef.current, c);
    if (
      typeof c.lat === "number" &&
      typeof c.lng === "number" &&
      next.country
    ) {
      next = {
        ...next,
        country: {
          ...next.country,
          boundingBox:
            c.boundingBox ??
            bboxFromCenter(c.lat, c.lng, DIVISION_BBOX_RADIUS_KM.country),
        },
      };
    }
    commit(next);
    if (typeof c.lat !== "number" || typeof c.lng !== "number") {
      return;
    }
    void enrichGeocodeBoundingBox({
      result: {
        id: `country:${c.code}`,
        displayName: c.name,
        lat: c.lat,
        lng: c.lng,
        boundingBox: next.country?.boundingBox,
      },
      level: "country",
      countryCode: c.code,
    }).then((enriched) => {
      if (!enriched.boundingBox) {
        return;
      }
      // Patch only — setCountry would wipe region/county/city.
      commit(
        patchCountry(selectionRef.current, {
          code: c.code,
          name: c.name,
          lat: enriched.lat,
          lng: enriched.lng,
          boundingBox: enriched.boundingBox,
        }),
      );
    });
  };

  return (
    <section
      aria-labelledby="location-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="location-heading"
          className="text-sm font-semibold tracking-wide text-[var(--ink)]"
        >
          Area
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Browse full dropdown lists for country, region/state, county (US), and
          city. Nothing is auto-selected — pick an option, or Skip a level.
        </p>
      </div>

      <nav aria-label="Selected area" className="text-sm text-[var(--muted)]">
        {crumbs.length === 0 ? (
          <span>No area selected yet</span>
        ) : (
          <ol className="flex flex-wrap items-center gap-1">
            {crumbs.map((label, i) => (
              <li key={`${i}-${label}`} className="flex items-center gap-1">
                {i > 0 && (
                  <span aria-hidden="true" className="text-[var(--line)]">
                    /
                  </span>
                )}
                <span
                  className={
                    i === crumbs.length - 1
                      ? "font-medium text-[var(--ink)]"
                      : undefined
                  }
                >
                  {label}
                </span>
              </li>
            ))}
          </ol>
        )}
      </nav>

      <CountryField
        countries={countries}
        filtered={filteredCountries}
        query={countryQuery}
        open={countryOpen}
        listId={countryListId}
        selected={selection.country}
        onQuery={(q) => {
          setCountryQuery(q);
          setCountryOpen(true);
        }}
        onOpen={() => {
          setCountryQuery("");
          setCountryOpen(true);
        }}
        onClose={() => setCountryOpen(false)}
        onSelect={(c) => {
          selectCountryWithBox(c);
          setCountryQuery(c.name);
          setCountryOpen(false);
        }}
        onClear={() => {
          commit(setCountry(selectionRef.current, undefined));
          setCountryQuery("");
        }}
      />

      <StaticDivisionField
        key={`region:${selection.country?.code ?? ""}`}
        id="region"
        label="Region / state"
        options={regions}
        selected={selection.region}
        disabled={!selection.country}
        disabledHint="Select a country first"
        emptyHint="No regions found for this country"
        onSelect={(opt) => selectDivision("region", opt)}
        onSkip={() => commit(skipLevel(selectionRef.current, "region"))}
        onClear={() => commit(skipLevel(selectionRef.current, "region"))}
      />

      {selection.country && hasStaticCountyList(selection.country.code) ? (
        <StaticDivisionField
          key={`county:${selection.region?.id ?? ""}`}
          id="county"
          label="County"
          options={counties}
          selected={selection.county}
          disabled={!selection.region}
          disabledHint="Select a region / state first"
          emptyHint="No counties for this state — Skip or pick another state"
          onSelect={(opt) => selectDivision("county", opt)}
          onSkip={() => commit(skipLevel(selectionRef.current, "county"))}
          onClear={() => commit(skipLevel(selectionRef.current, "county"))}
        />
      ) : (
        <NominatimDivisionField
          key={`county-search:${selection.country?.code ?? ""}:${selection.region?.id ?? ""}`}
          id="county"
          label="County"
          level="county"
          country={selection.country}
          selected={selection.county}
          disabled={!selection.country}
          note="Full county lists ship for the US. Elsewhere, search Nominatim or Skip."
          onSelect={(result) =>
            commit(
              selectGeocodeLevel(
                selectionRef.current,
                "county",
                ensureBoundingBox(result, "county"),
              ),
            )
          }
          onSkip={() => commit(skipLevel(selectionRef.current, "county"))}
          onClear={() => commit(skipLevel(selectionRef.current, "county"))}
        />
      )}

      {selection.country &&
      !hasStaticCountyList(selection.country.code) &&
      selection.county ? (
        <NominatimDivisionField
          key={`city-search:${selection.country.code}:${selection.county.id}`}
          id="city"
          label="City"
          level="city"
          country={selection.country}
          selected={selection.city}
          disabled={!selection.country}
          parentContext={nonUsCityParentContext}
          note="Search cities inside the selected county (Nominatim)."
          onSelect={(result) =>
            commit(
              selectGeocodeLevel(
                selectionRef.current,
                "city",
                ensureBoundingBox(result, "city"),
              ),
            )
          }
          onSkip={() => commit(skipLevel(selectionRef.current, "city"))}
          onClear={() => commit(skipLevel(selectionRef.current, "city"))}
        />
      ) : (
        <StaticDivisionField
          key={`city:${selection.country?.code ?? ""}:${selection.region?.id ?? ""}:${selection.county?.id ?? ""}`}
          id="city"
          label="City"
          options={cities}
          selected={selection.city}
          disabled={!selection.country}
          disabledHint="Select a country first"
          emptyHint={
            selection.county
              ? countyCitiesPending
                ? "Locating county — city list updates when the map box is ready"
                : "No cities in this county in the local list"
              : selection.region
                ? "No cities for this region in the local list"
                : "No cities found — pick a region first for a shorter list"
          }
          onSelect={(opt) => selectDivision("city", opt)}
          onSkip={() => commit(skipLevel(selectionRef.current, "city"))}
          onClear={() => commit(skipLevel(selectionRef.current, "city"))}
        />
      )}
    </section>
  );
}

function CountryField({
  countries,
  filtered,
  query,
  open,
  listId,
  selected,
  onQuery,
  onOpen,
  onClose,
  onSelect,
  onClear,
}: {
  countries: CountryOption[];
  filtered: CountryOption[];
  query: string;
  open: boolean;
  listId: string;
  selected?: CountryOption;
  onQuery: (q: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (c: CountryOption) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          htmlFor="country-search"
          className="text-sm font-medium text-[var(--ink)]"
        >
          Country
        </label>
        <span className="text-xs text-[var(--muted)]">
          {countries.length} countries — scroll or type to filter
        </span>
      </div>
      <div className="flex gap-2">
        <input
          id="country-search"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Click to browse all, or type to filter…"
          value={open ? query : (selected?.name ?? query)}
          onChange={(e) => onQuery(e.target.value)}
          onFocus={onOpen}
          onBlur={() => {
            window.setTimeout(onClose, 150);
          }}
          className="field"
        />
        <button
          type="button"
          className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)]"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={open ? "Hide country list" : "Show all countries"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              onClose();
              return;
            }
            onOpen();
            document.getElementById("country-search")?.focus();
          }}
        >
          {open ? "Hide" : "List"}
        </button>
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="All countries"
          className="dropdown dropdown-tall"
        >
          <li className="sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)]">
            {query.trim()
              ? `${filtered.length} match${filtered.length === 1 ? "" : "es"}`
              : `Showing all ${countries.length} countries`}
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--muted)]">
              No countries match
            </li>
          ) : (
            filtered.map((c) => (
              <li
                key={c.code}
                role="option"
                aria-selected={selected?.code === c.code}
              >
                <button
                  type="button"
                  className={`dropdown-item ${
                    selected?.code === c.code
                      ? "bg-[var(--surface-2)] font-medium"
                      : ""
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(c)}
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-[var(--muted)]">{c.code}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {selected && (
        <button
          type="button"
          className="mt-1 text-xs text-[var(--accent)] underline-offset-2 hover:underline"
          onClick={onClear}
        >
          Clear country
        </button>
      )}
    </div>
  );
}

function StaticDivisionField({
  id,
  label,
  options,
  selected,
  disabled,
  disabledHint,
  emptyHint,
  onSelect,
  onSkip,
  onClear,
}: {
  id: string;
  label: string;
  options: DivisionOption[];
  selected?: GeocodeResult;
  disabled?: boolean;
  disabledHint: string;
  emptyHint: string;
  onSelect: (option: DivisionOption) => void;
  onSkip: () => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const filtered = useMemo(
    () => filterDivisions(query, options),
    [query, options],
  );

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          htmlFor={`level-${id}`}
          className="text-sm font-medium text-[var(--ink)]"
        >
          {label}
        </label>
        <div className="flex items-center gap-2">
          {!disabled && (
            <span className="text-xs text-[var(--muted)]">
              {options.length} options
            </span>
          )}
          {!disabled && (
            <button
              type="button"
              className="text-xs text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
              onClick={onSkip}
            >
              Skip level
            </button>
          )}
          {selected && (
            <button
              type="button"
              className="text-xs text-[var(--accent)] underline-offset-2 hover:underline"
              onClick={onClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {selected ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)]">
          {selected.displayName}
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              id={`level-${id}`}
              type="search"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              disabled={disabled}
              placeholder={disabled ? disabledHint : `Browse all ${label.toLowerCase()}s…`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (!disabled) {
                  setQuery("");
                  setOpen(true);
                }
              }}
              onBlur={() => {
                window.setTimeout(() => setOpen(false), 150);
              }}
              className="field"
            />
            <button
              type="button"
              className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-50"
              disabled={disabled}
              aria-expanded={open}
              aria-controls={listId}
              aria-label={open ? `Hide ${label} list` : `Show all ${label} options`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (open) {
                  setOpen(false);
                  return;
                }
                setQuery("");
                setOpen(true);
                document.getElementById(`level-${id}`)?.focus();
              }}
            >
              {open ? "Hide" : "List"}
            </button>
          </div>

          {open && !disabled && (
            <ul
              id={listId}
              role="listbox"
              aria-label={`${label} options`}
              className="dropdown dropdown-tall"
            >
              <li className="sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)]">
                {options.length === 0
                  ? emptyHint
                  : query.trim()
                    ? `${filtered.length} match${filtered.length === 1 ? "" : "es"}`
                    : `Showing all ${options.length} options`}
              </li>
              {options.length === 0 ? null : filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--muted)]">
                  No matches
                </li>
              ) : (
                filtered.map((opt) => (
                  <li key={opt.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="dropdown-item text-left"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelect(opt);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <span>{opt.name}</span>
                      {opt.subtitle ? (
                        <span className="text-xs text-[var(--muted)]">
                          {opt.subtitle}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function NominatimDivisionField({
  id,
  label,
  level,
  country,
  selected,
  disabled,
  note,
  parentContext = [],
  onSelect,
  onSkip,
  onClear,
}: {
  id: string;
  label: string;
  level: "county" | "city";
  country?: CountryOption;
  selected?: GeocodeResult;
  disabled?: boolean;
  note: string;
  /** Parent area names appended to the Nominatim query (county, region). */
  parentContext?: string[];
  onSelect: (result: GeocodeResult) => void;
  onSkip: () => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<HierarchySearchState>({ status: "idle" });
  const listId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!q.trim() || !country) {
        setState({ status: "idle" });
        return;
      }

      const parents = parentContext.map((p) => p.trim()).filter(Boolean);
      const biasedQuery =
        parents.length > 0 ? `${q.trim()}, ${parents.join(", ")}` : q.trim();

      setState({ status: "loading" });
      try {
        const params = new URLSearchParams({
          q: biasedQuery,
          country: country.code,
          level,
        });
        const res = await fetch(`/api/geocode/search?${params}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          results?: GeocodeResult[];
          status?: string;
          message?: string;
          retryAfterSec?: number;
        };

        if (controller.signal.aborted) {
          return;
        }

        if (res.status === 429 || data.status === "rate_limited") {
          setState({
            status: "rate_limited",
            message:
              data.message ?? "Rate limited. Wait a moment and try again.",
            retryAfterSec: data.retryAfterSec,
          });
          return;
        }

        if (!res.ok || data.status === "error") {
          setState({
            status: "error",
            message: data.message ?? "Search failed.",
            retryable: true,
          });
          return;
        }

        let results = data.results ?? [];
        // Prefer hits whose label mentions the county/region parent when present.
        if (parents.length > 0 && results.length > 1) {
          const parentNeedle = parents[0]!.toLowerCase();
          const narrowed = results.filter((r) =>
            (r.displayName || "").toLowerCase().includes(parentNeedle),
          );
          if (narrowed.length > 0) {
            results = narrowed;
          }
        }

        if (results.length === 0) {
          setState({ status: "empty", query: q });
          return;
        }

        setState({ status: "results", query: q, results });
        setOpen(true);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setState({
          status: "error",
          message: "Network error while searching.",
          retryable: true,
        });
      }
    },
    [country, level, parentContext],
  );

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          htmlFor={`level-${id}`}
          className="text-sm font-medium text-[var(--ink)]"
        >
          {label}
        </label>
        <div className="flex items-center gap-2">
          {!disabled && (
            <button
              type="button"
              className="text-xs text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
              onClick={onSkip}
            >
              Skip level
            </button>
          )}
          {selected && (
            <button
              type="button"
              className="text-xs text-[var(--accent)] underline-offset-2 hover:underline"
              onClick={onClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <p className="mb-1 text-xs text-[var(--muted)]">{note}</p>

      {selected ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)]">
          {selected.displayName}
        </p>
      ) : (
        <>
          <input
            id={`level-${id}`}
            type="search"
            role="combobox"
            aria-expanded={open && state.status === "results"}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            placeholder={
              disabled
                ? "Select a country first"
                : level === "city"
                  ? "Search city…"
                  : "Search county…"
            }
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              setOpen(true);
              if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
              }
              debounceRef.current = window.setTimeout(() => {
                void runSearch(value);
              }, 350);
            }}
            className="field"
          />
          {state.status === "loading" && (
            <p className="mt-1 text-xs text-[var(--muted)]" role="status">
              Searching…
            </p>
          )}
          {state.status === "empty" && (
            <p className="mt-1 text-xs text-[var(--muted)]" role="status">
              No matches for “{state.query}”.
            </p>
          )}
          {state.status === "error" && (
            <p className="mt-1 text-xs text-[var(--danger)]" role="alert">
              {state.message}
            </p>
          )}
          {state.status === "rate_limited" && (
            <p className="mt-1 text-xs text-[var(--warn)]" role="alert">
              {state.message}
            </p>
          )}
          {open && state.status === "results" && (
            <ul
              id={listId}
              role="listbox"
              aria-label={`${label} matches`}
              className="dropdown dropdown-tall"
            >
              {state.results.map((result) => (
                <li key={result.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="dropdown-item text-left"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(result);
                      setQuery("");
                      setOpen(false);
                      setState({ status: "idle" });
                    }}
                  >
                    {result.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
