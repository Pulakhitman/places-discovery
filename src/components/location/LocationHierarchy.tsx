"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { filterCountries, getAllCountries } from "@/lib/location/countries";
import {
  breadcrumbLabels,
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

type LevelKey = "region" | "county" | "city";

const LEVELS: { key: LevelKey; label: string; placeholder: string }[] = [
  {
    key: "region",
    label: "Region / state",
    placeholder: "Search region or state…",
  },
  { key: "county", label: "County", placeholder: "Search county…" },
  { key: "city", label: "City", placeholder: "Search city…" },
];

export function LocationHierarchy({ selection, onChange }: Props) {
  const countries = useMemo(() => getAllCountries(), []);
  const [countryQuery, setCountryQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryListId = useId();

  const filteredCountries = useMemo(
    () => filterCountries(countryQuery, countries),
    [countryQuery, countries],
  );

  const crumbs = breadcrumbLabels(selection);

  return (
    <section
      aria-labelledby="location-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="location-heading" className="text-sm font-semibold tracking-wide text-[var(--ink)]">
          Area
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Open Country to scroll the full ISO list (or type to filter). Then
          optionally search region, county, and city — those levels come from
          Nominatim, so pick a match from the results (never auto-selected).
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
                <span className={i === crumbs.length - 1 ? "font-medium text-[var(--ink)]" : undefined}>
                  {label}
                </span>
              </li>
            ))}
          </ol>
        )}
      </nav>

      <div className="relative">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="country-search" className="text-sm font-medium text-[var(--ink)]">
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
            aria-expanded={countryOpen}
            aria-controls={countryListId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Click to browse all, or type to filter…"
            value={
              countryOpen
                ? countryQuery
                : selection.country?.name ?? countryQuery
            }
            onChange={(e) => {
              setCountryQuery(e.target.value);
              setCountryOpen(true);
            }}
            onFocus={() => {
              // Open with empty filter so the full country list is visible.
              setCountryQuery("");
              setCountryOpen(true);
            }}
            onBlur={() => {
              // Delay so option click registers
              window.setTimeout(() => setCountryOpen(false), 150);
            }}
            className="field"
          />
          <button
            type="button"
            className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)]"
            aria-expanded={countryOpen}
            aria-controls={countryListId}
            aria-label={countryOpen ? "Hide country list" : "Show all countries"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (countryOpen) {
                setCountryOpen(false);
                return;
              }
              setCountryQuery("");
              setCountryOpen(true);
              document.getElementById("country-search")?.focus();
            }}
          >
            {countryOpen ? "Hide" : "List"}
          </button>
        </div>
        {countryOpen && (
          <ul
            id={countryListId}
            role="listbox"
            aria-label="All countries"
            className="dropdown dropdown-tall"
          >
            <li className="sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)]">
              {countryQuery.trim()
                ? `${filteredCountries.length} match${filteredCountries.length === 1 ? "" : "es"}`
                : `Showing all ${countries.length} countries`}
            </li>
            {filteredCountries.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--muted)]">No countries match</li>
            ) : (
              filteredCountries.map((c) => (
                <li key={c.code} role="option" aria-selected={selection.country?.code === c.code}>
                  <button
                    type="button"
                    className={`dropdown-item ${
                      selection.country?.code === c.code ? "bg-[var(--surface-2)] font-medium" : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(setCountry(selection, c));
                      setCountryQuery(c.name);
                      setCountryOpen(false);
                    }}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-[var(--muted)]">{c.code}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        {selection.country && (
          <button
            type="button"
            className="mt-1 text-xs text-[var(--accent)] underline-offset-2 hover:underline"
            onClick={() => {
              onChange(setCountry(selection, undefined));
              setCountryQuery("");
            }}
          >
            Clear country
          </button>
        )}
      </div>

      {LEVELS.map((level) => {
        // Remount on parent change so local search state resets without an effect.
        const resetKey = [
          level.key,
          selection.country?.code ?? "",
          selection.region?.id ?? "",
          selection.county?.id ?? "",
        ].join(":");
        return (
          <GeocodeLevelField
            key={resetKey}
            level={level.key}
            label={level.label}
            placeholder={level.placeholder}
            country={selection.country}
            selected={selection[level.key]}
            disabled={!selection.country}
            onSelect={(result) =>
              onChange(selectGeocodeLevel(selection, level.key, result))
            }
            onSkip={() => onChange(skipLevel(selection, level.key))}
            onClear={() => onChange(skipLevel(selection, level.key))}
          />
        );
      })}
    </section>
  );
}

function GeocodeLevelField({
  level,
  label,
  placeholder,
  country,
  selected,
  disabled,
  onSelect,
  onSkip,
  onClear,
}: {
  level: LevelKey;
  label: string;
  placeholder: string;
  country?: CountryOption;
  selected?: GeocodeResult;
  disabled?: boolean;
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

      setState({ status: "loading" });
      try {
        const params = new URLSearchParams({
          q,
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
          query?: string;
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

        const results = data.results ?? [];
        if (results.length === 0) {
          setState({ status: "empty", query: q });
          return;
        }

        // Intentionally do NOT auto-select results[0]
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
    [country, level],
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void runSearch(value);
    }, 350);
  };

  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={`level-${level}`} className="text-sm font-medium text-[var(--ink)]">
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

      {selected ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)]">
          {selected.displayName}
        </p>
      ) : (
        <>
          <input
            id={`level-${level}`}
            type="search"
            role="combobox"
            aria-expanded={open && state.status === "results"}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            placeholder={disabled ? "Select a country first" : placeholder}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => {
              if (state.status === "results") {
                setOpen(true);
              }
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
              No matches for “{state.query}”. Try a different spelling.
            </p>
          )}
          {state.status === "error" && (
            <p className="mt-1 text-xs text-[var(--danger)]" role="alert">
              {state.message}{" "}
              {state.retryable && (
                <button
                  type="button"
                  className="underline"
                  onClick={() => void runSearch(query)}
                >
                  Retry
                </button>
              )}
            </p>
          )}
          {state.status === "rate_limited" && (
            <p className="mt-1 text-xs text-[var(--warn)]" role="alert">
              {state.message}
              {state.retryAfterSec
                ? ` Try again in ~${state.retryAfterSec}s.`
                : ""}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void runSearch(query)}
              >
                Retry
              </button>
            </p>
          )}

          {open && state.status === "results" && (
            <ul id={listId} role="listbox" aria-label={`${label} matches`} className="dropdown">
              {state.results.map((result, index) => (
                <li key={result.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="dropdown-item text-left"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      // Explicit user pick only — never auto-select first
                      onSelect(result);
                      setQuery("");
                      setOpen(false);
                      setState({ status: "idle" });
                      void index;
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
