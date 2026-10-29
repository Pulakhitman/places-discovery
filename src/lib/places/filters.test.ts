import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  DEFAULT_RESULT_FILTERS,
  defaultFiltersForCategory,
  filterPlaces,
} from "./filters";
import type { OsmPlace } from "./types";

function place(partial: Partial<OsmPlace> & Pick<OsmPlace, "id" | "name">): OsmPlace {
  return {
    source: "osm",
    osmType: "node",
    osmId: 1,
    isUnnamed: false,
    categoryId: "parks",
    categoryLabel: "Parks & gardens",
    lat: 1,
    lng: 2,
    distanceM: 100,
    tags: {},
    sources: { osm: true },
    ...partial,
  };
}

describe("filterPlaces", () => {
  const places = [
    place({
      id: "a",
      name: "Named Park",
      address: "1 Main",
      hours: "24/7",
      website: "https://a.test",
      phone: "1",
      distanceM: 200,
    }),
    place({
      id: "b",
      name: "Unnamed park",
      isUnnamed: true,
      distanceM: 800,
    }),
    place({
      id: "c",
      name: "Far Garden",
      address: "2 Oak",
      distanceM: 3000,
    }),
  ];

  it("returns all with default filters", () => {
    expect(filterPlaces(places, DEFAULT_RESULT_FILTERS)).toHaveLength(3);
  });

  it("keeps named places only", () => {
    const out = filterPlaces(places, {
      ...DEFAULT_RESULT_FILTERS,
      namedOnly: true,
    });
    expect(out.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("requires tagged fields", () => {
    const out = filterPlaces(places, {
      ...DEFAULT_RESULT_FILTERS,
      hasAddress: true,
      hasHours: true,
    });
    expect(out.map((p) => p.id)).toEqual(["a"]);
  });

  it("limits by distance", () => {
    const out = filterPlaces(places, {
      ...DEFAULT_RESULT_FILTERS,
      maxDistanceM: 1000,
    });
    expect(out.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("counts active filters", () => {
    expect(activeFilterCount(DEFAULT_RESULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_RESULT_FILTERS,
        namedOnly: true,
        hasPhone: true,
        maxDistanceM: 500,
      }),
    ).toBe(3);
  });
});

describe("defaultFiltersForCategory", () => {
  it("starts business categories named-only", () => {
    expect(defaultFiltersForCategory("restaurants").namedOnly).toBe(true);
    expect(defaultFiltersForCategory("shops").namedOnly).toBe(true);
  });

  it("leaves parks and playgrounds showing unnamed features", () => {
    expect(defaultFiltersForCategory("parks").namedOnly).toBe(false);
    expect(defaultFiltersForCategory("playgrounds").namedOnly).toBe(false);
  });
});
